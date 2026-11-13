// Video de apoyo de una lección de la Academia. Solo con sesión de un rol que usa la Academia; soporta rangos
// (Range) para que el celular pueda adelantar y Safari lo reproduzca.
import { open, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { obtenerSesion } from "@/lib/auth/sesion";
import { MODULOS } from "@/lib/academia/contenido";

const ROLES = new Set(["director", "asesor", "socio"]);

export async function GET(req: NextRequest, { params }: { params: Promise<{ clave: string }> }) {
  const s = await obtenerSesion();
  if (!ROLES.has(s.usuario.rol)) return new NextResponse("No autorizado", { status: 403 });
  const { clave } = await params;
  const archivo = MODULOS.find((m) => m.clave === clave)?.video?.archivo;
  if (!archivo || !/^[A-Z0-9-]+\.mp4$/.test(archivo)) return new NextResponse("No encontrado", { status: 404 });
  const ruta = path.join(process.cwd(), "content", "academia", "videos", archivo);
  const { size } = await stat(ruta).catch(() => ({ size: -1 }));
  if (size < 0) return new NextResponse("No encontrado", { status: 404 });

  const rango = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  let inicio = 0, fin = size - 1;
  if (rango) {
    inicio = rango[1] ? Number(rango[1]) : Math.max(0, size - Number(rango[2]));
    fin = rango[1] && rango[2] ? Math.min(Number(rango[2]), size - 1) : size - 1;
    if (inicio > fin || inicio >= size) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  const largo = fin - inicio + 1;
  const fh = await open(ruta, "r");
  const buf = Buffer.alloc(largo);
  await fh.read(buf, 0, largo, inicio);
  await fh.close();
  return new NextResponse(buf, {
    status: rango ? 206 : 200,
    headers: {
      "Content-Type": "video/mp4", "Content-Length": String(largo), "Accept-Ranges": "bytes",
      ...(rango ? { "Content-Range": `bytes ${inicio}-${fin}/${size}` } : {}),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
