"use server";

import { obtenerSesion } from "@/lib/auth/sesion";
import { hashToken, nuevoToken } from "@/lib/cripto";
import { conUsuario } from "@/lib/db/prisma";

/** Genera una liga privada nueva y revoca la anterior. El token solo se muestra esta vez. */
export async function generarLigaCalendario(): Promise<{ url?: string; error?: string }> {
  const s = await obtenerSesion();
  const token = nuevoToken();
  await conUsuario(s.claims, async (tx) => {
    await tx.calendarioToken.updateMany({ where: { usuario_id: s.usuario.id, revocado_at: null }, data: { revocado_at: new Date() } });
    await tx.calendarioToken.create({ data: { usuario_id: s.usuario.id, token_hash: hashToken(token) }, select: { id: true } });
  }, s.ip);
  const base = process.env.APP_URL ?? "https://rpd-control.vercel.app";
  return { url: `${base}/api/calendario/${token}.ics` };
}

export async function revocarLigaCalendario(): Promise<{ ok?: boolean }> {
  const s = await obtenerSesion();
  await conUsuario(s.claims, (tx) => tx.calendarioToken.updateMany({ where: { usuario_id: s.usuario.id, revocado_at: null }, data: { revocado_at: new Date() } }), s.ip);
  return { ok: true };
}
