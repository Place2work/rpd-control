// Tarea de la Academia (CAPACITACION.md 9.5, 9.6 y 12.3): cambios de parámetros → preguntas en revisión y
// microlecciones; vencimientos; suspensión por microlección no aprobada; repasos; alertas. Es parte del motor de la
// Academia: corre como sistema (tarea diaria) o después de que el Director guardó un parámetro.
import "server-only";
import { addDays, format, parseISO } from "date-fns";
import { prismaSistema } from "@/lib/db/prisma";
import { parametrosVigentes } from "@/lib/parametros";
import { hoyCDMX } from "@/lib/tiempo";
import { alertasAcademia, estadoVigencia, listaDias, plantillasDe, repasosPorGraves, resolverMicroleccion, type AlertaAcademia } from "@/lib/reglas/actualizaciones";
import { MICROLECCIONES, PREGUNTAS } from "./contenido";
import { desempenoDe, lectorSistema } from "./desempeno";
import { avanceDesdeFilas, estadosDe, VIVAS } from "./motor";

const db = prismaSistema;
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoDia = (d: Date) => d.toISOString().slice(0, 10);
const ROLES_OBLIGADOS = ["socio", "vendedor"] as const;

async function plazos(hoy: string) {
  const p = await parametrosVigentes(["CAP_POR_VENCER_DIAS", "CAP_ACTUALIZACION_DIAS", "CAP_ACTUALIZACION_RECORDATORIOS", "CAP_SIN_AVANCE_DIAS", "CAP_SOLICITUD_DIAS", "CAP_REPASO_DIAS", "CAP_GRAVES_DIAS", "CAP_GRAVES_UMBRAL"], hoy);
  const n = (k: string) => { const v = Number(p[k]); if (!Number.isFinite(v)) throw new Error(`Falta el parámetro ${k}`); return v; };
  return {
    porVencer: n("CAP_POR_VENCER_DIAS"), actualizacion: n("CAP_ACTUALIZACION_DIAS"), recordatorios: listaDias(p.CAP_ACTUALIZACION_RECORDATORIOS),
    sinAvance: n("CAP_SIN_AVANCE_DIAS"), solicitud: n("CAP_SOLICITUD_DIAS"), repaso: n("CAP_REPASO_DIAS"), gravesDias: n("CAP_GRAVES_DIAS"), gravesUmbral: n("CAP_GRAVES_UMBRAL"),
  };
}

async function directores() {
  return (await db.usuario.findMany({ where: { rol: "director", activo: true, archivado_at: null }, select: { id: true } })).map((u) => u.id);
}

async function guardarAlertas(alertas: AlertaAcademia[], hoy: string) {
  const dirs = await directores();
  const filas = alertas.flatMap((a) => [...new Set([...(a.para.persona ? [a.para.persona] : []), ...(a.para.directores ? dirs : [])])].map((u) => ({
    regla: a.regla, caso_id: null, severidad: a.severidad, mensaje: a.mensaje, fecha_disparo: dia(hoy), asignado_a: u, clave_dedup: a.clave,
  })));
  return filas.length ? (await db.alerta.createMany({ data: filas, skipDuplicates: true })).count : 0;
}

/** Claves de parámetros que usa una plantilla ({{P:X}} / {{A:X}}). */
const clavesDe = (texto: string) => [...new Set([...texto.matchAll(/[PA]:([A-Z0-9_]+)/g)].map((m) => m[1]))];

/**
 * Cambios de parámetros pendientes (9.6): marca en revisión las preguntas que dependen del parámetro, prepara la
 * microlección (borrador) si hay plantilla y avisa al Director.
 */
export async function procesarCambiosParametro(hoy = hoyCDMX()) {
  const cambios = await db.capCambioParametro.findMany({ where: { procesado_at: null }, orderBy: { created_at: "asc" } });
  let revisar = 0, borradores = 0;
  for (const c of cambios) {
    const preguntas = PREGUNTAS.filter((p) => p.parametros.includes(c.parametro_clave));
    if (preguntas.length) {
      revisar += (await db.capPreguntaRevision.createMany({ data: preguntas.map((p) => ({ pregunta: p.clave, version: p.version, cambio_id: c.id })), skipDuplicates: true })).count;
      await guardarAlertas(alertasAcademia({ certificaciones: [], rutasEnCurso: [], solicitudes: [], actualizacionesPendientes: [], metricasBajas: [],
        preguntasRevisar: [{ cambioId: c.id, parametro: c.parametro_clave, n: preguntas.length }] }, hoy, { sinAvanceDias: 0, solicitudDias: 0, recordatorios: [] }), hoy);
    }
    const desde = isoDia(c.vigente_desde);
    for (const m of plantillasDe(MICROLECCIONES, c.parametro_clave)) {
      const claves = clavesDe(JSON.stringify(m));
      try {
        const P = await parametrosVigentes(claves, desde);
        const A = await parametrosVigentes(claves, format(addDays(parseISO(desde), -1), "yyyy-MM-dd"));
        const r = resolverMicroleccion(m, P, A, desde);
        borradores += (await db.capActualizacion.createMany({ skipDuplicates: true, data: [{
          plantilla: m.clave, cambio_id: c.id, parametro_clave: c.parametro_clave, vigente_desde: c.vigente_desde, titulo: r.titulo, contenido: r.contenido, preguntas: r.preguntas,
        }] })).count;
      } catch (e) {
        console.error(`[academia] no se pudo preparar la microlección ${m.clave}:`, (e as Error).message);
      }
    }
    await db.capCambioParametro.update({ where: { id: c.id }, data: { procesado_at: new Date() }, select: { id: true } });
  }
  return { cambios: cambios.length, preguntas_en_revision: revisar, microlecciones_preparadas: borradores };
}

