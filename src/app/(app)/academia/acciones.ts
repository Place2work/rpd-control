"use server";

// Academia: firmar acuses y marcar lecciones leídas (con RLS), y abrir/calificar evaluaciones (motor).
import { revalidatePath } from "next/cache";
import { obtenerSesion } from "@/lib/auth/sesion";
import { ACUSES, MODULOS } from "@/lib/academia/contenido";
import { iniciarEvaluacion, resolverCaso, terminarEvaluacion, type InicioEvaluacion, type ResultadoEvaluacion, type ResultadoSimulador, type TipoEvaluacion } from "@/lib/academia/motor";
import { conUsuario } from "@/lib/db/prisma";
import { sumarDias } from "@/lib/reglas/fechas";
import { hoyCDMX } from "@/lib/tiempo";
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

export async function resolverCasoPractico(clave: string, captura: Record<string, string | number | null>): Promise<ResultadoSimulador> {
  const { usuario } = await obtenerSesion();
  if (!ROLES.has(usuario.rol)) return { error: "Tu rol no usa la Academia." };
  const r = await resolverCaso(usuario.id, clave, captura);
  revalidatePath("/academia");
  return r;
}

// ───────────── Director: interruptor de bloqueos y excepciones temporales (3.2) ─────────────

export async function cambiarInterruptor(encender: boolean): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director") return { error: "Solo el Director cambia el interruptor." };
  const hoy = hoyCDMX();
  const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
  await conUsuario(claims, async (tx) => {
    const vigente = await tx.parametro.findFirst({ where: { clave: "ACADEMIA_BLOQUEOS", vigente_desde: { lte: dia(hoy) }, OR: [{ vigente_hasta: null }, { vigente_hasta: { gte: dia(hoy) } }] },
      orderBy: { vigente_desde: "desc" }, select: { id: true, vigente_desde: true, tipo: true, descripcion: true } });
    const valor = encender ? "encendido" : "apagado";
    if (vigente && vigente.vigente_desde.toISOString().slice(0, 10) === hoy) {
      await tx.parametro.update({ where: { id: vigente.id }, data: { valor }, select: { id: true } });
    } else {
      if (vigente) await tx.parametro.update({ where: { id: vigente.id }, data: { vigente_hasta: dia(sumarDias(hoy, -1)) }, select: { id: true } });
      await tx.parametro.create({ data: { clave: "ACADEMIA_BLOQUEOS", valor, tipo: vigente?.tipo ?? "texto", descripcion: vigente?.descripcion ?? "Academia: bloqueos por certificación", vigente_desde: dia(hoy), created_by: usuario.id }, select: { id: true } });
    }
  }, ip);
  revalidatePath("/academia");
  revalidatePath("/academia/equipo");
  return { ok: true };
}

export async function otorgarExcepcion(_p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director") return { error: "Solo el Director da excepciones." };
  const usuarioId = String(form.get("usuario_id") ?? "");
  const ruta = String(form.get("ruta") ?? "");
  const dias = Number(form.get("dias") ?? "");
  const motivo = String(form.get("motivo") ?? "").trim();
  const errores: Record<string, string> = {};
  if (!/^[0-9a-f-]{36}$/i.test(usuarioId)) errores.usuario_id = "Elige a la persona";
  if (!["N0", "R1", "R2", "P1", "P2"].includes(ruta)) errores.ruta = "Elige la certificación";
  if (!Number.isInteger(dias) || dias < 1 || dias > 30) errores.dias = "De 1 a 30 días";
  if (motivo.length < 5) errores.motivo = "Escribe el motivo";
  if (Object.keys(errores).length) return { errores };
  try {
    await conUsuario(claims, (tx) => tx.capExcepcion.create({ select: { id: true },
      data: { usuario_id: usuarioId, ruta, hasta: new Date(`${sumarDias(hoyCDMX(), dias)}T00:00:00Z`), motivo, otorgada_por: usuario.id } }), ip);
  } catch {
    return { error: "No se pudo guardar la excepción." };
  }
  revalidatePath("/academia/equipo");
  return { ok: true };
}

export async function revocarExcepcion(id: string): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director") return { error: "Solo el Director revoca excepciones." };
  await conUsuario(claims, (tx) => tx.capExcepcion.updateMany({ where: { id, archivado_at: null }, data: { archivado_at: new Date() } }), ip);
  revalidatePath("/academia/equipo");
  return { ok: true };
}
