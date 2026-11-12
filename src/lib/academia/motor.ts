// Motor de la Academia (docs/CAPACITACION.md 9.1, 9.3 y 9.4). Abre y califica intentos y otorga
// certificaciones. Corre en el servidor después de verificar la sesión, con `prismaSistema` (como el motor de
// comisiones): las personas no escriben intentos ni certificaciones, así nadie se autoaprueba (CLAUDE.md).
import "server-only";
import { prismaSistema } from "@/lib/db/prisma";
import { calificar, estadoRuta, puedeIntentar, seleccionarPreguntas, venceEl, type AvanceUsuario, type EstadoRuta } from "@/lib/reglas/capacitacion";
import { ACUSES, EVALUACION, MODULOS, PREGUNTAS, RUTAS } from "./contenido";
import type { ClaveAcuse, ClaveRuta, PreguntaServida } from "./tipos";

export type TipoEvaluacion = "quiz_modulo" | "examen_ruta";

export const VIVAS = ["vigente", "por_vencer"];
const iso = (d: Date) => d.toISOString();
const modulosDe = (ruta: ClaveRuta) => MODULOS.filter((m) => m.ruta === ruta).sort((a, b) => a.orden - b.orden);
const versionModulo = new Map(MODULOS.map((m) => [m.clave, m.version]));
const versionAcuse = new Map(ACUSES.map((a) => [a.clave, a.version]));

type FilasAvance = {
  progreso: { modulo: string; version: number }[];
  intentos: { tipo: string; objetivo: string; inicio: Date; fin: Date | null; aprobado: boolean | null; calificacion: unknown }[];
  acuses: { documento: string; version: string }[];
  certs: { ruta: string; vence_at: Date | null }[];
};
export type Avance = AvanceUsuario & { intentos: { tipo: string; objetivo: string; inicio: string; fin: string | null; aprobado: boolean | null; calificacion: number | null }[] };

/** Avance con la versión vigente del contenido (lecturas o acuses de versiones viejas no cuentan). */
export function avanceDesdeFilas(f: FilasAvance, ahora: Date): Avance {
  const hoy = iso(ahora).slice(0, 10);
  return {
    leidos: new Set(f.progreso.filter((p) => versionModulo.get(p.modulo) === p.version).map((p) => p.modulo)),
    examenesAprobados: new Set(f.intentos.filter((i) => i.tipo === "examen_ruta" && i.aprobado).map((i) => i.objetivo as ClaveRuta)),
    acuses: new Set(f.acuses.filter((a) => versionAcuse.get(a.documento as ClaveAcuse) === a.version).map((a) => a.documento as ClaveAcuse)),
    certificadas: new Set(f.certs.filter((c) => !c.vence_at || iso(c.vence_at).slice(0, 10) >= hoy).map((c) => c.ruta as ClaveRuta)),
    intentos: f.intentos.map((i) => ({ tipo: i.tipo, objetivo: i.objetivo, inicio: iso(i.inicio), fin: i.fin ? iso(i.fin) : null, aprobado: i.aprobado,
      calificacion: i.calificacion === null || i.calificacion === undefined ? null : Number(i.calificacion) })),
  };
}

/** Avance de una persona (motor, con la sesión ya verificada). */
export async function avanceDe(usuarioId: string, ahora = new Date()): Promise<Avance> {
  const [progreso, intentos, acuses, certs] = await Promise.all([
    prismaSistema.capProgreso.findMany({ where: { usuario_id: usuarioId, estado: "completado" }, select: { modulo: true, version: true } }),
    prismaSistema.capIntento.findMany({ where: { usuario_id: usuarioId, archivado_at: null }, orderBy: { inicio: "asc" },
      select: { tipo: true, objetivo: true, inicio: true, fin: true, aprobado: true, calificacion: true } }),
    prismaSistema.capAcuse.findMany({ where: { usuario_id: usuarioId }, select: { documento: true, version: true } }),
    prismaSistema.capCertificacion.findMany({ where: { usuario_id: usuarioId, archivado_at: null, estado: { in: VIVAS } }, select: { ruta: true, vence_at: true } }),
  ]);
  return avanceDesdeFilas({ progreso, intentos, acuses, certs }, ahora);
}

export function estadosDe(a: AvanceUsuario): EstadoRuta[] {
  return RUTAS.map((r) => estadoRuta(r, modulosDe(r.clave).map((m) => m.clave), a));
}

/** Otorga las certificaciones que ya se cumplen (9.4). P2 no se otorga sola: requiere entrevista. */
async function otorgarLasQueCumple(usuarioId: string, ahora: Date): Promise<ClaveRuta[]> {
  const otorgadas: ClaveRuta[] = [];
  for (let vuelta = 0; vuelta < RUTAS.length; vuelta++) {
    const a = await avanceDe(usuarioId, ahora);
    const nueva = estadosDe(a).find((e) => e.otorgable && !RUTAS.find((r) => r.clave === e.clave)?.requisitos.entrevista);
    if (!nueva) break;
    const ruta = RUTAS.find((r) => r.clave === nueva.clave)!;
    const vence = venceEl(iso(ahora), ruta.vigencia_meses);
    await prismaSistema.capCertificacion.create({ select: { id: true }, data: {
      usuario_id: usuarioId, ruta: ruta.clave, otorgada_at: ahora, vence_at: vence ? new Date(`${vence}T00:00:00Z`) : null, motivo: "Otorgada por el sistema al cumplir los requisitos",
    } });
    otorgadas.push(ruta.clave);
  }
  return otorgadas;
}

export type InicioEvaluacion = { error?: string; intentoId?: string; preguntas?: PreguntaServida[]; minimo?: number };

