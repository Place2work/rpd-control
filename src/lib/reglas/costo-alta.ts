// Costo administrativo por cada prospecto dado de alta. El monto sale del parámetro COSTO_ADMIN_ALTA con
// vigencia: cada alta se valúa con el costo vigente el día en que se dio de alta (si el costo cambia, las altas
// anteriores no cambian). Puras: dinero en centavos y redondeo al final.
import type { FechaISO } from "./fechas";

export type VigenciaCosto = { desde: FechaISO; hasta: FechaISO | null; monto: number };
export type Alta = { fecha: FechaISO; vendedorId: string | null };

/** Costo vigente en una fecha (0 si ese día no había costo configurado). */
export function costoVigente(fecha: FechaISO, vigencias: VigenciaCosto[]): number {
  return vigencias.find((v) => v.desde <= fecha && (v.hasta === null || v.hasta >= fecha))?.monto ?? 0;
}

/** Altas y costo de un periodo [desde, hasta] (fechas incluidas); sin límites, todo. */
export function costoAdministrativo(altas: Alta[], vigencias: VigenciaCosto[], periodo: { desde?: FechaISO; hasta?: FechaISO } = {}) {
  const dentro = altas.filter((a) => (!periodo.desde || a.fecha >= periodo.desde) && (!periodo.hasta || a.fecha <= periodo.hasta));
  const centavos = dentro.reduce((t, a) => t + Math.round(costoVigente(a.fecha, vigencias) * 100), 0);
  return { altas: dentro.length, total: centavos / 100 };
}

/** Una alta por persona: su primer caso (los demás servicios o un desvío de la misma persona no cuentan otra vez). */
export function altasPorPersona<T extends { personaId: string; fecha: FechaISO; vendedorId: string | null }>(casos: T[]): Alta[] {
  const vistas = new Set<string>();
  return [...casos].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
    .filter((c) => !vistas.has(c.personaId) && Boolean(vistas.add(c.personaId)))
    .map((c) => ({ fecha: c.fecha, vendedorId: c.vendedorId }));
}
