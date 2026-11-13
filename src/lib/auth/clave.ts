// Contraseñas: la propia (mínimo) y la temporal que genera el servidor para entregarla en persona.

export const MINIMO_CLAVE = 6;

/** Requisitos de la contraseña propia, en el orden en que se muestran (el 2FA sigue siendo obligatorio). */
export const REQUISITOS_CLAVE = [
  { clave: "largo", texto: `Mínimo ${MINIMO_CLAVE} caracteres`, cumple: (c: string) => c.length >= MINIMO_CLAVE },
  { clave: "mayuscula", texto: "Al menos una letra mayúscula (A-Z)", cumple: (c: string) => /[A-ZÁÉÍÓÚÑ]/.test(c) },
  { clave: "numero", texto: "Al menos un número (0-9)", cumple: (c: string) => /\d/.test(c) },
] as const;

/** Mensaje de lo que le falta a la contraseña, o null si cumple todo. */
export function validarClave(c: string): string | null {
  const faltan = REQUISITOS_CLAVE.filter((r) => !r.cumple(c));
  if (!faltan.length) return null;
  return `Tu contraseña necesita: ${faltan.map((r) => r.texto.charAt(0).toLowerCase() + r.texto.slice(1)).join(", ")}.`;
}

// Sin letras ni números que se confunden al dictarlos (0/O, 1/l/I).
export const ALFABETO_CLAVE = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Un carácter al azar sin sesgo: se descartan los bytes que no caben parejo en el alfabeto. */
function caracter(): string {
  const tope = 256 - (256 % ALFABETO_CLAVE.length);
  const b = new Uint8Array(1);
  do crypto.getRandomValues(b); while (b[0] >= tope);
  return ALFABETO_CLAVE[b[0] % ALFABETO_CLAVE.length];
}

/** Contraseña temporal de 4 bloques de 4 (≈ 92 bits), p. ej. «Kq7m-Xp3r-Tz9w-Hb4n». */
export function claveTemporal(): string {
  return Array.from({ length: 4 }, () => Array.from({ length: 4 }, caracter).join("")).join("-");
}
