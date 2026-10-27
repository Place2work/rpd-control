// Cifrado a nivel campo (sección 12) e índice ciego para buscar sin descifrar (hallazgo H2).
// Formato del valor cifrado: [versión 1 byte][iv 12][tag 16][texto cifrado].
import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { normalizarCurp, normalizarNss } from "@/lib/reglas/identificadores";

const VERSION = 1;

function llave(nombre: "CIFRADO_LLAVE" | "HMAC_LLAVE"): Buffer {
  const b64 = process.env[nombre];
  if (!b64) throw new Error(`Falta la variable de entorno ${nombre}`);
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error(`${nombre} debe ser de 32 bytes en base64 (openssl rand -base64 32)`);
  return k;
}

// Devuelve Uint8Array<ArrayBuffer>, el tipo que Prisma espera para columnas Bytes.
export function cifrar(texto: string): Uint8Array<ArrayBuffer> {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", llave("CIFRADO_LLAVE"), iv);
  const datos = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return new Uint8Array(Buffer.concat([Buffer.from([VERSION]), iv, c.getAuthTag(), datos]));
}

export function descifrar(blob: Uint8Array): string {
  const b = Buffer.from(blob);
  if (b[0] !== VERSION) throw new Error(`Versión de cifrado desconocida: ${b[0]}`);
  const d = createDecipheriv("aes-256-gcm", llave("CIFRADO_LLAVE"), b.subarray(1, 13));
  d.setAuthTag(b.subarray(13, 29));
  return Buffer.concat([d.update(b.subarray(29)), d.final()]).toString("utf8");
}

// HMAC-SHA256 del valor normalizado. Con prefijo de tipo para que una CURP y un NSS
// nunca produzcan el mismo hash.
export function hashIdentificador(tipo: "curp" | "nss", valor: string): string {
  const normal = tipo === "curp" ? normalizarCurp(valor) : normalizarNss(valor);
  return createHmac("sha256", llave("HMAC_LLAVE")).update(`${tipo}:${normal}`).digest("hex");
}
