"use server";

// Recuperar contraseña: la solicitud sale del servidor en flujo «implícito» (sin PKCE), así la liga del correo
// funciona en cualquier dispositivo; con PKCE solo abría en el mismo navegador donde se pidió.
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { urlApp } from "@/lib/url";

export async function pedirRecuperacion(email: string): Promise<{ ok: true }> {
  const correo = z.email().safeParse(email.trim().toLowerCase());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, llave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // La respuesta es la misma exista o no la cuenta (no revela qué correos están registrados).
  if (!correo.success || !url || !llave) return { ok: true };
  const supabase = createClient(url, llave, { auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.auth.resetPasswordForEmail(correo.data, { redirectTo: `${urlApp()}/auth/callback` });
  if (error) console.error("[recuperar]", error.message);
  return { ok: true };
}
