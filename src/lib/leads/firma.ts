// Firma del formulario del sitio (POST /api/leads). El sitio manda:
//   X-RPD-Timestamp: segundos Unix
//   X-RPD-Firma:     sha256=<hex de HMAC-SHA256(LEADS_HMAC_SECRETO, `${timestamp}.${cuerpo}`)>
// El timestamp dentro de la firma impide reenviar una petición vieja (ventana de 5 minutos).
import { createHmac, timingSafeEqual } from "node:crypto";

export const VENTANA_SEGUNDOS = 300;

export function firmar(secreto: string, timestamp: string, cuerpo: string): string {
  return "sha256=" + createHmac("sha256", secreto).update(`${timestamp}.${cuerpo}`).digest("hex");
}

export type ResultadoFirma = { ok: true } | { ok: false; motivo: "sin_secreto" | "sin_firma" | "vencida" | "invalida" };

export function verificarFirma(secreto: string | undefined, timestamp: string | null, firma: string | null, cuerpo: string, ahoraSeg: number): ResultadoFirma {
  if (!secreto) return { ok: false, motivo: "sin_secreto" };
  if (!timestamp || !firma) return { ok: false, motivo: "sin_firma" };
  if (!/^\d{9,11}$/.test(timestamp) || Math.abs(ahoraSeg - Number(timestamp)) > VENTANA_SEGUNDOS) return { ok: false, motivo: "vencida" };
  const esperada = Buffer.from(firmar(secreto, timestamp, cuerpo));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return { ok: false, motivo: "invalida" };
  return { ok: true };
}
