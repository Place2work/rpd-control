// Lectura de la «Constancia de Semanas Cotizadas en el IMSS» (12-nov-2026). Pura: recibe los renglones del PDF
// (separados por « | » o por dos o más espacios) y devuelve los datos; no lee archivos ni la base.

export type PatronConstancia = {
  nombre: string; registro: string | null; entidad: string | null;
  alta: string | null; baja: string | null; sbc: number | null;
};

export type LecturaConstancia = {
  nombre: string | null; nss: string | null; curp: string | null; fechaEmision: string | null; folio: string | null;
  total: number | null; cotizadas: number | null; descontadas: number | null; reintegradas: number | null;
  patrones: PatronConstancia[];
  /** Derivados de los patrones. */
  fechaBaja: string | null; primeraAlta: string | null; ultimoPatron: string | null; sbcUltimo: number | null;
  cotizaActualmente: boolean;
  avisos: string[];
};

const FECHA = /(\d{2})\/(\d{2})\/(\d{4})/;
const iso = (dmy: string | null | undefined) => {
  const m = dmy?.match(FECHA);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const numero = (v: string | null | undefined) => {
  if (!v) return null;
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const partes = (renglon: string) => renglon.replace(/\s{2,}/g, " | ").split(" | ").map((x) => x.trim()).filter(Boolean);

/** ¿El texto parece una constancia de semanas del IMSS? */
export function esConstanciaSemanas(renglones: string[]): boolean {
  const t = renglones.join("\n");
  return /Constancia de Semanas Cotizadas/i.test(t) && /Total de semanas cotizadas/i.test(t);
}

export function leerConstancia(renglones: string[]): LecturaConstancia {
  const filas = renglones.map(partes).filter((p) => p.length > 0);
  const texto = renglones.join("\n");
  const avisos: string[] = [];

  let nombre: string | null = null;
  let fechaEmision: string | null = null;
  const iEstimado = filas.findIndex((p) => /^Estimado\(a\),?$/i.test(p[0]));
  if (iEstimado >= 0 && filas[iEstimado + 1]) {
    nombre = filas[iEstimado + 1][0] ?? null;
    const f = filas[iEstimado + 1].slice(1).join(" ").replace(/\s/g, "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (f) fechaEmision = `${f[3]}-${f[2]}-${f[1]}`;
  }
  if (!fechaEmision) {
    const f = texto.match(/(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})\s*\n?\s*(?:\|\s*)?DD/);
    if (f) fechaEmision = `${f[3]}-${f[2]}-${f[1]}`;
  }

  const nss = texto.match(/NSS:\s*(\d{11})/)?.[1] ?? null;
  const curp = texto.match(/CURP:\s*([A-Z][A-Z0-9]{17})/)?.[1] ?? null;
  const filaCurp = filas.find((p) => /^CURP:/.test(p[0]));
  const total = filaCurp ? numero(filaCurp.find((x, i) => i > 0 && /^\d+(\.\d+)?$/.test(x))) : null;

  // Desglose: el primer renglón con tres números después de «Semanas cotizadas IMSS».
  let cotizadas: number | null = null, descontadas: number | null = null, reintegradas: number | null = null;
  const iDetalle = filas.findIndex((p) => p.some((x) => /Semanas cotizadas IMSS/i.test(x)));
  if (iDetalle >= 0) {
    const tres = filas.slice(iDetalle, iDetalle + 4).find((p) => p.length === 3 && p.every((x) => /^\d+(\.\d+)?$/.test(x)));
    if (tres) [cotizadas, descontadas, reintegradas] = tres.map((x) => Number(x));
  }
  const folio = texto.replace(/\s(?=\S\s)/g, "").match(/Folio:(\d{10,})/)?.[1] ?? texto.match(/Folio:\s*(\d{10,})/)?.[1] ?? null;

  // Historia laboral: un bloque por patrón.
  const patrones: PatronConstancia[] = [];
  let actual: PatronConstancia | null = null;
  for (const p of filas) {
    if (/^Nombre del patrón$/i.test(p[0])) {
      actual = { nombre: p.slice(1).join(" "), registro: null, entidad: null, alta: null, baja: null, sbc: null };
      patrones.push(actual);
    } else if (actual && /^Registro Patronal$/i.test(p[0])) actual.registro = p[1] ?? null;
    else if (actual && /^Entidad federativa$/i.test(p[0])) actual.entidad = p.slice(1).join(" ") || null;
    else if (actual && /^Fecha de alta/i.test(p[0])) {
      const valorDe = (etiqueta: RegExp) => { const i = p.findIndex((x) => etiqueta.test(x)); return i >= 0 ? p[i + 1] ?? null : null; };
      actual.alta = iso(valorDe(/^Fecha de alta$/i) ?? p[0]);
      actual.baja = iso(valorDe(/^Fecha de baja$/i));
      actual.sbc = numero(p.find((x) => /^\$/.test(x)) ?? valorDe(/^Salario Base de Cotización/i));
    }
  }
  // Una constancia repite a veces el mismo bloque entre páginas: se cuenta una vez.
  const vistos = new Set<string>();
  const unicos = patrones.filter((x) => { const k = `${x.registro}|${x.alta}|${x.baja}`; if (vistos.has(k)) return false; vistos.add(k); return true; });

  const conAlta = unicos.filter((x) => x.alta);
  const vigentes = conAlta.filter((x) => !x.baja);
  const ordenadosPorAlta = [...conAlta].sort((a, b) => (a.alta! < b.alta! ? 1 : -1));
  const reciente = vigentes[0] ?? [...conAlta].sort((a, b) => ((a.baja ?? "") < (b.baja ?? "") ? 1 : -1))[0] ?? null;
  const bajas = conAlta.map((x) => x.baja).filter((x): x is string => Boolean(x)).sort();
  const fechaBaja = vigentes.length ? null : bajas.at(-1) ?? null;
  const primeraAlta = ordenadosPorAlta.at(-1)?.alta ?? null;

  if (total !== null && cotizadas !== null && descontadas !== null && reintegradas !== null) {
    const calculado = cotizadas - descontadas + reintegradas;
    if (Math.abs(calculado - total) > 0.01) avisos.push(`El total (${total}) no cuadra con cotizadas − descontadas + reintegradas (${calculado}).`);
  }
  if (!nss) avisos.push("No se encontró el NSS.");
  if (!curp) avisos.push("No se encontró la CURP.");
  if (cotizadas === null) avisos.push("No se encontró el desglose de semanas.");
  if (!unicos.length) avisos.push("No se encontró la historia laboral.");
  if (vigentes.length) avisos.push("Tiene un patrón sin fecha de baja: sigue cotizando.");

  return {
    nombre, nss, curp, fechaEmision, folio, total, cotizadas, descontadas, reintegradas, patrones: unicos,
    fechaBaja, primeraAlta, ultimoPatron: reciente?.nombre ?? null, sbcUltimo: reciente?.sbc ?? null,
    cotizaActualmente: vigentes.length > 0, avisos,
  };
}
