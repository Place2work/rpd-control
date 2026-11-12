"use server";

// Academia: firmar acuses y marcar lecciones leídas (con RLS), y abrir/calificar evaluaciones (motor).
import { revalidatePath } from "next/cache";
import { obtenerSesion } from "@/lib/auth/sesion";
import { ACUSES, MODULOS, ROLEPLAYS, RUBRICA } from "@/lib/academia/contenido";
import { calificarRoleplay } from "@/lib/reglas/capacitacion";
import { TIPOS_INCIDENCIA } from "@/lib/academia/incidencias";
import { iniciarEvaluacion, otorgarLasQueCumple, resolverCaso, terminarEvaluacion, type InicioEvaluacion, type ResultadoEvaluacion, type ResultadoSimulador, type TipoEvaluacion } from "@/lib/academia/motor";
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

// ───────────── Fase C: evaluación humana, incidencias y metas (9.2, 9.5, 10) ─────────────

const UUID = /^[0-9a-f-]{36}$/i;
const txt = (form: FormData, k: string) => String(form.get(k) ?? "").trim();
async function soloDirector() {
  const s = await obtenerSesion();
  return s.usuario.rol === "director" ? s : null;
}
async function cerrarSolicitudes(s: Awaited<ReturnType<typeof obtenerSesion>>, usuarioId: string, tipo: string, referencia: string) {
  await conUsuario(s.claims, (tx) => tx.capSolicitud.updateMany({ where: { usuario_id: usuarioId, tipo, referencia, estado: "pendiente" }, data: { estado: "atendida" } }), s.ip);
}
async function despuesDeEvaluar(usuarioId: string) {
  const certificaciones = await otorgarLasQueCumple(usuarioId, new Date());
  revalidatePath("/academia");
  revalidatePath("/academia/equipo");
  revalidatePath(`/academia/equipo/${usuarioId}`);
  return certificaciones;
}
const conCertificaciones = (c: string[]): Resultado => (c.length ? { ok: true, mensaje: `¡Certificación ${c.join(", ")} otorgada!` } : { ok: true });

export async function evaluarRoleplay(usuarioId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await soloDirector();
  if (!s) return { error: "Solo el Director califica juegos de roles." };
  const roleplay = txt(form, "roleplay");
  if (!ROLEPLAYS.some((r) => r.clave === roleplay)) return { errores: { roleplay: "Elige el juego de roles" } };
  const cumple = Object.fromEntries(RUBRICA.criterios.map((c) => [c.clave, form.get(c.clave) === "si"]));
  const r = calificarRoleplay(RUBRICA.criterios, cumple, RUBRICA.minimo);
  await conUsuario(s.claims, (tx) => tx.capEvaluacionRoleplay.create({ select: { id: true }, data: {
    usuario_id: usuarioId, roleplay, evaluador_id: s.usuario.id, cumple, total: r.total, eliminatorio_fallado: r.eliminatorioFallado, aprobado: r.aprobado,
    comentarios: txt(form, "comentarios") || null,
  } }), s.ip);
  await cerrarSolicitudes(s, usuarioId, "roleplay", roleplay);
  const c = await despuesDeEvaluar(usuarioId);
  return r.aprobado ? conCertificaciones(c) : { error: `Registrado: ${r.total} puntos${r.eliminatorioFallado ? " con un criterio eliminatorio fallado" : ""} → no aprobado. Puede volver a presentarlo.` };
}

async function casoPorFolio(s: Awaited<ReturnType<typeof obtenerSesion>>, folio: string) {
  return conUsuario(s.claims, (tx) => tx.caso.findFirst({ where: { folio: folio.toUpperCase(), archivado_at: null }, select: { id: true, datos_imss: { select: { regimen: true } } } }), s.ip);
}

