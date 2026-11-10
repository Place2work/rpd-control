// Operaciones de cuenta que solo hace el servidor con la llave secreta de Supabase: invitar,
// bloquear y desbloquear el acceso. La llave nunca llega al navegador.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { prismaSistema } from "@/lib/db/prisma";
import { claveTemporal } from "./clave";
import { modoDemo } from "./demo";
import { urlApp } from "@/lib/url";

const SIN_LLAVE = "Falta la llave secreta de Supabase en el servidor (SUPABASE_SECRET_KEY). Agrégala en Vercel → Settings → Environment Variables y vuelve a publicar; sin ella no se pueden crear cuentas ni contraseñas.";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, llave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !llave) throw new Error(SIN_LLAVE);
  return createClient(url, llave, { auth: { persistSession: false, autoRefreshToken: false } }).auth.admin;
}

/** Cualquier falla (llave faltante, red, Supabase caído) regresa como aviso para el formulario, nunca como pantalla de error. */
async function seguro<T extends { error?: string }>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    const m = (e as Error).message;
    console.error("[auth admin]", m);
    return { error: m === SIN_LLAVE ? SIN_LLAVE : `No se pudo completar con Supabase: ${m}. Intenta de nuevo.` };
  }
}


/** Manda la invitación (el correo lleva a definir contraseña y luego al 2FA). Devuelve el id de Auth. */
async function invitarCuentaInterno(email: string): Promise<{ id?: string; error?: string }> {
  if (modoDemo()) {
    // Sin Supabase: se crea la cuenta en el auth local de prueba.
    const filas = await prismaSistema.$queryRaw<{ id: string }[]>`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), ${email}) RETURNING id::text`;
    return { id: filas[0].id };
  }
  const { data, error } = await admin().inviteUserByEmail(email, { redirectTo: `${urlApp()}/auth/callback` });
  if (error) {
    if (/already been registered|already exists/i.test(error.message)) return { error: "Ese correo ya tiene cuenta. Si es de alguien del equipo, búscalo en la lista." };
    if (error.code === "email_address_not_authorized" || /not authorized/i.test(error.message)) {
      return { error: "Supabase todavía usa su correo de prueba, que solo envía al equipo del proyecto. Configura Resend como SMTP en Supabase y vuelve a invitar." };
    }
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

// La marca va en app_metadata: el usuario no la puede quitar desde el navegador.
const DEBE_CAMBIAR = { debe_cambiar_clave: true };

/** Cuenta ya confirmada con contraseña temporal (sin correo). Al entrar se le exige 2FA y cambiarla. */
async function crearCuentaConClaveInterno(email: string): Promise<{ id?: string; clave?: string; error?: string }> {
  const clave = claveTemporal();
  if (modoDemo()) {
    const filas = await prismaSistema.$queryRaw<{ id: string }[]>`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), ${email}) RETURNING id::text`;
    return { id: filas[0].id, clave };
  }
  const { data, error } = await admin().createUser({ email, password: clave, email_confirm: true, app_metadata: DEBE_CAMBIAR });
  if (error) {
    if (/already been registered|already exists/i.test(error.message)) return { error: "Ese correo ya tiene cuenta. Si es de alguien del equipo, búscalo en la lista." };
    return { error: `Supabase no pudo crear la cuenta: ${error.message}` };
  }
  return { id: data.user.id, clave };
}

/** Nueva contraseña temporal para alguien que olvidó la suya (mientras no haya correo de recuperación). */
async function restablecerConClaveInterno(id: string): Promise<{ clave?: string; error?: string }> {
  const clave = claveTemporal();
  if (modoDemo()) return { clave };
  const { error } = await admin().updateUserById(id, { password: clave, app_metadata: DEBE_CAMBIAR });
  if (error) return { error: `Supabase no pudo cambiar la contraseña: ${error.message}` };
  return { clave };
}

/** El propio usuario fija su contraseña y se quita la marca de cambio obligatorio, en una sola llamada. */
async function fijarClavePropiaInterno(id: string, clave: string): Promise<{ error?: string }> {
  if (modoDemo()) return {};
  const { error } = await admin().updateUserById(id, { password: clave, app_metadata: { debe_cambiar_clave: false } });
  if (error) return { error: /same|different/i.test(error.message) ? "Usa una contraseña distinta a la temporal." : "No pudimos guardar la contraseña. Intenta con otra." };
  return {};
}

/**
 * Perdió el celular: se borran todos sus factores (el teléfono viejo ya no sirve para entrar) y se
 * le da una contraseña temporal. Al entrar vuelve a inscribir el 2FA y pone una contraseña propia.
 */
async function restablecerVerificacionInterno(id: string): Promise<{ clave?: string; borrados?: number; error?: string }> {
  if (modoDemo()) return { clave: claveTemporal(), borrados: 0 };
  const mfa = admin().mfa;
  const { data, error } = await mfa.listFactors({ userId: id });
  if (error) return { error: `Supabase no pudo leer la verificación: ${error.message}` };
  for (const f of data.factors) {
    const r = await mfa.deleteFactor({ id: f.id, userId: id });
    if (r.error) return { error: `Supabase no pudo quitar el factor: ${r.error.message}` };
  }
  const nueva = await restablecerConClave(id);
  return nueva.clave ? { clave: nueva.clave, borrados: data.factors.length } : { error: nueva.error };
}

/** Liga para definir su contraseña a una cuenta que ya existe (llega con la plantilla «Reset password»). */
async function enviarLigaContrasenaInterno(email: string): Promise<{ ok?: boolean; error?: string }> {
  if (modoDemo()) return { ok: true };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, llave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !llave) return { error: "Falta configurar Supabase en el servidor." };
  const cliente = createClient(url, llave, { auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false } });
  const { error } = await cliente.auth.resetPasswordForEmail(email, { redirectTo: `${urlApp()}/auth/callback` });
  if (error) {
    // Supabase no deja mandar dos correos al mismo usuario en menos de un minuto: el primero ya salió.
    if (/only request this after|over_email_send_rate_limit/i.test(error.message + (error.code ?? ""))) {
      return { error: "Ya se le envió un correo hace un momento. Si necesitas reenviarlo, espera un minuto." };
    }
    return { error: /rate limit/i.test(error.message) ? "Se alcanzó el límite de correos por hora. Intenta más tarde." : `Supabase no pudo enviar el correo: ${error.message}` };
  }
  return { ok: true };
}

