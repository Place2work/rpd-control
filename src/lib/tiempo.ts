// Fecha de negocio en America/Mexico_City. Fuera de lib/reglas porque lee el reloj;
// las reglas reciben `hoy` ya calculado.
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

export const ZONA_NEGOCIO = "America/Mexico_City";

export function hoyCDMX(ahora: Date = new Date()): string {
  return format(new TZDate(ahora, ZONA_NEGOCIO), "yyyy-MM-dd");
}

export function horaCDMX(ahora: Date = new Date()): string {
  return format(new TZDate(ahora, ZONA_NEGOCIO), "HH:mm");
}

/** Instante en que empieza un día (YYYY-MM-DD) en la Ciudad de México, para filtrar timestamptz. */
export function inicioDiaCDMX(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(new TZDate(a, m - 1, d, 0, 0, 0, ZONA_NEGOCIO).getTime());
}
