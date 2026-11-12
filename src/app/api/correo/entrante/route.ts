// Aviso de Resend cuando llega un correo al buzón de constancias. Proceso del sistema: no hay usuario, la
// autorización es la firma de Resend (Svix). Idempotente: Resend reintenta si respondemos con error.
import { NextResponse, type NextRequest } from "next/server";
import { verificarFirmaResend } from "@/lib/correo/firma";
import { BUZON_CONSTANCIAS } from "@/lib/correo/buzon";
import { procesarCorreoEntrante } from "@/lib/correo/procesar";

export const maxDuration = 60;
const MAX_BYTES = 65_536;

export async function POST(req: NextRequest) {
  const cuerpo = await req.text();
  if (cuerpo.length > MAX_BYTES) return NextResponse.json({ error: "Demasiado grande" }, { status: 413 });
  const firma = verificarFirmaResend(process.env.RESEND_WEBHOOK_SECRET, req.headers.get("svix-id"), req.headers.get("svix-timestamp"),
    req.headers.get("svix-signature"), cuerpo, Math.floor(Date.now() / 1000));
  if (!firma.ok) {
    if (firma.motivo === "sin_secreto") console.error("[correo] falta RESEND_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Firma no válida" }, { status: 401 });
  }
  let evento: { type?: string; data?: { email_id?: string } };
  try { evento = JSON.parse(cuerpo); } catch { return NextResponse.json({ error: "JSON no válido" }, { status: 400 }); }
  if (evento.type !== "email.received" || !evento.data?.email_id) return NextResponse.json({ ok: true, ignorado: true });
  try {
    const r = await procesarCorreoEntrante(evento.data.email_id, BUZON_CONSTANCIAS);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[correo] no se pudo procesar", e);
    return NextResponse.json({ error: "No se pudo procesar; se reintentará" }, { status: 500 });
  }
}
