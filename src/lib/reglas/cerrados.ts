// Clientes cerrados: ya retiraron (o recibieron el servicio) y ya pagaron el honorario. Puras: reciben `hoy`.
import { diasEntre, type FechaISO } from "./fechas";

export type ClienteCerrado = {
  afore?: string | null; // clave de la Afore (para su logotipo)
  id: string;
  folio: string;
  nombre: string;
  servicio: string;
  vendedorId: string | null;
  vendedor: string | null;
  cerradoEl: FechaISO; // día en que pasó a «Honorario cobrado»
  deposito: { fecha: FechaISO; neto: number } | null; // retiro: pago de la Afore
  honorario: number | null; // null si quien consulta no ve dinero (vendedor)
  comprobantes: { con: number; de: number };
  proximoRetiro: FechaISO | null;
};

export type FiltrosCerrados = { mes?: string; vendedor?: string; proximos?: number };

/** Mes YYYY-MM, vendedor (id o «sin») y «próximo retiro en los siguientes N días». */
export function filtrarCerrados(filas: ClienteCerrado[], f: FiltrosCerrados, hoy: FechaISO): ClienteCerrado[] {
  return filas.filter((c) => {
    if (f.mes && !c.cerradoEl.startsWith(f.mes)) return false;
    if (f.vendedor === "sin" ? c.vendedorId !== null : f.vendedor && c.vendedorId !== f.vendedor) return false;
    if (f.proximos !== undefined) {
      if (!c.proximoRetiro) return false;
      const d = diasEntre(hoy, c.proximoRetiro);
      if (d < 0 || d > f.proximos) return false;
    }
    return true;
  });
}

/** Contadores de la parte de arriba: del mes, del año, total y honorario cobrado (de lo que se ve). */
export function resumenCerrados(filas: ClienteCerrado[], hoy: FechaISO) {
  const mes = hoy.slice(0, 7), anio = hoy.slice(0, 4);
  const honorarios = filas.map((c) => c.honorario).filter((x): x is number => x !== null);
  return {
    delMes: filas.filter((c) => c.cerradoEl.startsWith(mes)).length,
    delAnio: filas.filter((c) => c.cerradoEl.startsWith(anio)).length,
    total: filas.length,
    honorario: honorarios.length ? Math.round(honorarios.reduce((a, x) => a + Math.round(x * 100), 0)) / 100 : null,
    sinComprobante: filas.filter((c) => c.comprobantes.con < c.comprobantes.de).length,
  };
}

// ───────────── Embudo del mes (pantalla Hoy) ─────────────

export type MovimientoMes = { casoId: string; etapa: string };
export type PagoMes = { casoId: string; neto: number };

// Solo etapas por las que el caso pasó de verdad: el salto automático a «Pagado»/«cerrado» por dinero
// no cuenta como precalificado ni como contrato.
const DESDE_PRECALIFICADO = new Set(["PRECALIFICADO", "EN_ESPERA", "CONTRATO", "EXPEDIENTE", "INGRESADA", "RESOLUCION"]);
const DESDE_CONTRATO = new Set(["CONTRATO", "EXPEDIENTE", "INGRESADA", "RESOLUCION"]);

/**
 * Lo que pasó en el mes (no la cohorte de altas): altas, casos que llegaron a precalificado o a contrato,
 * retiros que pagó la Afore y cuánto se retiró. Un caso cuenta una vez por renglón.
 */
export function embudoDelMes(altas: number, movimientos: MovimientoMes[], pagos: PagoMes[]) {
  const casos = (etapas: Set<string>) => new Set(movimientos.filter((m) => etapas.has(m.etapa)).map((m) => m.casoId));
  const pagados = new Set([...pagos.map((p) => p.casoId), ...casos(new Set(["PAGADO", "CERRADO"]))]);
  return {
    altas,
    precalificados: casos(DESDE_PRECALIFICADO).size,
    contratos: casos(DESDE_CONTRATO).size,
    pagados: pagados.size,
    retirado: Math.round(pagos.reduce((a, p) => a + Math.round(p.neto * 100), 0)) / 100,
  };
}
