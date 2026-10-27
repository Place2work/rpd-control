// Arma la "foto" que necesita la máquina de estados a partir del caso guardado.
import "server-only";
import type { Tx } from "@/lib/db/prisma";
import type { FotoCaso, Etapa } from "@/lib/reglas/etapas";
import { fechaElegibleDesempleo, fechaFinCandado, type FechaISO } from "@/lib/reglas/fechas";

const iso = (d: Date | null | undefined): FechaISO | null => (d ? d.toISOString().slice(0, 10) : null);

/** Obligatorios del servicio que no tienen un documento validado y vigente. */
export async function documentosPendientes(tx: Tx, casoId: string, tipoServicio: string, hoy: FechaISO): Promise<number> {
  const obligatorios = await tx.tipoDocumentoServicio.findMany({
    where: { tipo_servicio: tipoServicio, obligatorio: true, tipo_documento: { activo: true, obligatorio: true } },
    select: { tipo_documento_id: true },
  });
  if (obligatorios.length === 0) return 0;
  const validados = await tx.documento.findMany({
    where: {
      caso_id: casoId,
      archivado_at: null,
      estado: "validado",
      tipo_id: { in: obligatorios.map((o) => o.tipo_documento_id) },
      OR: [{ fecha_vencimiento: null }, { fecha_vencimiento: { gte: new Date(`${hoy}T00:00:00Z`) } }],
    },
    select: { tipo_id: true },
  });
  const cubiertos = new Set(validados.map((v) => v.tipo_id));
  return obligatorios.filter((o) => !cubiertos.has(o.tipo_documento_id)).length;
}

export async function fotoDelCaso(tx: Tx, casoId: string, hoy: FechaISO, p: { DIAS_ESPERA_DESEMPLEO: number; ANIOS_CANDADO_RETIRO: number }) {
  const c = await tx.caso.findUnique({
    where: { id: casoId },
    include: {
      persona: { select: { telefono: true, whatsapp: true } },
      servicio: { select: { embudo: true } },
      datos_imss: { select: { regimen: true, fecha_baja: true } },
      datos_afore: { select: { estado_ultimo_retiro: true, fecha_ultimo_retiro: true } },
      _count: { select: { pagos_afore: { where: { archivado_at: null } } } },
    },
  });
  if (!c) return null;
  const cobros = await tx.cobro.groupBy({ by: ["estado"], where: { caso_id: casoId, archivado_at: null, estado: { not: "cancelado" } }, _count: true });
  const baja = iso(c.datos_imss?.fecha_baja);
  const foto: FotoCaso = {
    embudo: c.servicio.embudo,
    etapa: c.etapa as Etapa,
    regimen: c.datos_imss?.regimen ?? null,
    tieneTelefono: Boolean(c.persona.telefono || c.persona.whatsapp),
    resultadoPrecalificacion: c.resultado_precalificacion,
    dictamenManual: c.dictamen_manual,
    dia46: baja ? fechaElegibleDesempleo(baja, hoy, p) : null,
    candado: fechaFinCandado(c.datos_afore?.estado_ultimo_retiro ?? "por_verificar", iso(c.datos_afore?.fecha_ultimo_retiro), hoy, p),
    fechaContrato: iso(c.fecha_contrato),
    analisisImpactoOk: c.analisis_impacto_ok,
    clienteEntendioCosto: c.cliente_entendio_costo,
    honorarioFijo: c.honorario_fijo !== null,
    documentosPendientes: await documentosPendientes(tx, casoId, c.tipo_servicio, hoy),
    fechaIngresoSolicitud: iso(c.fecha_ingreso_solicitud),
    acuseAfore: c.acuse_afore,
    resultadoAfore: c.resultado_afore,
    fechaResolucion: iso(c.fecha_resolucion),
    pagosAfore: c._count.pagos_afore,
    cobrosPendientes: cobros.filter((x) => x.estado === "por_cobrar").reduce((a, x) => a + x._count, 0),
    cobrosTotal: cobros.reduce((a, x) => a + x._count, 0),
  };
  return { caso: c, foto };
}
