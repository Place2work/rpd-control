// Suscripción al calendario con liga privada (Google Calendar → Otros calendarios → Desde URL).
// La autoriza el token: se busca por su HMAC y se consulta con los permisos (RLS) de su dueño.
import { NextResponse, type NextRequest } from "next/server";
import { eventosUsuario } from "@/lib/calendario/consultas";
import { hashToken } from "@/lib/cripto";
import { prismaSistema } from "@/lib/db/prisma";
import { generarIcs } from "@/lib/reglas/calendario";
import { sumarDias } from "@/lib/reglas/fechas";
import { hoyCDMX } from "@/lib/tiempo";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/, "");
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return new NextResponse("No encontrado", { status: 404 });
  const fila = await prismaSistema.calendarioToken.findUnique({ where: { token_hash: hashToken(token) }, select: { id: true, usuario_id: true, revocado_at: true } });
  if (!fila || fila.revocado_at) return new NextResponse("No encontrado", { status: 404 });
  const usuario = await prismaSistema.usuario.findFirst({ where: { id: fila.usuario_id, activo: true, archivado_at: null }, select: { id: true, nombre: true } });
  if (!usuario) return new NextResponse("No encontrado", { status: 404 });

  const hoy = hoyCDMX();
  // Mismos permisos que en la aplicación: RLS con la identidad del dueño de la liga.
  const eventos = await eventosUsuario({ sub: usuario.id, aal: "aal2" }, null, sumarDias(hoy, -30), sumarDias(hoy, 400), hoy);
  await prismaSistema.calendarioToken.update({ where: { id: fila.id }, data: { ultimo_uso_at: new Date() } });
  const sello = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const base = process.env.APP_URL ?? req.nextUrl.origin;
  return new NextResponse(generarIcs(eventos, `RPD Control · ${usuario.nombre}`, sello, base), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="rpd-control.ics"', "Cache-Control": "private, max-age=900" },
  });
}
