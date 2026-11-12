// Métricas de desempeño y coaching (CAPACITACION.md 10). Funciones puras: reciben los hechos del CRM ya leídos,
// `ahora`, las metas vigentes (cap_metas) y los parámetros (horas de primer contacto, días para atender una alerta).
import { addDays, parseISO, format } from "date-fns";
import { hoyCDMX } from "../tiempo";

export type CasoDesempeno = {
  creado: string; // ISO
  primerContacto: string | null; // ISO del primer contacto humano (llamada, WhatsApp, correo, nota)
  precalificado: boolean;
  resultado: string | null; // último resultado de precalificación
  contrato: boolean;
  docsRecibidos: number;
  docsRechazados: number;
  bloqueado: boolean;
  ley73: boolean;
  analisisImpacto: boolean;
  desviado: boolean; // existe un caso de desvío que nace de este
  referido: boolean; // la persona llegó referida
};
export type AlertaDesempeno = { disparo: string; atendida: string | null }; // disparo YYYY-MM-DD, atendida ISO
export type ParametrosDesempeno = { horasContacto: number; diasAlerta: number };

export type ClaveMetrica = "contacto_24h" | "prospecto_precalificado" | "apto_contrato" | "expediente_primera" | "bloqueados" | "l73_analisis" | "no_conviene_desvio" | "alertas_a_tiempo" | "linea_roja" | "referidos";
export type Metrica = {
  clave: ClaveMetrica;
  titulo: string;
  sentido: "minimo" | "maximo" | "seguimiento"; // minimo: la meta es un piso (≥); maximo: un techo (≤)
  numerador: number;
  denominador: number | null; // null: es un conteo, no un porcentaje
  valor: number | null; // proporción 0–1 (o conteo); null sin datos
  meta: number | null;
  cumple: boolean | null;
  modulo: string | null; // lección que se sugiere repasar
};

const DEF: { clave: ClaveMetrica; titulo: string; sentido: Metrica["sentido"]; modulo: string | null }[] = [
  { clave: "contacto_24h", titulo: "Primer contacto a tiempo", sentido: "minimo", modulo: "R1-07" },
  { clave: "prospecto_precalificado", titulo: "Prospecto → precalificado", sentido: "minimo", modulo: "R1-05" },
  { clave: "apto_contrato", titulo: "Apto → contrato", sentido: "minimo", modulo: "R1-07" },
  { clave: "expediente_primera", titulo: "Expediente completo a la primera", sentido: "minimo", modulo: "R1-06" },
  { clave: "bloqueados", titulo: "Casos en Bloqueado", sentido: "maximo", modulo: "R1-06" },
  { clave: "l73_analisis", titulo: "Ley 73 con análisis de impacto antes del contrato", sentido: "minimo", modulo: "R2-01" },
  { clave: "no_conviene_desvio", titulo: "«Califica, no conviene» → asesoría de pensión", sentido: "minimo", modulo: "R2-02" },
  { clave: "alertas_a_tiempo", titulo: "Alertas atendidas a tiempo", sentido: "minimo", modulo: "N0-04" },
  { clave: "linea_roja", titulo: "Incidencias de línea roja", sentido: "maximo", modulo: "N0-02" },
  { clave: "referidos", titulo: "Referidos de clientes", sentido: "seguimiento", modulo: null },
];

const proporcion = (n: number, d: number) => (d > 0 ? n / d : null);

export function calcularDesempeno(
  casos: CasoDesempeno[], alertas: AlertaDesempeno[], lineaRoja: number,
  metas: Partial<Record<ClaveMetrica, number>>, p: ParametrosDesempeno, ahora: string,
): Metrica[] {
  const t = parseISO(ahora).getTime();
  const limite = p.horasContacto * 3600e3;
  // Contacto: a tiempo si llegó dentro del plazo; tarde si llegó después o si ya venció sin contacto. Los que
  // todavía están dentro del plazo sin contacto no cuentan.
  let contactoOk = 0, contactoBase = 0;
  for (const c of casos) {
    const creado = parseISO(c.creado).getTime();
    if (c.primerContacto) { contactoBase++; if (parseISO(c.primerContacto).getTime() - creado <= limite) contactoOk++; }
    else if (t - creado > limite) contactoBase++;
  }
  const aptos = casos.filter((c) => c.resultado === "APTO");
  const conDocs = casos.filter((c) => c.docsRecibidos > 0);
  const l73 = casos.filter((c) => c.ley73 && c.contrato);
  const noConviene = casos.filter((c) => c.resultado === "CALIFICA_NO_CONVIENE");
  const hoy = hoyCDMX(new Date(t));
  let alertaOk = 0, alertaBase = 0;
  for (const a of alertas) {
    const plazo = format(addDays(parseISO(a.disparo), p.diasAlerta), "yyyy-MM-dd");
    if (a.atendida) { alertaBase++; if (hoyCDMX(parseISO(a.atendida)) <= plazo) alertaOk++; }
    else if (hoy > plazo) alertaBase++;
  }
  const crudo: Record<ClaveMetrica, [number, number | null]> = {
    contacto_24h: [contactoOk, contactoBase],
    prospecto_precalificado: [casos.filter((c) => c.precalificado).length, casos.length],
    apto_contrato: [aptos.filter((c) => c.contrato).length, aptos.length],
    expediente_primera: [conDocs.filter((c) => c.docsRechazados === 0).length, conDocs.length],
    bloqueados: [casos.filter((c) => c.bloqueado).length, casos.length],
    l73_analisis: [l73.filter((c) => c.analisisImpacto).length, l73.length],
    no_conviene_desvio: [noConviene.filter((c) => c.desviado).length, noConviene.length],
    alertas_a_tiempo: [alertaOk, alertaBase],
    linea_roja: [lineaRoja, null],
    referidos: [casos.filter((c) => c.referido).length, null],
  };
  return DEF.map((d) => {
    const [numerador, denominador] = crudo[d.clave];
    const valor = denominador === null ? numerador : proporcion(numerador, denominador);
    const meta = d.sentido === "seguimiento" ? null : metas[d.clave] ?? null;
    const cumple = valor === null || meta === null ? null : d.sentido === "minimo" ? valor >= meta : valor <= meta;
    return { ...d, numerador, denominador, valor, meta, cumple };
  });
}

/**
 * Coaching (10): si dos o más métricas quedan debajo de la meta dos semanas seguidas, se sugiere repasar sus
 * módulos. Recibe las métricas de la semana pasada y de la anterior.
 */
export function sugerirRepaso(semana: Metrica[], anterior: Metrica[]): { metricas: ClaveMetrica[]; modulos: string[] } {
  const fallaAntes = new Set(anterior.filter((m) => m.cumple === false).map((m) => m.clave));
  const ambas = semana.filter((m) => m.cumple === false && fallaAntes.has(m.clave));
  if (ambas.length < 2) return { metricas: [], modulos: [] };
  return { metricas: ambas.map((m) => m.clave), modulos: [...new Set(ambas.map((m) => m.modulo).filter((x): x is string => Boolean(x)))] };
}
