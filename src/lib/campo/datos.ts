// Gerente de campo: tarifas vigentes a una fecha y liquidaciones pendientes (CAMPO_*, con vigencia).
import "server-only";
import { parametrosVigentes } from "@/lib/parametros";
import { centavos, porPagar, type Liquidacion, type Pieza } from "@/lib/reglas/campo";
import { hoyCDMX } from "@/lib/tiempo";
import type { Tx } from "@/lib/db/prisma";

export async function tarifasCampo(fecha = hoyCDMX()) {
  const p = await parametrosVigentes(["CAMPO_PAGO_PROSPECTO", "CAMPO_PAGO_DIA", "CAMPO_DIAS_PARA_PAGO"], fecha);
  const dias = Number(p.CAMPO_DIAS_PARA_PAGO);
  if (!p.CAMPO_PAGO_PROSPECTO || !p.CAMPO_PAGO_DIA || !Number.isInteger(dias)) throw new Error("Faltan las tarifas del gerente de campo (CAMPO_*) en Configuración.");
  return { prospectoCent: centavos(p.CAMPO_PAGO_PROSPECTO), diaCent: centavos(p.CAMPO_PAGO_DIA), diasParaPago: dias };
}

const dia = (d: Date) => hoyCDMX(d);

/** Lo verificado y aprobado sin pagar de un gerente, agrupado por semana de pago. Con la sesión de quien consulta. */
export async function liquidacionesDe(tx: Tx, gerenteId: string, diasParaPago: number): Promise<Liquidacion[]> {
  const [ps, js] = await Promise.all([
    tx.campoProspecto.findMany({ where: { gerente_id: gerenteId, estado: "verificado", pago_id: null, archivado_at: null }, select: { id: true, verificado_at: true, monto_cent: true } }),
    tx.campoJornada.findMany({ where: { gerente_id: gerenteId, estado: "aprobada", pago_id: null }, select: { id: true, revisada_at: true, monto_cent: true } }),
  ]);
  const piezasP: Pieza[] = ps.map((p) => ({ id: p.id, fecha: dia(p.verificado_at!), montoCent: Number(p.monto_cent ?? 0), pagada: false }));
  const piezasD: Pieza[] = js.map((j) => ({ id: j.id, fecha: dia(j.revisada_at!), montoCent: Number(j.monto_cent ?? 0), pagada: false }));
  return porPagar(piezasP, piezasD, diasParaPago);
}