/** Publica una microlección: corre el plazo para aprobarla. */
export async function publicarActualizacion(id: string, hoy: string, publicadaPor: string | null) {
  const p = await plazos(hoy);
  return db.capActualizacion.updateMany({ where: { id, estado: "borrador", archivado_at: null },
    data: { estado: "publicada", publicada_at: new Date(), publicada_por: publicadaPor, fecha_limite: dia(format(addDays(parseISO(hoy), p.actualizacion), "yyyy-MM-dd")) } });
}

/** Quién debe tomar una microlección: asesores de pensiones activos con alguna certificación viva al publicarse. */
export async function obligadosDe(publicadaAt: Date) {
  const certs = await db.capCertificacion.findMany({
    where: { archivado_at: null, estado: { in: [...VIVAS, "suspendida"] }, otorgada_at: { lte: publicadaAt }, usuario: { rol: { in: [...ROLES_OBLIGADOS] }, activo: true, archivado_at: null } },
    select: { usuario_id: true },
  });
  return [...new Set(certs.map((c) => c.usuario_id))];
}

/** 2 incidencias graves en la ventana → repaso obligatorio del módulo relacionado (9.5). */
export async function revisarRepasos(usuarioId: string, hoy = hoyCDMX()) {
  const p = await plazos(hoy);
  const desde = new Date(Date.parse(`${hoy}T00:00:00Z`) - (p.gravesDias + 1) * 864e5);
  const inc = await db.capIncidencia.findMany({ where: { usuario_id: usuarioId, archivado_at: null, severidad: "grave", created_at: { gte: desde } }, select: { tipo: true, severidad: true, created_at: true } });
  const repasos = repasosPorGraves(inc.map((x) => ({ tipo: x.tipo, severidad: x.severidad, fecha: hoyCDMX(x.created_at) })), hoy, { ventanaDias: p.gravesDias, umbral: p.gravesUmbral, plazoDias: p.repaso });
  if (!repasos.length) return 0;
  return (await db.capRepaso.createMany({ skipDuplicates: true, data: repasos.map((r) => ({ usuario_id: usuarioId, modulo: r.modulo, fecha_limite: dia(r.limite),
    motivo: `${p.gravesUmbral} o más incidencias graves en ${p.gravesDias} días` })) })).count;
}

