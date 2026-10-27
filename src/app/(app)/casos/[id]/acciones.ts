"use server";

import { revalidatePath } from "next/cache";
import { obtenerSesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { verDatoSensible } from "@/lib/db/sensibles";

// "Ver completo" (sección 3): la base valida el rol y deja renglón VER_SENSIBLE en la bitácora.
export async function verIdentificador(personaId: string, campo: "curp" | "nss"): Promise<{ valor?: string; error?: string }> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol === "vendedor") return { error: "Tu rol solo ve el dato enmascarado." };
  try {
    const valor = await verDatoSensible(claims, { tabla: "personas", campo }, personaId, ip);
    return valor ? { valor } : { error: "No está capturado." };
  } catch {
    return { error: "No tienes acceso a este dato." };
  }
}

export async function agregarNota(casoId: string, _previo: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const { claims, ip, usuario } = await obtenerSesion();
  const texto = String(form.get("texto") ?? "").trim();
  const tipo = String(form.get("tipo") ?? "nota");
  if (texto.length < 2) return { error: "Escribe la nota." };
  if (!["nota", "llamada", "whatsapp", "correo"].includes(tipo)) return { error: "Tipo no válido." };
  try {
    await conUsuario(
      claims,
      (tx) => tx.evento.create({ data: { caso_id: casoId, tipo: tipo as "nota", texto: texto.slice(0, 2000), usuario_id: usuario.id } }),
      ip,
    );
  } catch {
    return { error: "No se pudo guardar la nota." };
  }
  revalidatePath(`/casos/${casoId}`);
  return {};
}
