// Costo administrativo por cada prospecto dado de alta. El monto sale del parámetro COSTO_ADMIN_ALTA con
// vigencia: cada alta se valúa con el costo vigente el día en que se dio de alta (si el costo cambia, las altas
// anteriores no cambian). Un alta puede llevar su propio costo (p. ej. $0 en una pensión) que manda sobre el
// general. Puras: dinero en centavos y redondeo al final.
import type { FechaISO } from "./fechas";

export type VigenciaCosto = { desde: FechaISO; hasta: FechaISO | null; monto: number };
/** costo: el propio de esa alta (null o ausente = el general vigente ese día). */
export type Alta = { fecha: FechaISO; asesorId: string | null; costo?: number | null };

/** Costo vigente en una fecha (0 si ese día no había costo configurado). */
export function costoVigente(fecha: FechaISO, vigencias: VigenciaCosto[]): number {
  return vigencias.find((v) => v.desde <= fecha && (v.hasta === null || v.hasta >= fecha))?.monto ?? 0;
}

/** Altas y costo de un periodo [desde, hasta] (fechas incluidas); sin límites, todo. */
export function costoAdministrativo(altas: Alta[], vigencias: VigenciaCosto[], periodo: { desde?: FechaISO; hasta?: FechaISO } = {}) {
  const dentro = altas.filter((a) => (!periodo.desde || a.fecha >= periodo.desde) && (!periodo.hasta || a.fecha <= periodo.hasta));
  const centavos = dentro.reduce((t, a) => t + Math.round((a.costo ?? costoVigente(a.fecha, vigencias)) * 100), 0);
  return { altas: dentro.length, total: centavos / 100 };
}

/** Una alta por persona: su primer caso (los demás servicios o un desvío de la misma persona no cuentan otra vez). */
export function altasPorPersona<T extends { personaId: string; fecha: FechaISO; asesorId: string | null; costo?: number | null }>(casos: T[]): Alta[] {
  const vistas = new Set<string>();
  return [...casos].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
    .filter((c) => !vistas.has(c.personaId) && Boolean(vistas.add(c.personaId)))
    .map((c) => ({ fecha: c.fecha, asesorId: c.asesorId, ...(c.costo != null ? { costo: c.costo } : {}) }));
}

/** Lee el costo propio de un alta escrito por el Director: vacío = el general; 0 o más, en pesos. */
export function leerCostoAlta(texto: string): { costo: number | null } | { error: string } {
  const t = texto.replace(/[$,\s]/g, "");
  if (!t) return { costo: null };
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(t)) return { error: "Escribe el monto en pesos, por ejemplo 0, 500 u 800" };
  const n = Number(t);
  if (n > 1_000_000) return { error: "El monto es demasiado alto" };
  return { costo: Math.round(n * 100) / 100 };
}

/**
 * Costo administrativo del alta de una persona: el propio de su alta o, si no tiene, el general vigente el día
 * del alta. Es el mismo que se descuenta del reparto del asesor de pensiones (un solo costo administrativo).
 */
export function costoDeAlta(propio: number | null | undefined, fechaAlta: FechaISO, vigencias: VigenciaCosto[]): number {
  return propio ?? costoVigente(fechaAlta, vigencias);
}
