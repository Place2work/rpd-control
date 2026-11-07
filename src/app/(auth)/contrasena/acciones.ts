"use server";

// Cambio obligatorio después de una contraseña temporal: se guarda desde el servidor y se quita
// la marca en la misma llamada, para que no quede una sin la otra.
import { fijarClavePropia } from "@/lib/auth/admin";
import { MINIMO_CLAVE } from "@/lib/auth/clave";
import { debeCambiarClave } from "@/lib/auth/sesion";
import type { ClaimsUsuario } from "@/lib/db/prisma";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function cambiarClaveTemporal(nueva: string, confirmacion: string): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as ClaimsUsuario | undefined;
  if (!claims?.sub) return { error: "Tu sesión terminó. Vuelve a entrar." };
  if (claims.aal !== "aal2") return { error: "Primero activa la verificación en dos pasos." };
  if (!debeCambiarClave(claims)) return { error: "Tu contraseña ya está actualizada." };
  if (nueva.length < MINIMO_CLAVE) return { error: `Usa al menos ${MINIMO_CLAVE} caracteres.` };
  if (nueva !== confirmacion) return { error: "Las contraseñas no coinciden." };
  const r = await fijarClavePropia(claims.sub, nueva);
  return r.error ? { error: r.error } : { ok: true };
}
