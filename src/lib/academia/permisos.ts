// Permisos por certificación (docs/CAPACITACION.md 3.2). La regla vive en la base (app.tiene_permiso), con el
// interruptor ACADEMIA_BLOQUEOS: el servidor pregunta ahí para no tener dos versiones de la misma regla.
import "server-only";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { RUTAS } from "./contenido";

export async function tienePermiso(s: Sesion, permiso: string): Promise<boolean> {
  const [r] = await conUsuario(s.claims, (tx) => tx.$queryRaw<{ ok: boolean }[]>`SELECT app.tiene_permiso(${permiso}) AS ok`, s.ip);
  return Boolean(r?.ok);
}

/** Permiso de otra persona (el Director o el analista, al asignarle un caso). null si quien pregunta no puede. */
export async function permisoDeOtro(s: Sesion, usuarioId: string, permiso: string): Promise<boolean | null> {
  const [r] = await conUsuario(s.claims, (tx) => tx.$queryRaw<{ ok: boolean | null }[]>`SELECT app.permiso_de_otro(${usuarioId}::uuid, ${permiso}) AS ok`, s.ip);
  return r?.ok ?? null;
}

export async function bloqueosActivos(s: Sesion): Promise<boolean> {
  const [r] = await conUsuario(s.claims, (tx) => tx.$queryRaw<{ ok: boolean }[]>`SELECT app.academia_bloqueos_activos() AS ok`, s.ip);
  return Boolean(r?.ok);
}

const ACCION: Record<string, string> = {
  "prospecto.crear": "dar de alta prospectos",
  "precalificacion.retiro": "precalificar retiros",
  "precalificacion.retiro.L73": "precalificar clientes Ley 73",
  "contrato.retiro.generar": "generar contratos de retiro",
  "prospecto.pension.recibir": "recibir prospectos de pensión",
};

/** «Para precalificar clientes Ley 73 necesitas R2 (Retiro avanzado)», con la primera ruta que lo habilita (12.2). */
export function mensajeBloqueo(permiso: string): string {
  const ruta = [...RUTAS].sort((a, b) => a.orden - b.orden).find((r) => r.permisos_habilita.includes(permiso));
  const accion = ACCION[permiso] ?? "hacer esto";
  return ruta
    ? `Para ${accion} necesitas la certificación ${ruta.clave} (${ruta.nombre}). Avanza en la Academia o pide al Director una excepción temporal.`
    : `No tienes permiso para ${accion}.`;
}
