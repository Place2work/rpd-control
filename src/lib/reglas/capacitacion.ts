// Reglas de la Academia (docs/CAPACITACION.md secciones 3.2, 9.1, 9.3 y 9.4). Puras: reciben el contenido,
// el avance y `ahora`; no leen la base ni el reloj. Los mínimos, intentos y esperas vienen del contenido
// (content/academia/rutas.json y evaluacion.json), no del código.
import type { ClaveAcuse, ClaveRuta, Pregunta, ReglaIntentos, Ruta } from "@/lib/academia/tipos";

// ───────────── Selección de preguntas ─────────────

function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * Preguntas de una evaluación, en orden «al azar» pero reproducible con la semilla (el id del intento).
 * Con `incluirCriticas`, entran todas las críticas aunque pasen de `n` (examen de ruta, 9.1).
 */
export function seleccionarPreguntas<T extends { clave: string; critica: boolean }>(banco: T[], n: number, incluirCriticas: boolean, semilla: string): T[] {
  const mezcla = (xs: T[]) => [...xs].sort((a, b) => hash(semilla + a.clave) - hash(semilla + b.clave));
  if (!incluirCriticas) return mezcla(banco).slice(0, n);
  const criticas = banco.filter((p) => p.critica);
  const resto = mezcla(banco.filter((p) => !p.critica)).slice(0, Math.max(0, n - criticas.length));
  return mezcla([...criticas, ...resto]);
}

// ───────────── Calificación ─────────────

export type Calificacion = {
  aciertos: number; total: number; calificacion: number; criticasOk: boolean; criticasFalladas: string[]; aprobado: boolean;
  detalle: { clave: string; correcta: boolean }[];
};

export function esCorrecta(p: Pick<Pregunta, "tipo" | "correcta" | "tolerancia">, respuesta: number | null | undefined): boolean {
  if (respuesta === null || respuesta === undefined || !Number.isFinite(respuesta)) return false;
  if (p.tipo === "numerica") return Math.abs(respuesta - p.correcta) <= (p.tolerancia ?? 0) + 1e-9;
  return respuesta === p.correcta;
}

/** Aprueba con la calificación mínima **y** todas las críticas bien, aunque el total pase del mínimo (9.1, 14.1). */
export function calificar(preguntas: Pick<Pregunta, "clave" | "tipo" | "correcta" | "tolerancia" | "critica">[], respuestas: Record<string, number | null>, minimo: number): Calificacion {
  const detalle = preguntas.map((p) => ({ clave: p.clave, correcta: esCorrecta(p, respuestas[p.clave]) }));
  const aciertos = detalle.filter((d) => d.correcta).length;
  const total = preguntas.length;
  const criticasFalladas = preguntas.filter((p, i) => p.critica && !detalle[i].correcta).map((p) => p.clave);
  const calificacion = total ? Math.round((aciertos / total) * 10000) / 10000 : 0;
  const criticasOk = criticasFalladas.length === 0;
  return { aciertos, total, calificacion, criticasOk, criticasFalladas, aprobado: total > 0 && criticasOk && calificacion + 1e-9 >= minimo, detalle };
}

// ───────────── Intentos y esperas (9.3) ─────────────

export type IntentoPrevio = { inicio: string; fin: string | null; aprobado: boolean | null };
export type PuedeIntentar = { ok: true } | { ok: false; motivo: "espera" | "bloqueo" | "en_curso"; desde?: string };

const masHoras = (iso: string, h: number) => new Date(new Date(iso).getTime() + h * 3600_000).toISOString();

/**
 * ¿Puede empezar otro intento? Quiz: ilimitados con espera entre intentos. Examen: después de `intentos_max`
 * fallidos seguidos, espera `bloqueo_dias` y vuelve a tener `intentos_max`.
 */
export function puedeIntentar(previos: IntentoPrevio[], regla: ReglaIntentos, ahoraIso: string): PuedeIntentar {
  const orden = [...previos].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const abierto = orden.find((a) => !a.fin && masHoras(a.inicio, 2) > ahoraIso);
  if (abierto) return { ok: false, motivo: "en_curso" };
  const terminados = orden.filter((a) => a.fin);
  const ultimo = terminados.at(-1);
  if (ultimo && regla.espera_horas > 0 && !ultimo.aprobado) {
    const desde = masHoras(ultimo.fin!, regla.espera_horas);
    if (desde > ahoraIso) return { ok: false, motivo: "espera", desde };
  }
  if (regla.intentos_max) {
    let fallos = 0;
    let ultimoFallo: string | null = null;
    for (const a of terminados) {
      if (fallos >= regla.intentos_max && ultimoFallo && a.inicio >= masHoras(ultimoFallo, regla.bloqueo_dias * 24)) fallos = 0;
      if (a.aprobado) fallos = 0; else { fallos++; ultimoFallo = a.fin; }
    }
    if (fallos >= regla.intentos_max && ultimoFallo) {
      const desde = masHoras(ultimoFallo, regla.bloqueo_dias * 24);
      if (desde > ahoraIso) return { ok: false, motivo: "bloqueo", desde };
    }
  }
  return { ok: true };
}

