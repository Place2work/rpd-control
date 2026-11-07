// Contraseñas: la propia (mínimo) y la temporal que genera el servidor para entregarla en persona.

export const MINIMO_CLAVE = 12;

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
