// Almacén en disco SOLO para el modo demostración local (ver lib/auth/demo.ts).
// Fuera de ese modo responde 404 siempre.
import { NextResponse, type NextRequest } from "next/server";
import { firmaLocalValida, guardarLocal, leerLocal } from "@/lib/documentos/almacen";
import { MAX_BYTES } from "@/lib/documentos/reglas";

function autorizado(req: NextRequest) {
  const ruta = req.nextUrl.searchParams.get("ruta") ?? "";
  return firmaLocalValida(ruta, req.nextUrl.searchParams.get("firma")) ? ruta : null;
}

export async function PUT(req: NextRequest) {
  const ruta = autorizado(req);
  if (!ruta) return new NextResponse(null, { status: 404 });
  const datos = Buffer.from(await req.arrayBuffer());
  if (datos.length > MAX_BYTES) return new NextResponse(null, { status: 413 });
  await guardarLocal(ruta, datos);
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const ruta = autorizado(req);
  if (!ruta) return new NextResponse(null, { status: 404 });
  const tipo = ruta.endsWith(".pdf") ? "application/pdf" : "image/jpeg";
  return new NextResponse(new Uint8Array(await leerLocal(ruta)), { headers: { "content-type": tipo } });
}
