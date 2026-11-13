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

export type PanelFinanciero = {
  porPagar: { cent: number; prospectos: number; dias: number };
  enRevision: { centEstimado: number; prospectos: number; dias: number };
  proyeccionCent: number;
  proximoPago: { fecha: FechaISO; cent: number } | null;
  pagado: { mesCent: number; totalCent: number };
  prospectos: { total: number; semana: number; mes: number; verificados: number; pendientes: number; rechazados: number };
  tasaVerificacion: number | null; // % de los revisados que sí se verificaron
  costoPorVerificadoCent: number | null; // (pagado + por pagar) / verificados
};

/**
 * Panel financiero del Director (gerente de campo): lo que se debe, lo que viene si se verifica lo pendiente
 * (estimado con la tarifa vigente; los días con la tarifa base), lo pagado y cuántos prospectos llegan.
 */
export function panelFinanciero(
  prospectos: { estado: string; montoCent: number | null; pagada: boolean; fechaRegistro: FechaISO }[],
  dias: { estado: string; montoCent: number | null; pagada: boolean }[],
  pagos: { fechaPago: FechaISO; totalCent: number }[],
  liquidaciones: Liquidacion[], tarifas: { prospectoCent: number; diaCent: number }, hoy: FechaISO,
): PanelFinanciero {
  const suma = (xs: { montoCent: number | null }[]) => xs.reduce((a, x) => a + (x.montoCent ?? 0), 0);
  const ver = prospectos.filter((p) => p.estado === "verificado");
  const verSinPagar = ver.filter((p) => !p.pagada);
  const pend = prospectos.filter((p) => p.estado === "pendiente");
  const rech = prospectos.filter((p) => p.estado === "rechazado");
  const dAp = dias.filter((d) => d.estado === "aprobada" && !d.pagada);
  const dPend = dias.filter((d) => d.estado === "pendiente");
  const porPagarCent = suma(verSinPagar) + suma(dAp);
  const enRevCent = pend.length * tarifas.prospectoCent + dPend.length * tarifas.diaCent;
  const semana = semanaDe(hoy, 0);
  const mes = hoy.slice(0, 7);
  const totalPagado = pagos.reduce((a, p) => a + p.totalCent, 0);
  const proximo = liquidaciones.find((l) => l.fechaPago >= hoy) ?? liquidaciones[0] ?? null;
  const revisados = ver.length + rech.length;
  return {
    porPagar: { cent: porPagarCent, prospectos: verSinPagar.length, dias: dAp.length },
    enRevision: { centEstimado: enRevCent, prospectos: pend.length, dias: dPend.length },
    proyeccionCent: porPagarCent + enRevCent,
    proximoPago: proximo ? { fecha: proximo.fechaPago, cent: proximo.totalCent } : null,
    pagado: { mesCent: pagos.filter((p) => p.fechaPago.slice(0, 7) === mes).reduce((a, p) => a + p.totalCent, 0), totalCent: totalPagado },
    prospectos: {
      total: prospectos.length, semana: prospectos.filter((p) => p.fechaRegistro >= semana.inicio && p.fechaRegistro <= semana.fin).length,
      mes: prospectos.filter((p) => p.fechaRegistro.slice(0, 7) === mes).length, verificados: ver.length, pendientes: pend.length, rechazados: rech.length,
    },
    tasaVerificacion: revisados ? Math.round((ver.length / revisados) * 100) : null,
    costoPorVerificadoCent: ver.length ? Math.round((totalPagado + porPagarCent) / ver.length) : null,
  };
}

/** Suma los paneles de varios gerentes (el próximo pago es el más cercano; los cocientes se recalculan). */
export function sumarPaneles(ps: PanelFinanciero[]): PanelFinanciero {
  const s = (f: (p: PanelFinanciero) => number) => ps.reduce((a, p) => a + f(p), 0);
  const ver = s((p) => p.prospectos.verificados), rech = s((p) => p.prospectos.rechazados);
  const fechas = ps.map((p) => p.proximoPago).filter((x): x is { fecha: FechaISO; cent: number } => Boolean(x)).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const proximo = fechas.length ? { fecha: fechas[0].fecha, cent: fechas.filter((f) => f.fecha === fechas[0].fecha).reduce((a, f) => a + f.cent, 0) } : null;
  const porPagar = s((p) => p.porPagar.cent), pagado = s((p) => p.pagado.totalCent);
  return {
    porPagar: { cent: porPagar, prospectos: s((p) => p.porPagar.prospectos), dias: s((p) => p.porPagar.dias) },
    enRevision: { centEstimado: s((p) => p.enRevision.centEstimado), prospectos: s((p) => p.enRevision.prospectos), dias: s((p) => p.enRevision.dias) },
    proyeccionCent: s((p) => p.proyeccionCent),
    proximoPago: proximo,
    pagado: { mesCent: s((p) => p.pagado.mesCent), totalCent: pagado },
    prospectos: { total: s((p) => p.prospectos.total), semana: s((p) => p.prospectos.semana), mes: s((p) => p.prospectos.mes), verificados: ver,
      pendientes: s((p) => p.prospectos.pendientes), rechazados: rech },
    tasaVerificacion: ver + rech ? Math.round((ver / (ver + rech)) * 100) : null,
    costoPorVerificadoCent: ver ? Math.round((pagado + porPagar) / ver) : null,
  };
}
