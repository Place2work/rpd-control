// Números en letra para contratos: "$10,000.00 (diez mil pesos 00/100 M.N.)" y "26% (veintiséis por ciento)".
const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce",
  "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco",
  "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function menorDeMil(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cien";
  const c = Math.floor(n / 100), r = n % 100;
  let t = "";
  if (r < 30) t = UNIDADES[r];
  else t = DECENAS[Math.floor(r / 10)] + (r % 10 ? ` y ${UNIDADES[r % 10]}` : "");
  return [CENTENAS[c], t].filter(Boolean).join(" ");
}

/** Entero en letra (hasta 999,999,999). "uno" se apocopa a "un" antes de "mil", "millón" y "pesos". */
export function enteroEnLetra(n: number, apocope = false): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999_999) throw new Error(`Número fuera de rango: ${n}`);
  if (n === 0) return "cero";
  const millones = Math.floor(n / 1_000_000), miles = Math.floor((n % 1_000_000) / 1000), resto = n % 1000;
  const un = (t: string) => (t.endsWith("veintiuno") ? t.replace(/veintiuno$/, "veintiún") : t.replace(/uno$/, "un"));
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? "un millón" : `${un(menorDeMil(millones))} millones`);
  if (miles) partes.push(miles === 1 ? "mil" : `${un(menorDeMil(miles))} mil`);
  if (resto) partes.push(apocope ? un(menorDeMil(resto)) : menorDeMil(resto));
  return partes.join(" ");
}

/** "$10,000.00 (diez mil pesos 00/100 M.N.)" */
export function pesosEnLetra(monto: number): string {
  const centavos = Math.round(monto * 100);
  const enteros = Math.floor(centavos / 100), cts = centavos % 100;
  const fmt = (centavos / 100).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const letra = enteroEnLetra(enteros, true);
  const de = enteros > 0 && enteros % 1_000_000 === 0 ? " de" : "";
  return `$${fmt} (${letra}${de} ${enteros === 1 ? "peso" : "pesos"} ${String(cts).padStart(2, "0")}/100 M.N.)`;
}

/** 0.26 → "26% (veintiséis por ciento)" */
export function porcentajeEnLetra(fraccion: number): string {
  const pct = Math.round(fraccion * 10000) / 100;
  const entero = Math.trunc(pct), dec = Math.round((pct - entero) * 100);
  const letra = enteroEnLetra(entero) + (dec ? ` punto ${enteroEnLetra(dec)}` : "");
  return `${pct.toLocaleString("es-MX", { maximumFractionDigits: 2 })}% (${letra} por ciento)`;
}
