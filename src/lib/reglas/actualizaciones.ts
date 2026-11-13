// Microlecciones de actualización y vigencia de certificaciones (CAPACITACION.md 9.5, 9.6 y 12.3). Funciones puras:
// reciben `hoy`, los valores de los parámetros y los plazos.
import { addDays, addMonths, differenceInCalendarDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { Microleccion, Pregunta } from "../academia/tipos";

export type Valores = Record<string, string>;

// ───────────── Plantillas ─────────────

/** Evalúa una expresión aritmética con P:CLAVE / A:CLAVE (sin eval). Lanza si falta un parámetro o no es numérico. */
export function evaluar(expr: string, P: Valores, A: Valores): number {
  const tokens = expr.match(/[PA]:[A-Z0-9_]+|\d+(?:\.\d+)?|[-+*/()]/g) ?? [];
  if (tokens.join("") !== expr.replace(/\s+/g, "")) throw new Error(`Expresión no válida: ${expr}`);
  let i = 0;
  const valor = (t: string) => {
    const [fuente, clave] = t.split(":");
    const v = Number((fuente === "P" ? P : A)[clave]);
    if (!Number.isFinite(v)) throw new Error(`Falta el parámetro numérico ${t}`);
    return v;
  };
  const factor = (): number => {
    const t = tokens[i++];
    if (t === "(") { const v = suma(); i++; return v; }
    if (t === "-") return -factor();
    if (t && /^[PA]:/.test(t)) return valor(t);
    const n = Number(t);
    if (!Number.isFinite(n)) throw new Error(`Expresión no válida: ${expr}`);
    return n;
  };
  const producto = (): number => { let v = factor(); while (tokens[i] === "*" || tokens[i] === "/") { const op = tokens[i++]; const d = factor(); v = op === "*" ? v * d : v / d; } return v; };
  const suma = (): number => { let v = producto(); while (tokens[i] === "+" || tokens[i] === "-") { const op = tokens[i++]; const d = producto(); v = op === "+" ? v + d : v - d; } return v; };
  const r = suma();
  if (i !== tokens.length) throw new Error(`Expresión no válida: ${expr}`);
  return Math.round(r * 100) / 100;
}

const pesos = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const fechaLarga = (iso: string) => format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: es });

/** Sustituye los {{…}} de un texto. */
export function rellenar(texto: string, P: Valores, A: Valores, desde: string): string {
  return texto.replace(/\{\{([^}]+)\}\}/g, (_, cuerpo: string) => {
    const c = cuerpo.trim();
    if (c === "desde") return fechaLarga(desde);
    const f = c.match(/^fecha:(\d{4}-\d{2}-\d{2})\+(.+)$/);
    if (f) return fechaLarga(format(addDays(parseISO(f[1]), evaluar(f[2], P, A)), "yyyy-MM-dd"));
    const [expr, fmt] = c.split("|");
    const n = evaluar(expr, P, A);
    if (fmt === "pesos") return pesos(n);
    if (fmt === "pct") return `${Math.round(n * 10000) / 100}%`;
    if (fmt === "entero") return String(Math.round(n));
    return String(n);
  });
}

export type PreguntaActualizacion = Pick<Pregunta, "clave" | "tipo" | "enunciado" | "opciones" | "correcta" | "tolerancia" | "explicacion" | "critica">;
export type MicroleccionResuelta = { titulo: string; contenido: string; preguntas: PreguntaActualizacion[] };

/**
 * Llena una plantilla con los valores vigentes (P) y los anteriores (A) al día `desde`. Una pregunta cuyas opciones
 * resultan repetidas (p. ej. el valor no cambió en esa clave) se descarta.
 */
export function resolverMicroleccion(m: Microleccion, P: Valores, A: Valores, desde: string): MicroleccionResuelta {
  const r = (t: string) => rellenar(t, P, A, desde);
  const preguntas = m.preguntas.flatMap((q): PreguntaActualizacion[] => {
    const opciones = q.opciones.map(r);
    if (new Set(opciones).size !== opciones.length) return [];
    const correcta = typeof q.correcta === "number" ? q.correcta : Number(r(q.correcta));
    if (!Number.isFinite(correcta)) return [];
    return [{ clave: `${m.clave}-${q.clave}`, tipo: q.tipo, enunciado: r(q.enunciado), opciones, correcta, tolerancia: q.tolerancia ?? null,
      explicacion: q.explicacion ? r(q.explicacion) : null, critica: false }];
  });
  return { titulo: r(m.titulo), contenido: r(m.contenido), preguntas };
}

/** Plantillas que corresponden a un cambio de parámetro. */
export const plantillasDe = (ms: Microleccion[], parametro: string) => ms.filter((m) => m.parametros.includes(parametro));

// ───────────── Vigencia ─────────────

export type EstadoVigencia = "vigente" | "por_vencer" | "vencida";

