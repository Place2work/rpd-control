"use server";

// Equipo en vivo: la foto del equipo y su actividad de hoy, para refrescar la oficina 3D cada pocos segundos.
import { obtenerSesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { fotoEquipo, type FotoEquipo } from "@/lib/equipo/datos";

export async function refrescarEquipo(): Promise<FotoEquipo | null> {
  const s = await obtenerSesion();
  if (s.usuario.rol !== "director") return null;
  return conUsuario(s.claims, (tx) => fotoEquipo(tx), s.ip);
}
