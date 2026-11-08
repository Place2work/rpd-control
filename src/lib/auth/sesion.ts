import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import type { Rol } from "@/generated/prisma/enums";
import { conUsuario, type ClaimsUsuario } from "@/lib/db/prisma";
import { crearClienteServidor } from "@/lib/supabase/server";
import { modoDemo } from "./demo";

export type Sesion = {
  claims: ClaimsUsuario;
  ip: string | null;
  usuario: { id: string; nombre: string; email: string; rol: Rol; socio_id: string | null };
  /** El Director está viendo el sistema como este usuario (solo lectura). */
  verComo?: { directorId: string; directorNombre: string };
};

export const COOKIE_VER_COMO = "rpd_ver_como";
export const COOKIE_AVISO_LECTURA = "rpd_aviso_lectura";

/**
 * En «ver como» toda acción de servidor (guardar, archivar, subir…) se detiene antes de tocar datos: se avisa con una
 * cookie de pocos segundos y se regresa a la misma pantalla. La base de datos además es de solo lectura.
 */
async function bloquearAccionesEnVerComo(s: Sesion): Promise<Sesion> {
  if (!s.verComo) return s;
  const h = await headers();
  if (!h.get("next-action")) return s;
  (await cookies()).set(COOKIE_AVISO_LECTURA, "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 15 });
  let destino = "/hoy";
  try {
    const ref = new URL(h.get("referer") ?? "");
    if (ref.host === h.get("host")) destino = ref.pathname + ref.search;
  } catch { /* sin referer: a Hoy */ }
  redirect(destino);
}

/**
 * «Ver como asesor»: si quien entra es Director y trae la cookie, la sesión toma la identidad del asesor elegido
 * (RLS con su id, transacciones de solo lectura). Cualquier otro rol ignora la cookie.
 */
async function aplicarVerComo(s: Sesion): Promise<Sesion> {
  if (s.usuario.rol !== "director") return s;
  const id = (await cookies()).get(COOKIE_VER_COMO)?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return s;
  const otro = await conUsuario(s.claims, (tx) => tx.usuario.findFirst({ where: { id, activo: true, rol: "socio" },
    select: { id: true, nombre: true, email: true, rol: true, socio_id: true } }), s.ip);
  if (!otro) return s;
  return { claims: { ...s.claims, sub: otro.id, ver_como: true }, ip: s.ip, usuario: otro, verComo: { directorId: s.usuario.id, directorNombre: s.usuario.nombre } };
}

const SESION_DEMO: Sesion = {
  claims: { sub: "00000000-0000-0000-0000-000000000000", aal: "aal2" },
  ip: null,
  // Solo desarrollo: RPD_DEMO_ROL / RPD_DEMO_SOCIO permiten revisar la pantalla de otro rol (la fila del usuario
  // demo en la BD local debe tener el mismo rol para que RLS coincida).
  usuario: { id: "00000000-0000-0000-0000-000000000000", nombre: "Irving (demo)", email: "demo@local",
    rol: (process.env.RPD_DEMO_ROL as Rol | undefined) ?? "director", socio_id: process.env.RPD_DEMO_SOCIO ?? null },
};

/** Cuenta con contraseña temporal: la marca vive en app_metadata (solo la cambia el servidor). */
export function debeCambiarClave(claims: ClaimsUsuario): boolean {
  return (claims.app_metadata as { debe_cambiar_clave?: boolean } | undefined)?.debe_cambiar_clave === true;
}

// Una sola verificación por request. Exige 2FA (aal2) y un usuario activo en `usuarios`.
export const obtenerSesion = cache(async (): Promise<Sesion> => {
  await connection(); // todo lo que depende del usuario se resuelve en cada request
  if (modoDemo()) return bloquearAccionesEnVerComo(await aplicarVerComo(SESION_DEMO));

  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as ClaimsUsuario | undefined;
  if (!claims?.sub) redirect("/login");
  if (claims.aal !== "aal2") redirect("/mfa");
  if (debeCambiarClave(claims)) redirect("/contrasena");

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const usuario = await conUsuario(
    claims,
    (tx) => tx.usuario.findUnique({ where: { id: claims.sub }, select: { id: true, nombre: true, email: true, rol: true, activo: true, socio_id: true } }),
    ip,
  );
  if (!usuario?.activo) redirect("/login?motivo=sin-acceso");
  return bloquearAccionesEnVerComo(await aplicarVerComo({
    claims,
    ip,
    usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, socio_id: usuario.socio_id },
  }));
});

export async function exigirRol(...roles: Rol[]): Promise<Sesion> {
  const s = await obtenerSesion();
  if (!roles.includes(s.usuario.rol)) redirect("/hoy?motivo=sin-permiso");
  return s;
}
