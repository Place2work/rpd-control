"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { generarAlertas } from "@/lib/alertas/generar";
import { obtenerSesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { sumarDias } from "@/lib/reglas/fechas";
import { hoyCDMX } from "@/lib/tiempo";

type R = { ok?: boolean; error?: string };

// Cada usuario actúa solo sobre sus alertas: RLS (alertas_upd) lo garantiza.
async function actualizar(id: string, data: Prisma.AlertaUpdateManyMutationInput): Promise<R> {
  const { claims, ip, usuario } = await obtenerSesion();
  try {
    const n = await conUsuario(claims, (tx) => tx.alerta.updateMany({ where: { id, asignado_a: usuario.id }, data }), ip);
    if (n.count === 0) return { error: "La alerta ya no está disponible." };
  } catch {
    return { error: "No se pudo actualizar la alerta." };
  }
  revalidatePath("/hoy");
  return { ok: true };
}

export async function atenderAlerta(id: string): Promise<R> {
  const { usuario } = await obtenerSesion();
  return actualizar(id, { estado: "atendida", atendida_por: usuario.id, atendida_at: new Date() });
}

export async function posponerAlerta(id: string, dias: 1 | 3 | 7): Promise<R> {
  if (![1, 3, 7].includes(dias)) return { error: "Plazo no válido." };
  return actualizar(id, { estado: "pospuesta", pospuesta_hasta: new Date(`${sumarDias(hoyCDMX(), dias)}T00:00:00Z`) });
}

export async function descartarAlerta(id: string, motivo: string): Promise<R> {
  if (motivo.trim().length < 5) return { error: "Escribe el motivo (mínimo 5 caracteres)." };
  return actualizar(id, { estado: "descartada", motivo_descarte: motivo.trim() });
}

/** Solo Director: corre la revisión de alertas en este momento, además de la de las 7:00. */
export async function revisarAlertasAhora(): Promise<R & { nuevas?: number }> {
  const { usuario } = await obtenerSesion();
  if (usuario.rol !== "director") return { error: "Solo el Director puede correr la revisión." };
  const r = await generarAlertas();
  revalidatePath("/hoy");
  return { ok: true, nuevas: r.alertas_nuevas };
}
