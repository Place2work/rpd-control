// Datos del costo administrativo por alta: altas visibles (con RLS) y las vigencias del parámetro.
import "server-only";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { altasPorPersona, type Alta, type VigenciaCosto } from "@/lib/reglas/costo-alta";
import { hoyCDMX } from "@/lib/tiempo";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Altas de prospectos: una por persona (varios servicios o un desvío son la misma alta), sin los archivados. */
export async function altasYCostos(s: Sesion): Promise<{ altas: Alta[]; vigencias: VigenciaCosto[] }> {
  return conUsuario(s.claims, async (tx) => {
    const [casos, params] = await Promise.all([
      tx.caso.findMany({ where: { archivado_at: null }, select: { persona_id: true, created_at: true, socio_id: true, costo_admin_alta: true }, orderBy: { created_at: "asc" } }),
      tx.parametro.findMany({ where: { clave: "COSTO_ADMIN_ALTA" }, orderBy: { vigente_desde: "asc" }, select: { valor: true, vigente_desde: true, vigente_hasta: true } }),
    ]);
    return {
      altas: altasPorPersona(casos.map((c) => ({ personaId: c.persona_id, fecha: hoyCDMX(c.created_at), asesorId: c.socio_id, costo: c.costo_admin_alta === null ? null : Number(c.costo_admin_alta) }))),
      vigencias: params.map((p) => ({ desde: iso(p.vigente_desde), hasta: p.vigente_hasta ? iso(p.vigente_hasta) : null, monto: Number(p.valor) })),
    };
  }, s.ip);
}
