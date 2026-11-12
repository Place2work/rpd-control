"use server";

// Solicitud de la constancia al IMSS desde el caso (trámite oficial asistido, 12-nov-2026). Con RLS.
import { revalidatePath } from "next/cache";
import { obtenerSesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";

type R = { ok?: boolean; error?: string };

export async function marcarConstanciaPedida(casoId: string): Promise<R> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol === "vendedor") return { error: "Tu rol no opera el expediente." };
  const r = await conUsuario(claims, async (tx): Promise<R> => {
    const caso = await tx.caso.findUnique({ where: { id: casoId }, select: { persona_id: true } });
    if (!caso) return { error: "No encontramos el caso." };
    const viva = await tx.solicitudConstancia.findFirst({ where: { caso_id: casoId, estado: { in: ["pendiente", "confirmar"] }, archivado_at: null }, select: { id: true } });
    if (viva) return { error: "Ya hay una solicitud esperando respuesta del IMSS." };
    await tx.solicitudConstancia.create({ data: { caso_id: casoId, persona_id: caso.persona_id, created_by: usuario.id }, select: { id: true } });
    await tx.evento.create({ data: { caso_id: casoId, tipo: "sistema", usuario_id: usuario.id, datos: { campo: "constancia_imss" },
      texto: "Se pidió la constancia de semanas en el portal del IMSS con el correo de constancias de la empresa. Esperando respuesta del IMSS." } });
    return { ok: true };
  }, ip);
  if (r.ok) revalidatePath(`/casos/${casoId}`);
  return r;
}

export async function cancelarSolicitudConstancia(casoId: string, solicitudId: string): Promise<R> {
  const { claims, ip, usuario } = await obtenerSesion();
  const r = await conUsuario(claims, async (tx): Promise<R> => {
    const n = await tx.solicitudConstancia.updateMany({ where: { id: solicitudId, caso_id: casoId, estado: { in: ["pendiente", "confirmar"] } }, data: { estado: "cancelada" } });
    if (!n.count) return { error: "No encontramos la solicitud." };
    await tx.evento.create({ data: { caso_id: casoId, tipo: "sistema", usuario_id: usuario.id, datos: { campo: "constancia_imss" }, texto: "Se canceló la solicitud de la constancia al IMSS." } });
    return { ok: true };
  }, ip);
  if (r.ok) revalidatePath(`/casos/${casoId}`);
  return r;
}