/** Abre un intento con preguntas al azar (sin respuestas) si las reglas de intentos y requisitos lo permiten. */
export async function iniciarEvaluacion(usuarioId: string, tipo: TipoEvaluacion, objetivo: string, ahora = new Date()): Promise<InicioEvaluacion> {
  const a = await avanceDe(usuarioId, ahora);
  let banco = PREGUNTAS.filter((p) => (tipo === "quiz_modulo" ? p.modulo === objetivo : p.clave.startsWith(`${objetivo}-`)));
  let minimo: number;
  if (tipo === "examen_ruta") {
    const ruta = RUTAS.find((r) => r.clave === objetivo);
    if (!ruta) return { error: "Ruta desconocida." };
    const estado = estadosDe(a).find((e) => e.clave === ruta.clave)!;
    if (a.examenesAprobados.has(ruta.clave)) return { error: "Ya aprobaste este examen." };
    if (!estado.puedeExamen) return { error: `Antes de presentar el examen: ${estado.pendientes.join(" · ") || estado.bloqueo}.` };
    minimo = ruta.requisitos.examen.minimo;
  } else {
    const modulo = MODULOS.find((m) => m.clave === objetivo);
    if (!modulo) return { error: "Módulo desconocido." };
    const ruta = RUTAS.find((r) => r.clave === modulo.ruta)!;
    if (!estadoRuta(ruta, modulosDe(ruta.clave).map((m) => m.clave), a).disponible) return { error: "Primero certifícate en N0 (Inducción)." };
    minimo = EVALUACION.quiz_modulo.minimo ?? 0.8;
  }
  if (!banco.length) return { error: "Este módulo no tiene quiz." };
  const regla = EVALUACION[tipo];
  const previos = a.intentos.filter((i) => i.tipo === tipo && i.objetivo === objetivo);
  const puede = puedeIntentar(previos, regla, iso(ahora));
  if (!puede.ok) {
    const cuando = puede.desde ? new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date(puede.desde)) : "";
    return { error: puede.motivo === "en_curso" ? "Tienes un intento abierto; termínalo o espera 2 horas." : puede.motivo === "bloqueo"
      ? `Usaste tus ${regla.intentos_max} intentos. Puedes volver a presentarlo desde el ${cuando}; antes repasa con el Director.`
      : `Espera para el siguiente intento: desde el ${cuando}.` };
  }
  const intento = await prismaSistema.capIntento.create({ select: { id: true }, data: { usuario_id: usuarioId, tipo, objetivo, inicio: ahora, preguntas: [] } });
  banco = seleccionarPreguntas(banco, regla.n, tipo === "examen_ruta", intento.id);
  await prismaSistema.capIntento.update({ where: { id: intento.id }, select: { id: true }, data: { preguntas: banco.map((p) => ({ clave: p.clave, version: p.version })) } });
  return { intentoId: intento.id, minimo, preguntas: banco.map((p) => ({ clave: p.clave, tipo: p.tipo, enunciado: p.enunciado, opciones: p.opciones, critica: p.critica })) };
}

export type ResultadoEvaluacion = {
  error?: string; aprobado?: boolean; calificacion?: number; aciertos?: number; total?: number; criticasOk?: boolean; minimo?: number;
  revision?: { clave: string; enunciado: string; critica: boolean; correcta: boolean; tuRespuesta: string; respuestaCorrecta: string; explicacion: string | null }[];
  certificaciones?: ClaveRuta[];
};

/** Califica el intento con la versión de las preguntas servidas y otorga certificaciones si corresponde. */
export async function terminarEvaluacion(usuarioId: string, intentoId: string, respuestas: Record<string, number | null>, ahora = new Date()): Promise<ResultadoEvaluacion> {
  const intento = await prismaSistema.capIntento.findFirst({ where: { id: intentoId, usuario_id: usuarioId, archivado_at: null } });
  if (!intento) return { error: "No encontramos el intento." };
  if (intento.fin) return { error: "Este intento ya se calificó." };
  const servidas = (intento.preguntas as { clave: string }[]).map((s) => PREGUNTAS.find((p) => p.clave === s.clave)).filter((p): p is (typeof PREGUNTAS)[number] => Boolean(p));
  const minimo = intento.tipo === "examen_ruta" ? RUTAS.find((r) => r.clave === intento.objetivo)!.requisitos.examen.minimo : EVALUACION.quiz_modulo.minimo ?? 0.8;
  const limpias = Object.fromEntries(servidas.map((p) => [p.clave, typeof respuestas[p.clave] === "number" ? respuestas[p.clave] : null]));
  const r = calificar(servidas, limpias, minimo);
  await prismaSistema.capIntento.update({ where: { id: intento.id }, select: { id: true },
    data: { fin: ahora, respuestas: limpias, calificacion: r.calificacion, criticas_ok: r.criticasOk, aprobado: r.aprobado } });
  const certificaciones = intento.tipo === "examen_ruta" && r.aprobado ? await otorgarLasQueCumple(usuarioId, ahora) : [];
  const texto = (p: (typeof servidas)[number], v: number | null) => v === null ? "Sin respuesta" : p.tipo === "numerica" ? v.toLocaleString("es-MX") : p.opciones[v] ?? "—";
  return {
    aprobado: r.aprobado, calificacion: r.calificacion, aciertos: r.aciertos, total: r.total, criticasOk: r.criticasOk, minimo, certificaciones,
    revision: servidas.map((p, i) => ({ clave: p.clave, enunciado: p.enunciado, critica: p.critica, correcta: r.detalle[i].correcta,
      tuRespuesta: texto(p, limpias[p.clave]), respuestaCorrecta: texto(p, p.correcta), explicacion: p.explicacion })),
  };
}
