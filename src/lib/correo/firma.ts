// Firma de los avisos (webhooks) de Resend, formato Svix: HMAC-SHA256 de «id.timestamp.cuerpo» con la llave
// (whsec_… en base64). La cabecera trae una o varias firmas «v1,<base64>». Ventana de 5 minutos.
import { createHmac, timingSafeEqual } from "node:crypto";

export type ResultadoFirma = { ok: true } | { ok: false; motivo: "sin_secreto" | "sin_cabeceras" | "fuera_de_tiempo" | "firma" };
const VENTANA_S = 300;

export function verificarFirmaResend(secreto: string | undefined, id: string | null, timestamp: string | null, firmas: string | null, cuerpo: string, ahoraS: number): ResultadoFirma {
  if (!secreto) return { ok: false, motivo: "sin_secreto" };
  if (!id || !timestamp || !firmas) return { ok: false, motivo: "sin_cabeceras" };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(ahoraS - ts) > VENTANA_S) return { ok: false, motivo: "fuera_de_tiempo" };
  const llave = Buffer.from(secreto.replace(/^whsec_/, ""), "base64");
  const esperada = createHmac("sha256", llave).update(`${id}.${timestamp}.${cuerpo}`).digest();
  for (const parte of firmas.split(" ")) {
    const [version, valor] = parte.split(",");
    if (version !== "v1" || !valor) continue;
    const dada = Buffer.from(valor, "base64");
    if (dada.length === esperada.length && timingSafeEqual(dada, esperada)) return { ok: true };
  }
  return { ok: false, motivo: "firma" };
}
