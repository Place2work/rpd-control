"use server";

// Academia: firmar acuses y marcar lecciones leídas (con RLS), y abrir/calificar evaluaciones (motor).
import { revalidatePath } from "next/cache";
import { obtenerSesion } from "@/lib/auth/sesion";
import { ACUSES, MODULOS } from "@/lib/academia/contenido";
import { iniciarEvaluacion, terminarEvaluacion, type InicioEvaluacion, type ResultadoEvaluacion, type TipoEvaluacion } from "@/lib/academia/motor";
import { conUsuario } from "@/lib/db/prisma";
import type { Resultado } from "../casos/[id]/acciones";

const ROLES = new Set(["director", "asesor", "socio"]);

export async function firmarAcuses(_p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (!ROLES.has(usuario.rol)) return { error: "Tu rol no usa la Academia." };
  const faltan = ACUSES.filter((a) => form.get(a.clave) !== "si");
  if (faltan.length) return { error: `Marca que leíste y aceptas: ${faltan.map((a) => a.titulo).join(" y ")}.` };
  await conUsuario(claims, async (tx) => {
    for (const a of ACUSES) {
      await tx.capAcuse.upsert({ where: { usuario_id_documento_version: { usuario_id: usuario.id, documento: a.clave, version: a.version } },
        create: { usuario_id: usuario.id, documento: a.clave, version: a.version, ip }, update: {}, select: { id: true } });
    }
  }, ip);
  revalidatePath("/academia");
  return { ok: true };
}

export async function marcarLeido(clave: string): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (!ROLES.has(usuario.rol)) return { error: "Tu rol no usa la Academia." };
  const m = MODULOS.find((x) => x.clave === clave);
  if (!m) return { error: "Módulo desconocido." };
  await conUsuario(claims, (tx) => tx.capProgreso.upsert({
    where: { usuario_id_modulo_version: { usuario_id: usuario.id, modulo: m.clave, version: m.version } },
    create: { usuario_id: usuario.id, modulo: m.clave, version: m.version, estado: "completado", completado_at: new Date() },
    update: { estado: "completado", completado_at: new Date() }, select: { id: true },
  }), ip);
  revalidatePath("/academia");
  revalidatePath(`/academia/${clave}`);
  return { ok: true };
}

export async function comenzarEvaluacion(tipo: TipoEvaluacion, objetivo: string): Promise<InicioEvaluacion> {
  const { usuario } = await obtenerSesion();
  if (!ROLES.has(usuario.rol)) return { error: "Tu rol no usa la Academia." };
  if (tipo !== "quiz_modulo" && tipo !== "examen_ruta") return { error: "Evaluación desconocida." };
  return iniciarEvaluacion(usuario.id, tipo, objetivo);
}

export async function enviarEvaluacion(intentoId: string, respuestas: Record<string, number | null>): Promise<ResultadoEvaluacion> {
  const { usuario } = await obtenerSesion();
  if (!ROLES.has(usuario.rol)) return { error: "Tu rol no usa la Academia." };
  const r = await terminarEvaluacion(usuario.id, intentoId, respuestas);
  revalidatePath("/academia");
  return r;
}
