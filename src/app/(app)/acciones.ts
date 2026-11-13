"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_VER_COMO, obtenerSesion, ROLES_VER_COMO } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { crearClienteServidor } from "@/lib/supabase/server";

/** Director: ver el sistema como otra persona del equipo (solo lectura). Queda en la bitácora de cuentas. */
export async function verComo(usuarioId: string) {
  const s = await obtenerSesion();
  if (s.usuario.rol !== "director" || s.verComo || !/^[0-9a-f-]{36}$/i.test(usuarioId)) redirect("/hoy");
  const ok = await conUsuario(s.claims, async (tx) => {
    const u = await tx.usuario.findFirst({ where: { id: usuarioId, activo: true, archivado_at: null, rol: { in: [...ROLES_VER_COMO] } }, select: { id: true } });
    if (!u) return false;
    await tx.$executeRaw`SELECT app.registrar_accion_cuenta(${usuarioId}::uuid, 'VER_COMO')`;
    return true;
  }, s.ip);
  if (!ok) redirect("/configuracion?seccion=usuarios");
  (await cookies()).set(COOKIE_VER_COMO, usuarioId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 2 });
  redirect("/hoy");
}

/** Regresar a la vista de Director. */
export async function salirVerComo() {
  (await cookies()).delete(COOKIE_VER_COMO);
  redirect("/configuracion?seccion=usuarios");
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE_VER_COMO);
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
