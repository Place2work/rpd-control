import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import type { Rol } from "@/generated/prisma/enums";
import { conUsuario, type ClaimsUsuario } from "@/lib/db/prisma";
import { crearClienteServidor } from "@/lib/supabase/server";
import { modoDemo } from "./demo";

export type Sesion = {
  claims: ClaimsUsuario;
  ip: string | null;
  usuario: { id: string; nombre: string; email: string; rol: Rol };
};

const SESION_DEMO: Sesion = {
  claims: { sub: "00000000-0000-0000-0000-000000000000", aal: "aal2" },
  ip: null,
  usuario: { id: "00000000-0000-0000-0000-000000000000", nombre: "Irving (demo)", email: "demo@local", rol: "director" },
};

// Una sola verificación por request. Exige 2FA (aal2) y un usuario activo en `usuarios`.
export const obtenerSesion = cache(async (): Promise<Sesion> => {
  await connection(); // todo lo que depende del usuario se resuelve en cada request
  if (modoDemo()) return SESION_DEMO;

  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as ClaimsUsuario | undefined;
  if (!claims?.sub) redirect("/login");
  if (claims.aal !== "aal2") redirect("/mfa");

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const usuario = await conUsuario(
    claims,
    (tx) => tx.usuario.findUnique({ where: { id: claims.sub }, select: { id: true, nombre: true, email: true, rol: true, activo: true } }),
    ip,
  );
  if (!usuario?.activo) redirect("/login?motivo=sin-acceso");
  return { claims, ip, usuario };
});

export async function exigirRol(...roles: Rol[]): Promise<Sesion> {
  const s = await obtenerSesion();
  if (!roles.includes(s.usuario.rol)) redirect("/hoy?motivo=sin-permiso");
  return s;
}
