// Gerente de campo: semana de pago y lo que lleva por cobrar. Funciones puras: reciben `hoy`, las tarifas (de
// `parametros`, con vigencia) y los registros ya leídos. Dinero en centavos (enteros).
import { addDays, format, parseISO } from "date-fns";

export type FechaISO = string; // AAAA-MM-DD (fecha de la Ciudad de México)

/** Pesos escritos («20», «20.5», «1,250.00») a centavos, sin flotantes. */
export function centavos(pesos: string): number {
  const limpio = pesos.replace(/[,$\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) throw new Error(`Monto no válido: ${pesos}`);
  const [ent, dec = ""] = limpio.split(".");
  return Number(ent) * 100 + Number(dec.padEnd(2, "0"));
}

/** Semana de lunes a domingo que contiene la fecha, y el día en que se paga (domingo + N días; 3 = miércoles). */
export function semanaDe(fecha: FechaISO, diasParaPago: number) {
  const d = parseISO(fecha);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes
  const inicio = addDays(d, -dow);
  const fin = addDays(inicio, 6);
  const f = (x: Date) => format(x, "yyyy-MM-dd");
  return { inicio: f(inicio), fin: f(fin), pago: f(addDays(fin, diasParaPago)) };
}

export type Pieza = { id: string; fecha: FechaISO; montoCent: number; pagada: boolean };
export type Liquidacion = { semanaInicio: FechaISO; semanaFin: FechaISO; fechaPago: FechaISO; prospectos: string[]; dias: string[];
  montoProspectosCent: number; montoDiasCent: number; totalCent: number };

/**
 * Agrupa lo verificado (prospectos) y lo aprobado (días) que no se ha pagado por la semana en que se verificó o
 * aprobó: lo de lunes a domingo se paga el miércoles siguiente. Lo que se verifica después de un corte entra en el
 * pago siguiente. La `fecha` de cada pieza es la de su verificación o aprobación.
 */
export function porPagar(prospectos: Pieza[], dias: Pieza[], diasParaPago: number): Liquidacion[] {
  const grupos = new Map<string, Liquidacion>();
  const meter = (p: Pieza, tipo: "prospectos" | "dias") => {
    if (p.pagada) return;
    const s = semanaDe(p.fecha, diasParaPago);
    const g = grupos.get(s.fin) ?? { semanaInicio: s.inicio, semanaFin: s.fin, fechaPago: s.pago, prospectos: [], dias: [], montoProspectosCent: 0, montoDiasCent: 0, totalCent: 0 };
    g[tipo].push(p.id);
    if (tipo === "prospectos") g.montoProspectosCent += p.montoCent; else g.montoDiasCent += p.montoCent;
    g.totalCent = g.montoProspectosCent + g.montoDiasCent;
    grupos.set(s.fin, g);
  };
  prospectos.forEach((p) => meter(p, "prospectos"));
  dias.forEach((p) => meter(p, "dias"));
  return [...grupos.values()].sort((a, b) => a.semanaFin.localeCompare(b.semanaFin));
}

/** Una semana ya se puede pagar cuando su corte (domingo) pasó. */
export const semanaCerrada = (l: Pick<Liquidacion, "semanaFin">, hoy: FechaISO) => l.semanaFin < hoy;

export type Resumen = {
  verificados: { n: number; cent: number };
  enRevision: { n: number; centEstimado: number };
  rechazados: number;
  dias: { aprobados: number; cent: number; enRevision: number };
  porCobrarCent: number;
  pagadoCent: number;
  proximoPago: Liquidacion | null;
};

/**
 * Lo que el gerente ve: lo que ya tiene ganado por cobrar, lo que está en revisión (estimado con la tarifa vigente)
 * y su próximo pago.
 */
export function resumenGerente(
  prospectos: { estado: string; montoCent: number | null; pagada: boolean }[],
  dias: { estado: string; montoCent: number | null; pagada: boolean }[],
  liquidaciones: Liquidacion[], tarifaProspectoCent: number, pagadoCent: number, hoy: FechaISO,
): Resumen {
  const ver = prospectos.filter((p) => p.estado === "verificado" && !p.pagada);
  const rev = prospectos.filter((p) => p.estado === "pendiente");
  const dAp = dias.filter((d) => d.estado === "aprobada" && !d.pagada);
  const suma = (xs: { montoCent: number | null }[]) => xs.reduce((a, x) => a + (x.montoCent ?? 0), 0);
  const proximo = liquidaciones.find((l) => l.fechaPago >= hoy) ?? null;
  return {
    verificados: { n: ver.length, cent: suma(ver) },
    enRevision: { n: rev.length, centEstimado: rev.length * tarifaProspectoCent },
    rechazados: prospectos.filter((p) => p.estado === "rechazado").length,
    dias: { aprobados: dAp.length, cent: suma(dAp), enRevision: dias.filter((d) => d.estado === "pendiente").length },
    porCobrarCent: suma(ver) + suma(dAp),
    pagadoCent,
    proximoPago: proximo,
  };
}

/** WhatsApp de México a E.164 (+52 y 10 dígitos). null si no es válido. */
export function whatsappMx(texto: string): string | null {
  const d = texto.replace(/\D/g, "");
  const diez = d.length === 10 ? d : d.length === 12 && d.startsWith("52") ? d.slice(2) : d.length === 13 && d.startsWith("521") ? d.slice(3) : null;
  return diez ? `+52${diez}` : null;
}
