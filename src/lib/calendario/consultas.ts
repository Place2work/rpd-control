// Eventos del calendario de un usuario (10.5): los casos que RLS le deja ver, convertidos en
// fechas por src/lib/reglas/calendario.ts. Sirve a la pantalla y a la liga .ics.
import "server-only";
import { conUsuario, type ClaimsUsuario } from "@/lib/db/prisma";
import { parametrosFechas, parametrosPension } from "@/lib/parametros";
import { eventosEntre, type CasoCalendario, type Evento } from "@/lib/reglas/calendario";
import type { FechaISO } from "@/lib/reglas/fechas";

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

export async function eventosUsuario(claims: ClaimsUsuario, ip: string | null, desde: FechaISO, hasta: FechaISO, hoy: FechaISO, casoId?: string): Promise<Evento[]> {
  const [pf, pp] = await Promise.all([parametrosFechas(hoy), parametrosPension(hoy)]);
  const casos = await conUsuario(claims, (tx) => tx.caso.findMany({
    where: { archivado_at: null, etapa: { notIn: ["PERDIDO", "CERRADO", "PENSION_OTORGADA"] }, ...(casoId ? { id: casoId } : {}) },
    select: {
      id: true, folio: true, etapa: true, tipo_servicio: true, fecha_limite_ingreso: true, fecha_ingreso_solicitud: true,
      fecha_limite_resolucion: true, fecha_resolucion: true, fecha_vencimiento_contrato: true,
      persona: { select: { nombre: true, fecha_nacimiento: true } },
      datos_imss: { select: { fecha_baja: true, regimen: true, semanas_totales: true } },
      datos_afore: { select: { estado_ultimo_retiro: true, fecha_ultimo_retiro: true } },
      pagos_m40: { where: { archivado_at: null }, select: { mes: true, fecha_limite: true, fecha_pago: true } },
    },
  }), ip);
  const fotos: CasoCalendario[] = casos.map((c) => ({
    id: c.id, folio: c.folio, etapa: c.etapa, servicio: c.tipo_servicio,
    nombre: c.persona.nombre.split(" ")[0],
    fechaBaja: iso(c.datos_imss?.fecha_baja), estadoUltimoRetiro: c.datos_afore?.estado_ultimo_retiro ?? "por_verificar",
    fechaUltimoRetiro: iso(c.datos_afore?.fecha_ultimo_retiro),
    fechaLimiteIngreso: iso(c.fecha_limite_ingreso), fechaIngresoSolicitud: iso(c.fecha_ingreso_solicitud),
    fechaLimiteResolucion: iso(c.fecha_limite_resolucion), fechaResolucion: iso(c.fecha_resolucion),
    fechaVencimientoContrato: iso(c.fecha_vencimiento_contrato), fechaNacimiento: iso(c.persona.fecha_nacimiento),
    regimen: c.datos_imss?.regimen ?? null, semanasCotizadas: c.datos_imss?.semanas_totales ? Number(c.datos_imss.semanas_totales) : null,
    pagosM40: c.pagos_m40.map((x) => ({ mes: iso(x.mes)!, fechaLimite: iso(x.fecha_limite)!, pagado: x.fecha_pago !== null })),
  }));
  return eventosEntre(fotos, desde, hasta, hoy, { ...pf, ...pp });
}
