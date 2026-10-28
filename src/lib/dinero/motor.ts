// Concilia las comisiones guardadas con lo que dice el motor (src/lib/reglas/comisiones.ts).
// Corre como proceso del sistema, igual que la tarea diaria: las comisiones solo las escribe
// el motor o el Director (RLS), y aquí se llama después de que el usuario ya registró, con sus
// permisos, el pago o el cobro que las origina. Las comisiones pagadas no se tocan nunca.
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prismaSistema } from "@/lib/db/prisma";
import { parametrosDinero } from "@/lib/parametros";
import { comisionesDelCaso, conciliar, type ComisionDeseada, type Esquema, type EsquemasCaso, type ReglaEsquema } from "@/lib/reglas/comisiones";
import { hoyCDMX } from "@/lib/tiempo";

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const dia = (f: string | null) => (f ? new Date(`${f}T00:00:00Z`) : null);
const n = (d: Prisma.Decimal | null | undefined) => (d == null ? null : Number(d));

async function esquemasVigentes(hoy: string) {
  const d = dia(hoy)!;
  const filas = await prismaSistema.esquemaComision.findMany({
    where: { vigente_desde: { lte: d }, OR: [{ vigente_hasta: null }, { vigente_hasta: { gte: d } }] },
    orderBy: { version: "desc" },
  });
  return (tipo: "vendedor" | "referido" | "socio", servicio: string): Esquema | null => {
    const f = filas.find((e) => e.tipo === tipo && (e.tipo_servicio === servicio || (tipo === "referido" && e.tipo_servicio === null)));
    return f ? { id: f.id, reglas: f.reglas as ReglaEsquema } : null;
  };
}

/** Cuántos casos de cada referidor tuvieron su primer honorario cobrado en cada mes. */
async function referidosPorMes(referidores: string[]): Promise<Map<string, Record<string, number>>> {
  const r = new Map<string, Record<string, number>>();
  if (!referidores.length) return r;
  const filas = await prismaSistema.$queryRaw<{ referidor_id: string; mes: string; n: number }[]>`
    SELECT referidor_id::text, to_char(primero, 'YYYY-MM') AS mes, count(*)::int AS n FROM (
      SELECT c.referidor_id, min(k.fecha_cobro) AS primero
      FROM casos c JOIN cobros k ON k.caso_id = c.id AND k.estado = 'cobrado' AND k.archivado_at IS NULL
      WHERE c.referidor_id = ANY(${referidores}::uuid[]) AND c.archivado_at IS NULL
      GROUP BY c.id, c.referidor_id
    ) x GROUP BY 1, 2`;
  for (const f of filas) r.set(f.referidor_id, { ...(r.get(f.referidor_id) ?? {}), [f.mes]: f.n });
  return r;
}

const datos = (d: ComisionDeseada) => ({
  tipo: d.tipo, esquema_id: d.esquemaId, beneficiario_tipo: d.beneficiarioTipo, beneficiario_id: d.beneficiarioId,
  pago_afore_id: d.pagoAforeId, cobro_id: d.cobroId, componente: d.componente, base: d.base, regla_aplicada: d.regla,
  monto: d.monto, estado: d.estado, fecha_devengo: dia(d.fechaDevengo), periodo: dia(d.periodo),
});

/**
 * Recalcula las comisiones de los casos dados. Si alguno tiene referidor, también los demás
 * casos de ese referidor: el escalón del mes depende de cuántos sumó (9.1).
 */
export async function recalcularComisiones(casoIds: string[], hoy = hoyCDMX()) {
  if (!casoIds.length) return { creadas: 0, actualizadas: 0, canceladas: 0 };
  const db = prismaSistema;
  const conReferidor = await db.caso.findMany({ where: { id: { in: casoIds }, referidor_id: { not: null } }, select: { referidor_id: true } });
  const refs = [...new Set(conReferidor.map((c) => c.referidor_id!))];
  const hermanos = refs.length ? await db.caso.findMany({ where: { referidor_id: { in: refs }, archivado_at: null }, select: { id: true } }) : [];
  const ids = [...new Set([...casoIds, ...hermanos.map((h) => h.id)])];

  const [p, esquema, conteos] = await Promise.all([parametrosDinero(hoy), esquemasVigentes(hoy), referidosPorMes(refs)]);
  const casos = await db.caso.findMany({
    where: { id: { in: ids } },
    include: {
      socio: { select: { id: true, porcentaje_socio: true, costo_administrativo: true } },
      calculos: { orderBy: { created_at: "desc" }, take: 1, select: { monto_estimado: true } },
      pagos_afore: { where: { archivado_at: null }, orderBy: { numero: "asc" } },
      cobros: { where: { archivado_at: null } },
      comisiones: { where: { archivado_at: null } },
    },
  });

  const total = { creadas: 0, actualizadas: 0, canceladas: 0 };
  for (const c of casos) {
    const esquemas: EsquemasCaso = {
      vendedor: esquema("vendedor", c.tipo_servicio), referidor: esquema("referido", c.tipo_servicio), socio: esquema("socio", c.tipo_servicio),
    };
    const deseadas = comisionesDelCaso({
      id: c.id, tipoServicio: c.tipo_servicio,
      contratoFirmado: c.fecha_contrato !== null,
      perdido: c.etapa === "PERDIDO" || c.archivado_at !== null,
      montoEstimado: n(c.calculos[0]?.monto_estimado),
      vendedorId: c.vendedor_id, referidorId: c.referidor_id,
      socio: c.socio ? { id: c.socio.id, pct: Number(c.socio.porcentaje_socio), costoAdmin: Number(c.socio.costo_administrativo) } : null,
      pagos: c.pagos_afore.map((x) => ({ id: x.id, numero: x.numero, fecha: iso(x.fecha_deposito)!, bruto: Number(x.monto_bruto), isr: Number(x.isr_retenido), neto: Number(x.monto_neto) })),
      cobros: c.cobros.map((x) => ({ id: x.id, pagoAforeId: x.pago_afore_id, concepto: x.concepto, base: n(x.base_calculo), honorario: Number(x.honorario_total),
        subtotal: Number(x.subtotal), iva: Number(x.iva), estado: x.estado, fecha: iso(x.fecha_cobro) })),
    }, esquemas, p, hoy, c.referidor_id ? conteos.get(c.referidor_id) : undefined);

    const cambios = conciliar(deseadas, c.comisiones.map((g) => ({
      id: g.id, clave: g.clave, estado: g.estado, monto: Number(g.monto), base: Number(g.base), regla: g.regla_aplicada,
      fechaDevengo: iso(g.fecha_devengo), beneficiarioId: g.beneficiario_id,
    })));
    if (!cambios.crear.length && !cambios.actualizar.length && !cambios.cancelar.length) continue;
    await db.$transaction(async (tx) => {
      // Primero se cancelan (libera la clave del índice único) y luego se crean.
      if (cambios.cancelar.length) await tx.comision.updateMany({ where: { id: { in: cambios.cancelar }, estado: { not: "pagada" } }, data: { estado: "cancelada" } });
      for (const u of cambios.actualizar) await tx.comision.update({ where: { id: u.id }, data: datos(u.deseada) });
      for (const d of cambios.crear) await tx.comision.create({ data: { caso_id: c.id, clave: d.clave, ...datos(d) } });
    });
    total.creadas += cambios.crear.length;
    total.actualizadas += cambios.actualizar.length;
    total.canceladas += cambios.cancelar.length;
  }
  return total;
}
