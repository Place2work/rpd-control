// Operaciones de cuenta que solo hace el servidor con la llave secreta de Supabase: invitar,
// bloquear y desbloquear el acceso. La llave nunca llega al navegador.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { prismaSistema } from "@/lib/db/prisma";
import { modoDemo } from "./demo";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, llave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !llave) throw new Error("Falta configurar SUPABASE_SECRET_KEY en el servidor.");
  return createClient(url, llave, { auth: { persistSession: false, autoRefreshToken: false } }).auth.admin;
}

const urlApp = () => process.env.APP_URL ?? "https://rpd-control.vercel.app";

/** Manda la invitación (el correo lleva a definir contraseña y luego al 2FA). Devuelve el id de Auth. */
export async function invitarCuenta(email: string): Promise<{ id?: string; error?: string }> {
  if (modoDemo()) {
    // Sin Supabase: se crea la cuenta en el auth local de prueba.
    const filas = await prismaSistema.$queryRaw<{ id: string }[]>`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), ${email}) RETURNING id::text`;
    return { id: filas[0].id };
  }
  const { data, error } = await admin().inviteUserByEmail(email, { redirectTo: `${urlApp()}/auth/callback` });
  if (error) {
    if (/already been registered|already exists/i.test(error.message)) return { error: "Ese correo ya tiene cuenta. Si es de alguien del equipo, búscalo en la lista." };
    if (/rate limit/i.test(error.message)) return { error: "Supabase alcanzó su límite de correos por hora. Intenta más tarde (con Resend como SMTP ya no pasa)." };
    return { error: `Supabase no pudo enviar la invitación: ${error.message}` };
  }
  return { id: data.user.id };
}

/** Bloquea o desbloquea el inicio de sesión en Auth (además de `usuarios.activo`, que corta RLS). */
export async function bloquearCuenta(id: string, bloquear: boolean): Promise<void> {
  if (modoDemo()) return;
  const { error } = await admin().updateUserById(id, { ban_duration: bloquear ? "876000h" : "none" });
  if (error) throw new Error(`Supabase no pudo ${bloquear ? "bloquear" : "desbloquear"} la cuenta: ${error.message}`);
}
