// Periodo de los reportes: por defecto, del primer día del mes hace 11 meses a hoy.
import { sumarDias } from "@/lib/reglas/fechas";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function periodoDe(desde: string | null | undefined, hasta: string | null | undefined, hoy: string) {
  const [a, m] = hoy.split("-").map(Number);
  const t = a * 12 + (m - 1) - 11;
  const inicio = `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`;
  let d = desde && ISO.test(desde) ? desde : inicio;
  let h = hasta && ISO.test(hasta) ? hasta : hoy;
  if (d > h) [d, h] = [h, d];
  if (h > hoy) h = hoy;
  // Tope de 3 años para que una consulta no recorra toda la historia por error.
  if (d < sumarDias(h, -1096)) d = sumarDias(h, -1096);
  return { desde: d, hasta: h };
}