// ───────────── Estado de una ruta (3.2 y 9.4) ─────────────

export type AvanceUsuario = {
  leidos: Set<string>;                    // módulos marcados como leídos (versión vigente)
  examenesAprobados: Set<ClaveRuta>;
  acuses: Set<ClaveAcuse>;
  certificadas: Set<ClaveRuta>;           // certificaciones vigentes
};

export type EstadoRuta = {
  clave: ClaveRuta;
  disponible: boolean;       // puede leer las lecciones
  puedeExamen: boolean;
  modulosLeidos: number; modulosTotal: number; avance: number;
  pendientes: string[];      // lo que falta y ya se puede hacer
  proximamente: string[];    // requisitos de fases posteriores (casos, juegos de roles, acompañamientos…)
  otorgable: boolean;        // cumple todo: se otorga la certificación (9.4)
  bloqueo?: string;          // por qué no está disponible
};

const PROXIMAMENTE = (r: Ruta["requisitos"]) => [
  r.casos ? `${r.casos} casos prácticos en el simulador` : null,
  r.roleplays?.length ? `Juego de roles ${r.roleplays.join(" y ")} con el Director` : null,
  r.shadowing ? `${r.shadowing} casos acompañados` : null,
  r.diagnosticos ? `${r.diagnosticos} diagnósticos validados` : null,
  r.entrevista ? "Entrevista con el Director" : null,
].filter((x): x is string => Boolean(x));

/**
 * Lecturas: N0 siempre; las demás rutas con N0 certificada. Examen: todos los módulos leídos, acuses firmados
 * (N0) y el examen de la ruta previa aprobado. Certificación: además, la ruta previa certificada y los
 * requisitos de práctica (casos, juegos de roles, acompañamientos), que llegan en las fases B y C.
 */
export function estadoRuta(ruta: Ruta, modulosRuta: string[], a: AvanceUsuario): EstadoRuta {
  const leidos = modulosRuta.filter((m) => a.leidos.has(m)).length;
  const acusesFaltan = (ruta.requisitos.acuses ?? []).filter((x) => !a.acuses.has(x));
  const disponible = ruta.clave === "N0" || a.certificadas.has("N0");
  const prereqExamen = ruta.prerrequisitos.every((p) => a.examenesAprobados.has(p));
  const examen = a.examenesAprobados.has(ruta.clave);
  const pendientes = [
    acusesFaltan.length ? "Firmar el Código de conducta y el aviso de privacidad interno" : null,
    leidos < modulosRuta.length ? `Leer ${modulosRuta.length - leidos} ${modulosRuta.length - leidos === 1 ? "módulo" : "módulos"}` : null,
    !examen ? `Aprobar el examen de ruta (${Math.round(ruta.requisitos.examen.minimo * 100)}% y todas las críticas)` : null,
    !prereqExamen ? `Aprobar antes el examen de ${ruta.prerrequisitos.join(", ")}` : null,
  ].filter((x): x is string => Boolean(x));
  const proximamente = PROXIMAMENTE(ruta.requisitos);
  const prereqCert = ruta.prerrequisitos.every((p) => a.certificadas.has(p));
  return {
    clave: ruta.clave, disponible,
    puedeExamen: disponible && leidos === modulosRuta.length && acusesFaltan.length === 0 && prereqExamen && !examen,
    modulosLeidos: leidos, modulosTotal: modulosRuta.length,
    avance: Math.round(((leidos + (examen ? 1 : 0)) / (modulosRuta.length + 1)) * 100),
    pendientes, proximamente,
    otorgable: disponible && pendientes.length === 0 && proximamente.length === 0 && prereqCert && !a.certificadas.has(ruta.clave),
    bloqueo: disponible ? undefined : "Primero certifícate en N0 (Inducción)",
  };
}

/** Fecha de vencimiento (ISO yyyy-mm-dd) a `meses` de la fecha de otorgamiento; null si no vence (N0). */
export function venceEl(otorgadaIso: string, meses: number | null): string | null {
  if (!meses) return null;
  const [y, m, d] = otorgadaIso.slice(0, 10).split("-").map(Number);
  const total = m - 1 + meses;
  const anio = y + Math.floor(total / 12), mes = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${anio}-${String(mes).padStart(2, "0")}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}
