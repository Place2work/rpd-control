// Consultas de la pantalla Dinero (10.6). Todas con RLS: cada quien ve el dinero de los
// casos que opera (Director todo; socio los suyos; el vendedor no entra).
import "server-only";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { finDeMes } from "@/lib/reglas/comisiones";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);

export type FilaMes = { mes: string; cobros: number; total: number; subtotal: number; iva: number; depositado: number };

export async function resumenDinero(s: Sesion, mes: string) {
  const desde = dia(`${mes}-01`);
  const hasta = dia(finDeMes(mes));
  return conUsuario(s.claims, async (tx) => {
    const [cobrado, depositos, porCobrar, sinFactura, meses] = await Promise.all([
      tx.cobro.aggregate({ where: { estado: "cobrado", archivado_at: null, fecha_cobro: { gte: desde, lte: hasta } }, _sum: { honorario_total: true, subtotal: true, iva: true }, _count: true }),
      tx.pagoAfore.aggregate({ where: { archivado_at: null, fecha_deposito: { gte: desde, lte: hasta } }, _sum: { monto_neto: true, monto_bruto: true, isr_retenido: true }, _count: true }),
      tx.cobro.findMany({
        where: { estado: "por_cobrar", archivado_at: null },
        include: { pago_afore: { select: { numero: true, fecha_deposito: true } }, caso: { select: { id: true, folio: true, persona: { select: { nombre: true, apellido_paterno: true } } } } },
        orderBy: { created_at: "asc" },
      }),
      tx.cobro.findMany({
        where: { estado: "cobrado", archivado_at: null, OR: [{ factura_folio: null }, { factura_folio: "" }] },
        include: { caso: { select: { id: true, folio: true, persona: { select: { nombre: true, apellido_paterno: true } } } } },
        orderBy: { fecha_cobro: "desc" }, take: 50,
      }),
      tx.$queryRaw<FilaMes[]>`
        WITH m AS (SELECT to_char(d, 'YYYY-MM') AS mes FROM generate_series(date_trunc('month', ${desde}::date) - interval '11 months', ${desde}::date, interval '1 month') d)
        SELECT m.mes,
          (SELECT count(*)::int FROM cobros k WHERE k.estado = 'cobrado' AND k.archivado_at IS NULL AND to_char(k.fecha_cobro, 'YYYY-MM') = m.mes) AS cobros,
          (SELECT coalesce(sum(honorario_total), 0)::float FROM cobros k WHERE k.estado = 'cobrado' AND k.archivado_at IS NULL AND to_char(k.fecha_cobro, 'YYYY-MM') = m.mes) AS total,
          (SELECT coalesce(sum(subtotal), 0)::float FROM cobros k WHERE k.estado = 'cobrado' AND k.archivado_at IS NULL AND to_char(k.fecha_cobro, 'YYYY-MM') = m.mes) AS subtotal,
          (SELECT coalesce(sum(iva), 0)::float FROM cobros k WHERE k.estado = 'cobrado' AND k.archivado_at IS NULL AND to_char(k.fecha_cobro, 'YYYY-MM') = m.mes) AS iva,
          (SELECT coalesce(sum(monto_neto), 0)::float FROM pagos_afore p WHERE p.archivado_at IS NULL AND to_char(p.fecha_deposito, 'YYYY-MM') = m.mes) AS depositado
        FROM m ORDER BY m.mes DESC`,
    ]);
    return { cobrado, depositos, porCobrar, sinFactura, meses };
  }, s.ip);
}