/** Tarea diaria de la Academia. */
export async function tareaAcademia(hoy = hoyCDMX(), ahora = new Date()) {
  const p = await plazos(hoy);
  const procesados = await procesarCambiosParametro(hoy);

  // Microlecciones listas cuyo parámetro ya está vigente: se publican solas.
  const listas = await db.capActualizacion.findMany({ where: { estado: "borrador", archivado_at: null, vigente_desde: { lte: dia(hoy) } }, select: { id: true } });
  for (const a of listas) await publicarActualizacion(a.id, hoy, null);

  // Vencimientos (9.5): por vencer 30 días antes; vencida al pasar la fecha.
  const vivas = await db.capCertificacion.findMany({ where: { archivado_at: null, estado: { in: VIVAS } }, select: { id: true, estado: true, vence_at: true } });
  let cambiosVigencia = 0;
  for (const c of vivas) {
    const e = estadoVigencia(c.vence_at ? isoDia(c.vence_at) : null, hoy, p.porVencer);
    if (e !== c.estado) { await db.capCertificacion.update({ where: { id: c.id }, select: { id: true }, data: { estado: e, ...(e === "vencida" ? { motivo: "Vencida: requiere recertificación" } : {}) } }); cambiosVigencia++; }
  }

  // Microlecciones con plazo vencido: quien no la aprobó queda suspendido hasta aprobarla.
  const publicadas = await db.capActualizacion.findMany({ where: { estado: "publicada", archivado_at: null }, select: { id: true, titulo: true, publicada_at: true, fecha_limite: true, aprobadas: { select: { usuario_id: true } } } });
  const pendientes: { actualizacionId: string; titulo: string; publicada: string; usuarioId: string }[] = [];
  let suspendidas = 0;
  for (const a of publicadas) {
    const aprobaron = new Set(a.aprobadas.map((x) => x.usuario_id));
    const faltan = (await obligadosDe(a.publicada_at!)).filter((u) => !aprobaron.has(u));
    pendientes.push(...faltan.map((u) => ({ actualizacionId: a.id, titulo: a.titulo, publicada: hoyCDMX(a.publicada_at!), usuarioId: u })));
    if (isoDia(a.fecha_limite!) < hoy && faltan.length) {
      suspendidas += (await db.capCertificacion.updateMany({ where: { usuario_id: { in: faltan }, archivado_at: null, estado: { in: VIVAS } },
        data: { estado: "suspendida", suspendida_por: `actualizacion:${a.id}`, motivo: `Suspendida: no aprobó la microlección «${a.titulo}» a tiempo` } })).count;
    }
  }

  // Datos para las alertas (12.3).
  const personas = await db.usuario.findMany({ where: { rol: { in: [...ROLES_OBLIGADOS] }, activo: true, archivado_at: null }, select: { id: true, nombre: true, socio_id: true } });
  const ids = personas.map((u) => u.id);
  const nombre = new Map(personas.map((u) => [u.id, u.nombre]));
  const [certs, progreso, intentos, acuses, casos, solicitudes, revisarPorCambio] = await Promise.all([
    db.capCertificacion.findMany({ where: { usuario_id: { in: ids }, archivado_at: null, estado: { in: ["por_vencer", "vencida", "vigente"] } }, select: { id: true, usuario_id: true, ruta: true, estado: true, vence_at: true } }),
    db.capProgreso.findMany({ where: { usuario_id: { in: ids }, estado: "completado" }, select: { usuario_id: true, modulo: true, version: true, updated_at: true } }),
    db.capIntento.findMany({ where: { usuario_id: { in: ids }, archivado_at: null }, orderBy: { inicio: "asc" }, select: { usuario_id: true, tipo: true, objetivo: true, inicio: true, fin: true, aprobado: true, calificacion: true } }),
    db.capAcuse.findMany({ where: { usuario_id: { in: ids } }, select: { usuario_id: true, documento: true, version: true } }),
    db.capCasoIntento.findMany({ where: { usuario_id: { in: ids } }, select: { usuario_id: true, caso: true, version: true, aprobado: true, created_at: true } }),
    db.capSolicitud.findMany({ where: { estado: "pendiente" }, select: { id: true, usuario_id: true, tipo: true, referencia: true, created_at: true, usuario: { select: { nombre: true } } } }),
    db.capPreguntaRevision.groupBy({ by: ["cambio_id"], where: { estado: "revisar" }, _count: { _all: true } }),
  ]);
  const rutasEnCurso = personas.flatMap((u) => {
    const de = <T extends { usuario_id: string }>(xs: T[]) => xs.filter((x) => x.usuario_id === u.id);
    const a = avanceDesdeFilas({ progreso: de(progreso), intentos: de(intentos), acuses: de(acuses), certs: de(certs).filter((c) => c.estado !== "vencida"), casos: de(casos) }, ahora);
    const fechas = [...de(progreso).map((x) => x.updated_at), ...de(intentos).map((x) => x.fin ?? x.inicio), ...de(casos).map((x) => x.created_at)];
    if (!fechas.length) return [];
    const ultima = hoyCDMX(new Date(Math.max(...fechas.map((f) => f.getTime()))));
    return estadosDe(a).filter((e) => e.disponible && e.avance > 0 && !a.certificadas.has(e.clave)).map((e) => ({ usuarioId: u.id, nombre: u.nombre, ruta: e.clave, ultimaActividad: ultima }));
  });
  const cambiosRevisar = await db.capCambioParametro.findMany({ where: { id: { in: revisarPorCambio.map((x) => x.cambio_id) } }, select: { id: true, parametro_clave: true } });
  const filasDesempeno = await desempenoDe(lectorSistema, personas.map((u) => ({ usuarioId: u.id, socioId: u.socio_id, nombre: u.nombre })), ahora).catch((e) => { console.error("[academia] desempeño", e); return []; });
  const alertas = alertasAcademia({
    certificaciones: certs.map((c) => ({ id: c.id, usuarioId: c.usuario_id, nombre: nombre.get(c.usuario_id) ?? "Asesor", ruta: c.ruta, estado: c.estado as "vigente" | "por_vencer" | "vencida",
      venceAt: c.vence_at ? isoDia(c.vence_at) : null })),
    rutasEnCurso,
    solicitudes: solicitudes.map((s) => ({ id: s.id, usuarioId: s.usuario_id, nombre: s.usuario.nombre, tipo: s.tipo, referencia: s.referencia, creada: hoyCDMX(s.created_at) })),
    actualizacionesPendientes: pendientes,
    preguntasRevisar: cambiosRevisar.map((c) => ({ cambioId: c.id, parametro: c.parametro_clave, n: revisarPorCambio.find((x) => x.cambio_id === c.id)?._count._all ?? 0 })),
    metricasBajas: filasDesempeno.filter((f) => f.socioId).map((f) => ({ usuarioId: f.usuarioId, nombre: f.nombre, modulos: f.repaso.modulos })),
  }, hoy, { sinAvanceDias: p.sinAvance, solicitudDias: p.solicitud, recordatorios: p.recordatorios });
  const nuevas = await guardarAlertas(alertas, hoy);

  return { academia_cambios: procesados.cambios, academia_publicadas: listas.length, academia_vigencia: cambiosVigencia, academia_suspendidas: suspendidas, academia_alertas: nuevas };
}
