// Validación de CURP y NSS (sección 5.1). Funciones puras: sin BD ni fecha del sistema.

export type ResultadoValidacion = { valido: true; valor: string } | { valido: false; valor: string; error: string };

const CURP_REGEX =
  /^[A-Z][AEIOUX][A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HMX](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;

// Diccionario oficial de RENAPO para el dígito verificador (incluye la Ñ).
const DICCIONARIO_CURP = "0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";

export function normalizarCurp(curp: string): string {
  return curp.trim().toUpperCase().replace(/\s+/g, "");
}

export function normalizarNss(nss: string): string {
  return nss.replace(/\D/g, "");
}

export function digitoVerificadorCurp(curp17: string): number {
  let suma = 0;
  for (let i = 0; i < 17; i++) {
    suma += DICCIONARIO_CURP.indexOf(curp17[i]) * (18 - i);
  }
  return (10 - (suma % 10)) % 10;
}

export function validarCurp(entrada: string): ResultadoValidacion {
  const valor = normalizarCurp(entrada);
  if (valor.length !== 18) return { valido: false, valor, error: "La CURP debe tener 18 caracteres" };
  if (!CURP_REGEX.test(valor)) return { valido: false, valor, error: "El formato de la CURP no es válido" };
  if (digitoVerificadorCurp(valor.slice(0, 17)) !== Number(valor[17])) {
    return { valido: false, valor, error: "El dígito verificador de la CURP no coincide" };
  }
  return { valido: true, valor };
}

// Fecha de nacimiento y sexo que trae la CURP. El carácter 17 distingue el siglo:
// dígito → nacido antes de 2000; letra → 2000 en adelante.
export function datosDeCurp(curp: string): { fechaNacimiento: string; sexo: "H" | "M" | "X" } {
  const c = normalizarCurp(curp);
  const yy = Number(c.slice(4, 6));
  const siglo = /\d/.test(c[16]) ? 1900 : 2000;
  return {
    fechaNacimiento: `${siglo + yy}-${c.slice(6, 8)}-${c.slice(8, 10)}`,
    sexo: c[10] as "H" | "M" | "X",
  };
}

// NSS: 11 dígitos; el último es el verificador por Luhn sobre los 10 primeros.
export function digitoVerificadorNss(nss10: string): number {
  let suma = 0;
  for (let i = 0; i < 10; i++) {
    let n = Number(nss10[i]) * (i % 2 === 0 ? 1 : 2);
    if (n > 9) n -= 9;
    suma += n;
  }
  return (10 - (suma % 10)) % 10;
}

export function validarNss(entrada: string): ResultadoValidacion {
  const valor = normalizarNss(entrada);
  if (valor.length !== 11) return { valido: false, valor, error: "El NSS debe tener 11 dígitos" };
  if (digitoVerificadorNss(valor.slice(0, 10)) !== Number(valor[10])) {
    return { valido: false, valor, error: "El dígito verificador del NSS no coincide" };
  }
  return { valido: true, valor };
}

// Qué tipo de identificador escribió alguien en el buscador.
export function tipoIdentificador(q: string): "curp" | "nss" | null {
  if (/^\d{11}$/.test(normalizarNss(q)) && /^[\d\s-]+$/.test(q.trim())) return "nss";
  if (normalizarCurp(q).length === 18 && CURP_REGEX.test(normalizarCurp(q))) return "curp";
  return null;
}

// ───────────── Enmascarado (sección 3) ─────────────
export const enmascararNss = (ultimos4: string | null | undefined) => (ultimos4 ? `•••••••${ultimos4}` : "—");
export const enmascararClabe = (ultimos4: string | null | undefined) => (ultimos4 ? `•••• ${ultimos4}` : "—");
export const curpParcial = (curp: string) => {
  const c = normalizarCurp(curp);
  return `${c.slice(0, 4)}${"•".repeat(12)}${c.slice(16)}`;
};

// ───────────── CLABE interbancaria (18 dígitos, dígito verificador con pesos 3-7-1) ─────────────

export function normalizarClabe(entrada: string): string {
  return entrada.replace(/\D/g, "");
}

export function validarClabe(entrada: string): { valido: true } | { valido: false; error: string } {
  const c = normalizarClabe(entrada);
  if (c.length !== 18) return { valido: false, error: "La CLABE tiene 18 dígitos" };
  const pesos = [3, 7, 1];
  const suma = [...c.slice(0, 17)].reduce((a, d, i) => a + ((Number(d) * pesos[i % 3]) % 10), 0);
  const verificador = (10 - (suma % 10)) % 10;
  return verificador === Number(c[17]) ? { valido: true } : { valido: false, error: "La CLABE no es válida (revisa los dígitos)" };
}