export async function invitarCuenta(email: string): Promise<{ id?: string; error?: string }> {
  return seguro(() => invitarCuentaInterno(email)) as Promise<{ id?: string; error?: string }>;
}

export async function crearCuentaConClave(email: string): Promise<{ id?: string; clave?: string; error?: string }> {
  return seguro(() => crearCuentaConClaveInterno(email)) as Promise<{ id?: string; clave?: string; error?: string }>;
}

export async function restablecerConClave(id: string): Promise<{ clave?: string; error?: string }> {
  return seguro(() => restablecerConClaveInterno(id)) as Promise<{ clave?: string; error?: string }>;
}

export async function fijarClavePropia(id: string, clave: string): Promise<{ error?: string }> {
  return seguro(() => fijarClavePropiaInterno(id, clave)) as Promise<{ error?: string }>;
}

export async function restablecerVerificacion(id: string): Promise<{ clave?: string; borrados?: number; error?: string }> {
  return seguro(() => restablecerVerificacionInterno(id)) as Promise<{ clave?: string; borrados?: number; error?: string }>;
}

export async function enviarLigaContrasena(email: string): Promise<{ ok?: boolean; error?: string }> {
  return seguro(() => enviarLigaContrasenaInterno(email)) as Promise<{ ok?: boolean; error?: string }>;
}