export async function registrarAcompanamiento(usuarioId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await soloDirector();
  if (!s) return { error: "Solo el Director registra acompañamientos." };
  const ruta = txt(form, "ruta"), modo = txt(form, "modo"), folio = txt(form, "folio");
  if (ruta !== "R1" && ruta !== "R2") return { errores: { ruta: "Elige R1 o R2" } };
  if (modo !== "observa" && modo !== "observado") return { errores: { modo: "Elige el modo" } };
  const caso = await casoPorFolio(s, folio);
  if (!caso) return { errores: { folio: "No encontramos ese folio" } };
  const ley73 = caso.datos_imss?.regimen === "L73";
  if (ruta === "R2" && !ley73) return { errores: { folio: "Para R2 el caso acompañado debe ser Ley 73 (captura el régimen en IMSS y Afore)" } };
  await conUsuario(s.claims, (tx) => tx.capShadowing.create({ select: { id: true }, data: {
    usuario_id: usuarioId, ruta, caso_id: caso.id, modo, ley73, evaluador_id: s.usuario.id, cumple: form.get("cumple") === "si", notas: txt(form, "notas") || null,
  } }), s.ip);
  await cerrarSolicitudes(s, usuarioId, "acompanamiento", ruta);
  return conCertificaciones(await despuesDeEvaluar(usuarioId));
}

export async function validarDiagnostico(usuarioId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await soloDirector();
  if (!s) return { error: "Solo el Director valida diagnósticos." };
  const caso = await casoPorFolio(s, txt(form, "folio"));
  if (!caso) return { errores: { folio: "No encontramos ese folio" } };
  await conUsuario(s.claims, (tx) => tx.capDiagnosticoValidado.create({ select: { id: true }, data: {
    usuario_id: usuarioId, caso_id: caso.id, validado_por: s.usuario.id, correccion_grave: form.get("correccion_grave") === "si", notas: txt(form, "notas") || null,
  } }), s.ip);
  return conCertificaciones(await despuesDeEvaluar(usuarioId));
}

export async function registrarEntrevista(usuarioId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await soloDirector();
  if (!s) return { error: "Solo el Director registra la entrevista." };
  await conUsuario(s.claims, (tx) => tx.capEntrevista.create({ select: { id: true }, data: {
    usuario_id: usuarioId, evaluador_id: s.usuario.id, aprobada: form.get("aprobada") === "si", notas: txt(form, "notas") || null,
  } }), s.ip);
  await cerrarSolicitudes(s, usuarioId, "entrevista", "P2");
  return conCertificaciones(await despuesDeEvaluar(usuarioId));
}


/** Incidencia (9.5): la registran el Director o el analista; la de línea roja suspende todo en la base (disparador). */
export async function registrarIncidencia(casoId: string | null, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await obtenerSesion();
  if (s.usuario.rol !== "director" && s.usuario.rol !== "asesor") return { error: "Solo el Director o el analista registran incidencias." };
  const usuarioId = txt(form, "usuario_id"), tipo = txt(form, "tipo"), severidad = txt(form, "severidad"), descripcion = txt(form, "descripcion");
  const errores: Record<string, string> = {};
  if (!UUID.test(usuarioId)) errores.usuario_id = "Elige a la persona";
  if (!TIPOS_INCIDENCIA.some(([k]) => k === tipo)) errores.tipo = "Elige el tipo";
  if (!["leve", "grave", "linea_roja"].includes(severidad)) errores.severidad = "Elige la severidad";
  if (descripcion.length < 5) errores.descripcion = "Describe lo que pasó";
  if (Object.keys(errores).length) return { errores };
  await conUsuario(s.claims, async (tx) => {
    await tx.capIncidencia.create({ select: { id: true }, data: { usuario_id: usuarioId, caso_id: casoId, tipo, severidad, descripcion, accion: txt(form, "accion") || null, registrada_por: s.usuario.id } });
    if (casoId) await tx.evento.create({ data: { caso_id: casoId, tipo: "sistema", usuario_id: s.usuario.id,
      texto: `Se registró una incidencia de capacitación (${severidad === "linea_roja" ? "línea roja" : severidad}) del asesor de pensiones.` } });
  }, s.ip);
  revalidatePath("/academia/equipo");
  revalidatePath(`/academia/equipo/${usuarioId}`);
  if (casoId) revalidatePath(`/casos/${casoId}`);
  return severidad === "linea_roja" ? { ok: true, mensaje: "Línea roja: sus certificaciones quedaron suspendidas hasta que el Director las reactive." } : { ok: true };
}