/** Estado por fechas de una certificación que no está suspendida ni revocada (9.5). Sin vencimiento: vigente. */
export function estadoVigencia(venceAt: string | null, hoy: string, diasPorVencer: number): EstadoVigencia {
  if (!venceAt) return "vigente";
  if (venceAt < hoy) return "vencida";
  return differenceInCalendarDays(parseISO(venceAt), parseISO(hoy)) <= diasPorVencer ? "por_vencer" : "vigente";
}

/** Nueva fecha de vencimiento al recertificar: desde el vencimiento anterior si no había pasado; si no, desde hoy. */
export function venceAlRecertificar(venceAnterior: string | null, hoy: string, meses: number | null): string | null {
  if (!meses) return null;
  const base = venceAnterior && venceAnterior >= hoy ? venceAnterior : hoy;
  return format(addMonths(parseISO(base), meses), "yyyy-MM-dd");
}

/** Recordatorio de una microlección pendiente hoy: el número de días si toca (7, 21, 28…) y si es el último (crítico). */
export function recordatorioHoy(publicada: string, hoy: string, dias: number[]): { dia: number; critico: boolean } | null {
  const d = differenceInCalendarDays(parseISO(hoy), parseISO(publicada));
  if (!dias.includes(d)) return null;
  return { dia: d, critico: d === Math.max(...dias) };
}

/** «7,21,28» → [7, 21, 28]. */
export const listaDias = (texto: string | undefined) => (texto ?? "").split(",").map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n > 0);

// ───────────── Repasos (9.5) ─────────────

/** Módulo a repasar por tipo de incidencia grave. */
export const MODULO_POR_INCIDENCIA: Record<string, string> = {
  promesa_monto: "N0-02", plazo_prometido: "R1-06", dato_sensible: "N0-02", contrasena_terceros: "N0-02",
  documento_rechazado: "R1-06", alerta_ignorada: "N0-04", queja_cliente: "R1-07", otro: "N0-02",
};

/**
 * Si en la ventana hay `umbral` o más incidencias graves, devuelve los módulos a repasar (el de cada tipo que
 * apareció), con la fecha límite. Si no, una lista vacía.
 */
export function repasosPorGraves(incidencias: { tipo: string; severidad: string; fecha: string }[], hoy: string, p: { ventanaDias: number; umbral: number; plazoDias: number }) {
  const desde = format(addDays(parseISO(hoy), -p.ventanaDias), "yyyy-MM-dd");
  const graves = incidencias.filter((x) => x.severidad === "grave" && x.fecha >= desde && x.fecha <= hoy);
  if (graves.length < p.umbral) return [];
  const limite = format(addDays(parseISO(hoy), p.plazoDias), "yyyy-MM-dd");
  return [...new Set(graves.map((g) => MODULO_POR_INCIDENCIA[g.tipo] ?? "N0-02"))].map((modulo) => ({ modulo, limite }));
}

// ───────────── Alertas de la Academia (12.3) ─────────────

export type AlertaAcademia = {
  regla: "CAP_SIN_AVANCE" | "CAP_ROLEPLAY_POR_EVALUAR" | "CAP_CERT_POR_VENCER" | "CAP_CERT_VENCIDA" | "CAP_ACTUALIZACION_PENDIENTE" | "CAP_PREGUNTAS_REVISAR" | "CAP_METRICA_BAJA"
    | "CAP_REPASO_PENDIENTE" | "CAP_RECONOCIMIENTO";
  severidad: "info" | "aviso" | "critica";
  para: { persona?: string; directores: boolean };
  mensaje: string;
  clave: string;
};
export type DatosAlertasAcademia = {
  certificaciones: { id: string; usuarioId: string; nombre: string; ruta: string; estado: EstadoVigencia; venceAt: string | null }[];
  rutasEnCurso: { usuarioId: string; nombre: string; ruta: string; ultimaActividad: string }[];
  solicitudes: { id: string; usuarioId: string; nombre: string; tipo: string; referencia: string; creada: string }[];
  actualizacionesPendientes: { actualizacionId: string; titulo: string; publicada: string; usuarioId: string }[];
  preguntasRevisar: { cambioId: string; parametro: string; n: number }[];
  metricasBajas: { usuarioId: string; nombre: string; modulos: string[] }[];
  /** Repasos obligatorios abiertos (9.5). Pasada la fecha límite no se suspende nada: solo se recuerda cada semana. */
  repasos?: { id: string; usuarioId: string; nombre: string; modulo: string; limite: string }[];
};
const TIPO_SOLICITUD: Record<string, string> = { roleplay: "juego de roles", acompanamiento: "caso acompañado", entrevista: "entrevista" };

