"use server";

// Asesor que lleva el trámite (sección 3): el Director o un asesor lo asignan; vacío = bandeja general.
// RLS decide: el vendedor y el socio no reasignan.
import { revalidatePath } from "next/cache";
import { obtenerSesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import type { Resultado } from "./acciones";

export async function asignarAsesor(casoId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director" && usuario.rol !== "asesor") return { error: "Solo el Director o un asesor asignan el trámite." };
  const id = String(form.get("asignado_a") ?? "").trim() || null;
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) return { errores: { asignado_a: "Elige un asesor de la lista" } };

  const res = await conUsuario(claims, async (tx): Promise<Resultado> => {
    const caso = await tx.caso.findUnique({ where: { id: casoId }, select: { asignado: { select: { nombre: true } }, asignado_a: true } });
    if (!caso) return { error: "No encontramos el caso." };
    const nuevo = id ? await tx.usuario.findFirst({ where: { id, activo: true, archivado_at: null, rol: { in: ["asesor", "director"] } }, select: { id: true, nombre: true } }) : null;
    if (id && !nuevo) return { errores: { asignado_a: "Ese usuario no está activo como asesor" } };
    if ((caso.asignado_a ?? null) === (nuevo?.id ?? null)) return { ok: true };
    await tx.caso.update({ where: { id: casoId }, data: { asignado_a: nuevo?.id ?? null }, select: { id: true } });
    await tx.evento.create({ data: { caso_id: casoId, tipo: "sistema", usuario_id: usuario.id,
      texto: nuevo ? `Trámite asignado a ${nuevo.nombre}${caso.asignado ? ` (antes ${caso.asignado.nombre})` : ""}.` : `El trámite vuelve a la bandeja general (antes ${caso.asignado?.nombre ?? "—"}).`,
      datos: { asignado_antes: caso.asignado_a, asignado_a: nuevo?.id ?? null } } });
    return { ok: true };
  }, ip);
  if (res.ok) { revalidatePath(`/casos/${casoId}`); revalidatePath("/casos"); }
  return res;
}
