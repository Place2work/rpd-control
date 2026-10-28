// Almacén de expedientes. Producción: bucket privado "expedientes" de Supabase, con la sesión
// del usuario (aplican las políticas de storage.objects) y URLs firmadas de 10 minutos.
// Modo demostración local: disco, para probar el flujo sin Supabase.
import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHmac } from "node:crypto";
import { modoDemo } from "@/lib/auth/demo";
import { crearClienteServidor } from "@/lib/supabase/server";

const BUCKET = "expedientes";
const MINUTOS_URL = 10;

export type Subida = { modo: "supabase"; ruta: string; token: string } | { modo: "local"; ruta: string; url: string };

const dirLocal = () => process.env.RPD_ALMACEN_LOCAL ?? path.join(tmpdir(), "rpd-almacen");
const firmaLocal = (ruta: string) => createHmac("sha256", process.env.HMAC_LLAVE ?? "demo").update(ruta).digest("hex").slice(0, 32);
export const rutaLocalValida = (ruta: string) => /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z]{3,4}$/.test(ruta);

export async function prepararSubida(ruta: string): Promise<Subida> {
  if (modoDemo()) return { modo: "local", ruta, url: `/api/demo/almacen?ruta=${encodeURIComponent(ruta)}&firma=${firmaLocal(ruta)}` };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(ruta);
  if (error || !data) throw new Error(`No se pudo preparar la subida: ${error?.message}`);
  return { modo: "supabase", ruta: data.path, token: data.token };
}

export async function urlLectura(ruta: string): Promise<string> {
  if (modoDemo()) return `/api/demo/almacen?ruta=${encodeURIComponent(ruta)}&firma=${firmaLocal(ruta)}`;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, MINUTOS_URL * 60);
  if (error || !data) throw new Error(`No se pudo abrir el documento: ${error?.message}`);
  return data.signedUrl;
}

// Solo modo demostración (la ruta /api/demo/almacen responde 404 fuera de él).
export function firmaLocalValida(ruta: string, firma: string | null) {
  return modoDemo() && rutaLocalValida(ruta) && firma === firmaLocal(ruta);
}
export async function guardarLocal(ruta: string, datos: Buffer) {
  const destino = path.join(dirLocal(), ruta);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, datos);
}
export async function leerLocal(ruta: string) {
  return readFile(path.join(dirLocal(), ruta));
}
