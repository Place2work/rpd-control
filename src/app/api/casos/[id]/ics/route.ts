// Fechas de un caso en .ics para importarlas al calendario (8.2): día 46, límites y vencimientos.
import { NextResponse, type NextRequest } from "next/server";
import { obtenerSesion } from "@/lib/auth/sesion";
import { eventosUsuario } from "@/lib/calendario/consultas";
import { generarIcs } from "@/lib/reglas/calendario";
import { sumarDias } from "@/lib/reglas/fechas";
import { hoyCDMX } from "@/lib/tiempo";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await obtenerSesion();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("No encontrado", { status: 404 });
  const hoy = hoyCDMX();
  const eventos = await eventosUsuario(s.claims, s.ip, sumarDias(hoy, -365), sumarDias(hoy, 365 * 10), hoy, id);
  const sello = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const folio = eventos[0]?.folio ?? "caso";
  return new NextResponse(generarIcs(eventos, `RPD ${folio}`, sello, process.env.APP_URL ?? req.nextUrl.origin), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${folio}.ics"`, "Cache-Control": "private, no-store" },
  });
}
