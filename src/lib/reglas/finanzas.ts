// Datos de las gráficas de finanzas de Hoy (puras: reciben `hoy`, nunca leen la BD ni el reloj).
// Dinero en centavos mientras se suma; redondeo al final.
import type { FechaISO } from "./fechas";

const cent = (x: number) => Math.round(x * 100);
const pesos = (c: number) => Math.round(c) / 100;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export type PasoCascada = { etiqueta: string; tipo: "ingreso" | "descuento" | "total"; monto: number; base: number; valor: number };

/** Cascada de la ganancia proyectada: cobrado + por cobrar y proyectado («Proyectado») − comisiones − altas = ganancia. */
export function cascadaGanancia(e: { cobrado: number; proyectado: number; comisiones: number; altas: number }): PasoCascada[] {
  let corrido = 0;
  const pasos: PasoCascada[] = [];
  const sube = (etiqueta: string, m: number) => { const c = cent(m); pasos.push({ etiqueta, tipo: "ingreso", monto: pesos(c), base: pesos(corrido), valor: pesos(c) }); corrido += c; };
  const baja = (etiqueta: string, m: number) => {
    const c = cent(m); const piso = corrido - c;
    pasos.push({ etiqueta, tipo: "descuento", monto: pesos(c), base: pesos(Math.max(0, piso)), valor: pesos(Math.max(0, corrido) - Math.max(0, piso)) });
    corrido = piso;
  };
  sube("Cobrado", e.cobrado);
  sube("Proyectado", e.proyectado);
  baja("Comisiones", e.comisiones);
  baja("Altas", e.altas);
  pasos.push({ etiqueta: "Ganancia", tipo: "total", monto: pesos(corrido), base: 0, valor: pesos(corrido) });
  return pasos;
}

export type MesFlujo = { mes: string; etiqueta: string; cobrado: number; proyectado: number };

/**
 * Honorarios por mes: cobrados (meses pasados y el actual) y proyectados (por la fecha estimada del depósito de la
 * Afore). Lo por cobrar, lo proyectado sin fecha o con fecha ya vencida cae en el mes actual; lo que pasa del
 * horizonte va en «Después».
 */
export function flujoHonorarios(e: {
  hoy: FechaISO; cobradosPorMes: { mes: string; total: number }[]; porCobrar: number;
  proyectados: { fecha: FechaISO | null; honorario: number }[]; mesesAtras?: number; mesesAdelante?: number;
}): MesFlujo[] {
  const atras = e.mesesAtras ?? 5, adelante = e.mesesAdelante ?? 6;
  const [a, m] = e.hoy.slice(0, 7).split("-").map(Number);
  const actual = e.hoy.slice(0, 7);
  const filas = new Map<string, { cobrado: number; proyectado: number }>();
  const lista: string[] = [];
  for (let i = -atras; i <= adelante; i++) {
    const d = new Date(Date.UTC(a, m - 1 + i, 1));
    const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    lista.push(k); filas.set(k, { cobrado: 0, proyectado: 0 });
  }
  const ultimo = lista[lista.length - 1];
  let despues = 0;
  for (const c of e.cobradosPorMes) { const f = filas.get(c.mes); if (f) f.cobrado += cent(c.total); }
  filas.get(actual)!.proyectado += cent(e.porCobrar);
  for (const p of e.proyectados) {
    const k = p.fecha ? p.fecha.slice(0, 7) : actual;
    if (k > ultimo) despues += cent(p.honorario);
    else filas.get(k < actual ? actual : k)!.proyectado += cent(p.honorario);
  }
  const r: MesFlujo[] = lista.map((k, i) => ({ mes: k, etiqueta: i === 0 || k.endsWith("-01") ? `${MESES[Number(k.slice(5)) - 1]} ${k.slice(2, 4)}` : MESES[Number(k.slice(5)) - 1], cobrado: pesos(filas.get(k)!.cobrado), proyectado: pesos(filas.get(k)!.proyectado) }));
  if (despues > 0) r.push({ mes: "despues", etiqueta: "Después", cobrado: 0, proyectado: pesos(despues) });
  return r;
}
