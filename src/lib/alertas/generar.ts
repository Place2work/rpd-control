// Tarea diaria de alertas (sección 8). Corre como proceso del sistema (sin RLS): revisa
// todos los casos abiertos, sin depender de que alguien los abra.
import "server-only";
import { prismaSistema } from "@/lib/db/prisma";
import { parametrosFechas } from "@/lib/parametros";
import { alertasDelDia, resolverDestinatarios, type CasoAlertable } from "@/lib/reglas/alertas";
import { hoyCDMX } from "@/lib/tiempo";

// Fechas sin hora (DATE) se leen tal cual; momentos (timestamptz) se pasan al día de CDMX.
const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const diaCDMX = (d: Date | null | undefined) => (d ? hoyCDMX(d) : null);
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const CONTACTO = ["nota", "llamada", "whatsapp", "correo"] as const;

export async function generarAlertas(hoy = hoyCDMX()) {
  const db = prismaSistema;
  const p = await parametrosFechas(hoy);

  // Documentos cuya vigencia ya pasó (5.6): se marcan como vencidos.
  const vencidos = await db.documento.updateMany({
    where: { archivado_at: null, estado: { in: ["recibido", "validado"] }, fecha_vencimiento: { lt: dia(hoy) } },
    data: { estado: "vencido" },
  });

  // Pospuestas cuyo plazo ya llegó vuelven a la bandeja.
  const reactivadas = await db.alerta.updateMany({
    where: { estado: "pospuesta", pospuesta_hasta: { lte: dia(hoy) } },
    data: { estado: "activa", pospuesta_hasta: null },
  });

  const casos = await db.caso.findMany({
    where: { archivado_at: null, etapa: { notIn: ["PERDIDO", "CERRADO", "PAGADO", "PENSION_OTORGADA", "SEGUIMIENTO"] } },
    include: {
      persona: { select: { nombre: true, apellido_paterno: true } },
      datos_imss: { select: { fecha_baja: true } },
      datos_afore: { select: { fecha_apertura_cuenta: true, estado_ultimo_retiro: true, fecha_ultimo_retiro: true } },
      eventos: { select: { fecha: true, tipo: true }, orderBy: { fecha: "desc" }, take: 30 },
      documentos: {
        where: { archivado_at: null },
        select: { id: true, estado: true, fecha_vencimiento: true, created_at: true, tipo: { select: { nombre: true } } },
        orderBy: { created_at: "desc" },
      },
    },
  });

  const fotos: CasoAlertable[] = casos.map((c) => {
    const contacto = c.eventos.find((e) => (CONTACTO as readonly string[]).includes(e.tipo));
    return {
      id: c.id,
      folio: c.folio,
      nombre: [c.persona.nombre, c.persona.apellido_paterno].filter(Boolean).join(" "),
      etapa: c.etapa,
      esRetiro: c.tipo_servicio === "RETIRO_DESEMPLEO",
      ownerId: c.owner_id,
      asignadoA: c.asignado_a,
      vendedorId: c.vendedor_id,
      fechaBaja: iso(c.datos_imss?.fecha_baja),
      fechaAperturaCuenta: iso(c.datos_afore?.fecha_apertura_cuenta),
      estadoUltimoRetiro: c.datos_afore?.estado_ultimo_retiro ?? "por_verificar",
      fechaUltimoRetiro: iso(c.datos_afore?.fecha_ultimo_retiro),
      fechaAlta: diaCDMX(c.created_at)!,
      ultimoContacto: diaCDMX(contacto?.fecha),
      ultimoMovimiento: diaCDMX(c.eventos[0]?.fecha ?? c.created_at)!,
      ultimoDocumento: diaCDMX(c.documentos[0]?.created_at),
      etapaDesde: diaCDMX(c.etapa_desde)!,
      fechaExpedienteCompleto: iso(c.fecha_expediente_completo),
      fechaLimiteIngreso: iso(c.fecha_limite_ingreso),
      fechaIngresoSolicitud: iso(c.fecha_ingreso_solicitud),
      fechaLimiteResolucion: iso(c.fecha_limite_resolucion),
      fechaResolucion: iso(c.fecha_resolucion),
      fechaVencimientoContrato: iso(c.fecha_vencimiento_contrato),
      documentosPorVencer: c.documentos
        .filter((d) => d.fecha_vencimiento && (d.estado === "validado" || d.estado === "recibido"))
        .map((d) => ({ id: d.id, nombre: d.tipo.nombre, vence: iso(d.fecha_vencimiento)! })),
    };
  });

  const directores = (await db.usuario.findMany({ where: { rol: "director", activo: true, archivado_at: null }, select: { id: true } })).map((u) => u.id);
  const porCaso = new Map(fotos.map((f) => [f.id, f]));
  const filas = alertasDelDia(fotos, hoy, p).flatMap((a) =>
    resolverDestinatarios(a, porCaso.get(a.casoId)!, directores).map((usuario) => ({
      regla: a.regla, caso_id: a.casoId, severidad: a.severidad, mensaje: a.mensaje, fecha_disparo: dia(hoy),
      asignado_a: usuario, clave_dedup: a.clave,
    })),
  );
  // UNIQUE (clave_dedup, asignado_a): lo que ya existía no se vuelve a crear.
  const creadas = filas.length ? await db.alerta.createMany({ data: filas, skipDuplicates: true }) : { count: 0 };

  return { fecha: hoy, casos_revisados: casos.length, alertas_nuevas: creadas.count, documentos_vencidos: vencidos.count, pospuestas_reactivadas: reactivadas.count };
}
