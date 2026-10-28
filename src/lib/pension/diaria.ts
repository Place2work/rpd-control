// Parte de pensión de la tarea diaria (8.1): M40_*, VENTANA_12_MESES, EDAD_PENSION,
// CONSERVACION_DERECHOS e INFONAVIT_70. Proceso del sistema, como el resto de la tarea.
import "server-only";
import { prismaSistema } from "@/lib/db/prisma";
import { parametrosPension } from "@/lib/parametros";
import { alertasPension, type CasoPension } from "@/lib/reglas/pension";
import { hoyCDMX } from "@/lib/tiempo";

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const SERVICIOS = ["PENSION_L73", "PENSION_L97", "MODALIDAD_40", "PTI_M10", "DEVOLUCION_INFONAVIT"];

export async function tareaPension(hoy = hoyCDMX()) {
  const db = prismaSistema;
  const p = await parametrosPension(hoy);
  const casos = await db.caso.findMany({
    where: { archivado_at: null, OR: [{ tipo_servicio: { in: SERVICIOS } }, { pagos_m40: { some: { archivado_at: null } } }] },
    select: {
      id: true, folio: true, etapa: true, tipo_servicio: true, asignado_a: true,
      persona: { select: { nombre: true, apellido_paterno: true, fecha_nacimiento: true } },
      datos_imss: { select: { regimen: true, fecha_baja: true, semanas_totales: true } },
      pagos_m40: { where: { archivado_at: null }, select: { id: true, mes: true, fecha_limite: true, fecha_pago: true } },
    },
  });
  const fotos: CasoPension[] = casos.map((c) => ({
    id: c.id, folio: c.folio, etapa: c.etapa, servicio: c.tipo_servicio,
    nombre: [c.persona.nombre, c.persona.apellido_paterno].filter(Boolean).join(" "),
    regimen: c.datos_imss?.regimen ?? null, fechaNacimiento: iso(c.persona.fecha_nacimiento), fechaBaja: iso(c.datos_imss?.fecha_baja),
    semanasCotizadas: c.datos_imss?.semanas_totales ? Number(c.datos_imss.semanas_totales) : null,
    pagosM40: c.pagos_m40.map((x) => ({ id: x.id, mes: iso(x.mes)!, fechaLimite: iso(x.fecha_limite)!, fechaPago: iso(x.fecha_pago) })),
  }));
  const directores = (await db.usuario.findMany({ where: { rol: "director", activo: true, archivado_at: null }, select: { id: true } })).map((u) => u.id);
  const asesorDe = new Map(casos.map((c) => [c.id, c.asignado_a]));
  const filas = alertasPension(fotos, hoy, p).flatMap((a) => {
    const para = new Set<string>();
    for (const d of a.para) {
      if (d === "director") directores.forEach((x) => para.add(x));
      if (d === "asesor") { const u = asesorDe.get(a.casoId); (u ? [u] : directores).forEach((x) => para.add(x)); }
    }
    return [...para].map((u) => ({ regla: a.regla, caso_id: a.casoId, severidad: a.severidad, mensaje: a.mensaje, fecha_disparo: new Date(`${hoy}T00:00:00Z`), asignado_a: u, clave_dedup: a.clave }));
  });
  const creadas = filas.length ? await db.alerta.createMany({ data: filas, skipDuplicates: true }) : { count: 0 };
  return { casos_pension: casos.length, alertas_pension: creadas.count };
}
