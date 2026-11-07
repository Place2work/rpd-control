// Datos del costo administrativo por alta: altas visibles (con RLS) y las vigencias del parámetro.
import "server-only";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import type { Alta, VigenciaCosto } from "@/lib/reglas/costo-alta";
import { hoyCDMX } from "@/lib/tiempo";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Altas de prospectos: un caso por persona (los desvíos son la misma persona) y sin los archivados. */
export async function altasYCostos(s: Sesion): Promise<{ altas: Alta[]; vigencias: VigenciaCosto[] }> {
  return conUsuario(s.claims, async (tx) => {
    const [casos, params] = await Promise.all([
      tx.caso.findMany({ where: { archivado_at: null, caso_origen_id: null }, select: { created_at: true, vendedor_id: true } }),
      tx.parametro.findMany({ where: { clave: "COSTO_ADMIN_ALTA" }, orderBy: { vigente_desde: "asc" }, select: { valor: true, vigente_desde: true, vigente_hasta: true } }),
    ]);
    return {
      altas: casos.map((c) => ({ fecha: hoyCDMX(c.created_at), vendedorId: c.vendedor_id })),
      vigencias: params.map((p) => ({ desde: iso(p.vigente_desde), hasta: p.vigente_hasta ? iso(p.vigente_hasta) : null, monto: Number(p.valor) })),
    };
  }, s.ip);
}
