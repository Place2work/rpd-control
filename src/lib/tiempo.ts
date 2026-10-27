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
