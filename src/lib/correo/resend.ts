// Lectura de correos recibidos en Resend (buzón de constancias). Solo GET; la llave vive en Vercel (RESEND_API_KEY).
import "server-only";

// RESEND_API_BASE solo para pruebas locales con un servidor simulado; en producción no se define.
const API = process.env.RESEND_API_BASE ?? "https://api.resend.com";
const MAX_PDF = 15 * 1024 * 1024;

export type CorreoRecibido = {
  id: string; from: string; to: string[]; subject: string | null; html: string | null; text: string | null;
  headers?: Record<string, string> | null; authentication?: { dkim?: unknown; spf?: unknown } | null;
};
export type AdjuntoRecibido = { id: string; filename: string | null; size: number | null; content_type: string | null; download_url: string };

async function get<T>(ruta: string): Promise<T> {
  const llave = process.env.RESEND_API_KEY;
  if (!llave) throw new Error("Falta RESEND_API_KEY en el servidor");
  const r = await fetch(`${API}${ruta}`, { headers: { Authorization: `Bearer ${llave}` }, cache: "no-store" });
  if (!r.ok) throw new Error(`Resend ${r.status} en ${ruta.replace(/[0-9a-f-]{36}/g, "…")}`);
  return r.json() as Promise<T>;
}

export const obtenerCorreoRecibido = (id: string) => get<CorreoRecibido>(`/emails/receiving/${encodeURIComponent(id)}`);
export const listarAdjuntos = async (id: string) => (await get<{ data: AdjuntoRecibido[] }>(`/emails/receiving/${encodeURIComponent(id)}/attachments`)).data ?? [];

/** Descarga un PDF adjunto (liga temporal de Resend, https), con tope de tamaño. */
export async function descargarPdf(a: AdjuntoRecibido): Promise<Uint8Array | null> {
  const esPdf = a.content_type === "application/pdf" || /\.pdf$/i.test(a.filename ?? "");
  const permitida = a.download_url.startsWith("https://") || (Boolean(process.env.RESEND_API_BASE) && a.download_url.startsWith(process.env.RESEND_API_BASE!));
  if (!esPdf || (a.size ?? 0) > MAX_PDF || !permitida) return null;
  const r = await fetch(a.download_url, { cache: "no-store" });
  if (!r.ok) return null;
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.length > MAX_PDF || String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") return null;
  return bytes;
}