/** Reactivar tras revisión o revocar una certificación, con motivo (9.4, 9.5). */
export async function cambiarCertificacion(certId: string, estado: "vigente" | "revocada", _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await soloDirector();
  if (!s) return { error: "Solo el Director reactiva o revoca certificaciones." };
  const motivo = txt(form, "motivo");
  if (motivo.length < 5) return { errores: { motivo: "Escribe el motivo" } };
  const cert = await conUsuario(s.claims, (tx) => tx.capCertificacion.findUnique({ where: { id: certId }, select: { usuario_id: true } }), s.ip);
  if (!cert) return { error: "No encontramos la certificación." };
  await conUsuario(s.claims, (tx) => tx.capCertificacion.update({ where: { id: certId }, data: { estado, motivo }, select: { id: true } }), s.ip);
  revalidatePath(`/academia/equipo/${cert.usuario_id}`);
  revalidatePath("/academia/equipo");
  return { ok: true };
}

/** El asesor pide su juego de roles, acompañamiento o entrevista; aparece en «Por evaluar» del Director. */
export async function solicitarEvaluacion(tipo: "roleplay" | "acompanamiento" | "entrevista", referencia: string): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (!ROLES.has(usuario.rol)) return { error: "Tu rol no usa la Academia." };
  try {
    await conUsuario(claims, (tx) => tx.capSolicitud.create({ select: { id: true }, data: { usuario_id: usuario.id, tipo, referencia } }), ip);
  } catch {
    return { error: "Ya tienes una solicitud pendiente de eso." };
  }
  revalidatePath("/academia");
  revalidatePath("/academia/equipo");
  return { ok: true, mensaje: "Listo: el Director ya lo ve en «Por evaluar»." };
}

export async function guardarMetas(_p: Resultado, form: FormData): Promise<Resultado> {
  const s = await soloDirector();
  if (!s) return { error: "Solo el Director cambia las metas." };
  const hoy = new Date(`${hoyCDMX()}T00:00:00Z`);
  const cambios: { metrica: string; valor: number }[] = [];
  for (const [k, v] of form.entries()) {
    if (!k.startsWith("meta_") || typeof v !== "string" || !v.trim()) continue;
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 100) return { errores: { [k]: "De 0 a 100" } };
    const metrica = k.slice(5);
    if (!/^[a-z0-9_]+$/.test(metrica)) continue;
    // Las de línea roja son un número de incidencias; las demás, porcentaje.
    cambios.push({ metrica, valor: metrica === "linea_roja" ? Math.round(n) : Math.round(n * 100) / 10000 });
  }
  await conUsuario(s.claims, async (tx) => {
    for (const c of cambios) {
      const vigente = await tx.capMeta.findFirst({ where: { metrica: c.metrica, vigente_desde: { lte: hoy } }, orderBy: { vigente_desde: "desc" }, select: { valor: true } });
      if (vigente && Number(vigente.valor) === c.valor) continue;
      await tx.capMeta.upsert({ where: { metrica_vigente_desde: { metrica: c.metrica, vigente_desde: hoy } }, update: { valor: c.valor }, create: { metrica: c.metrica, valor: c.valor, vigente_desde: hoy, created_by: s.usuario.id }, select: { id: true } });
    }
  }, s.ip);
  revalidatePath("/academia/desempeno");
  revalidatePath("/academia/equipo");
  return { ok: true };
}
