// Premios: el premio vigente y las fechas en que cada caso de retiro llegó a «Honorario cobrado» (por asesor de
// pensiones). Con la sesión de quien consulta: el asesor solo ve sus casos; el Director, todos.
import "server-only";
import type { Tx } from "@/lib/db/prisma";
import { hoyCDMX } from "@/lib/tiempo";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function premiosVigentes(tx: Tx) {
  const hoy = new Date(`${hoyCDMX()}T00:00:00Z`);
  const ps = await tx.premio.findMany({ where: { activo: true, archivado_at: null, desde: { lte: hoy }, OR: [{ hasta: null }, { hasta: { gte: hoy } }] },
    orderBy: { created_at: "asc" }, select: { id: true, nombre: true, descripcion: true, meta: true, desde: true, hasta: true } });
  return ps.map((p) => ({ ...p, desde: iso(p.desde), hasta: p.hasta ? iso(p.hasta) : null }));
}

/** socio_id → fechas (CDMX) en que cada caso de retiro cerrado llegó a «Honorario cobrado» (la última vez). */
export async function cierresRetiroPorSocio(tx: Tx): Promise<Map<string, string[]>> {
  const casos = await tx.caso.findMany({
    where: { tipo_servicio: "RETIRO_DESEMPLEO", etapa: "CERRADO", archivado_at: null, socio_id: { not: null } },
    select: { socio_id: true, historial: { where: { etapa_nueva: "CERRADO" }, orderBy: { fecha: "desc" }, take: 1, select: { fecha: true } } },
  });
  const m = new Map<string, string[]>();
  for (const c of casos) {
    const f = c.historial[0]?.fecha;
    if (!f || !c.socio_id) continue;
    m.set(c.socio_id, [...(m.get(c.socio_id) ?? []), hoyCDMX(f)]);
  }
  return m;
}