export function alertasAcademia(d: DatosAlertasAcademia, hoy: string, p: { sinAvanceDias: number; solicitudDias: number; recordatorios: number[] }): AlertaAcademia[] {
  const dias = (desde: string) => differenceInCalendarDays(parseISO(hoy), parseISO(desde));
  const semana = format(parseISO(hoy), "RRRR-'S'II");
  const r: AlertaAcademia[] = [];
  for (const c of d.certificaciones) {
    if (c.estado === "por_vencer") r.push({ regla: "CAP_CERT_POR_VENCER", severidad: "aviso", para: { persona: c.usuarioId, directores: true }, clave: `CAP_CERT_POR_VENCER:${c.id}`,
      mensaje: `${c.nombre}: la certificación ${c.ruta} vence el ${c.venceAt ? fechaLarga(c.venceAt) : "—"}. Presenta el examen de recertificación en la Academia.` });
    if (c.estado === "vencida") r.push({ regla: "CAP_CERT_VENCIDA", severidad: "critica", para: { persona: c.usuarioId, directores: true }, clave: `CAP_CERT_VENCIDA:${c.id}`,
      mensaje: `${c.nombre}: la certificación ${c.ruta} venció el ${c.venceAt ? fechaLarga(c.venceAt) : "—"}. Sus permisos de esa ruta se pierden hasta aprobar la recertificación.` });
  }
  for (const x of d.rutasEnCurso) if (dias(x.ultimaActividad) >= p.sinAvanceDias) {
    r.push({ regla: "CAP_SIN_AVANCE", severidad: "aviso", para: { persona: x.usuarioId, directores: true }, clave: `CAP_SIN_AVANCE:${x.usuarioId}:${x.ruta}:${x.ultimaActividad}`,
      mensaje: `${x.nombre}: ${dias(x.ultimaActividad)} días sin avance en la ruta ${x.ruta} de la Academia.` });
  }
  for (const s of d.solicitudes) if (dias(s.creada) >= p.solicitudDias) {
    r.push({ regla: "CAP_ROLEPLAY_POR_EVALUAR", severidad: "aviso", para: { directores: true }, clave: `CAP_ROLEPLAY_POR_EVALUAR:${s.id}`,
      mensaje: `${s.nombre} pidió ${TIPO_SOLICITUD[s.tipo] ?? s.tipo} ${s.referencia} hace ${dias(s.creada)} días.` });
  }
  for (const a of d.actualizacionesPendientes) {
    const rec = recordatorioHoy(a.publicada, hoy, p.recordatorios);
    if (rec) r.push({ regla: "CAP_ACTUALIZACION_PENDIENTE", severidad: rec.critico ? "critica" : "aviso", para: { persona: a.usuarioId, directores: false },
      clave: `CAP_ACTUALIZACION_PENDIENTE:${a.actualizacionId}:${a.usuarioId}:${rec.dia}`,
      mensaje: `Tienes pendiente la microlección «${a.titulo}» (publicada hace ${rec.dia} días).${rec.critico ? " Si no la apruebas a tiempo, tus certificaciones se suspenden." : ""}` });
  }
  for (const q of d.preguntasRevisar) if (q.n > 0) {
    r.push({ regla: "CAP_PREGUNTAS_REVISAR", severidad: "aviso", para: { directores: true }, clave: `CAP_PREGUNTAS_REVISAR:${q.cambioId}`,
      mensaje: `Cambió ${q.parametro}: ${q.n} ${q.n === 1 ? "pregunta queda" : "preguntas quedan"} en revisión y no se sirven en exámenes hasta que las revises.` });
  }
  for (const m of d.metricasBajas) if (m.modulos.length) {
    r.push({ regla: "CAP_METRICA_BAJA", severidad: "info", para: { persona: m.usuarioId, directores: true }, clave: `CAP_METRICA_BAJA:${m.usuarioId}:${semana}`,
      mensaje: `${m.nombre}: dos o más métricas debajo de la meta dos semanas seguidas. Repaso sugerido: ${m.modulos.join(", ")}.` });
  }
  for (const x of d.repasos ?? []) if (x.limite < hoy) {
    r.push({ regla: "CAP_REPASO_PENDIENTE", severidad: "aviso", para: { persona: x.usuarioId, directores: true }, clave: `CAP_REPASO_PENDIENTE:${x.id}:${semana}`,
      mensaje: `${x.nombre}: pendiente cumplir la Academia. El repaso del módulo ${x.modulo} venció el ${fechaLarga(x.limite)}. No se suspende nada: complétalo aprobando el quiz del módulo.` });
  }
  return r;
}

/** Reconocimiento al completar un repaso obligatorio (9.5): le llega a la persona y el Director se entera. */
export function reconocimientoRepaso(x: { id: string; usuarioId: string; nombre: string; modulo: string; limite: string }, hoy: string): AlertaAcademia {
  const aTiempo = hoy <= x.limite;
  return { regla: "CAP_RECONOCIMIENTO", severidad: "info", para: { persona: x.usuarioId, directores: true }, clave: `CAP_RECONOCIMIENTO:${x.id}`,
    mensaje: `¡Felicidades, ${x.nombre}! Completaste el repaso del módulo ${x.modulo}${aTiempo ? " a tiempo" : ""}. Gracias por tu compromiso con cada cliente.` };
}
