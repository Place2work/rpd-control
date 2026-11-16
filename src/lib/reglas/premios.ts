// Premios del equipo (decisión 16-nov-2026): cuántos clientes lleva cada persona hacia la meta de un premio. Función
// pura: recibe el premio y las fechas de cierre (honorario cobrado) ya leídas. La meta sale de la tabla `premios`.
export type FechaISO = string;
export type PremioMeta = { meta: number; desde: FechaISO; hasta: FechaISO | null };
export type Progreso = { logrados: number; faltan: number; pct: number; ganado: boolean };

/** Lo que lleva una persona: solo cuentan los cierres dentro del periodo del premio (desde/hasta, inclusive). */
export function progresoPremio(p: PremioMeta, cierres: FechaISO[]): Progreso {
  const logrados = cierres.filter((f) => f >= p.desde && (p.hasta === null || f <= p.hasta)).length;
  return { logrados, faltan: Math.max(0, p.meta - logrados), pct: Math.min(100, Math.floor((logrados / p.meta) * 100)), ganado: logrados >= p.meta };
}

/** Tabla de avance: primero quien va más adelante; empates, por nombre. */
export function tablaPremio<T extends { nombre: string; cierres: FechaISO[] }>(p: PremioMeta, personas: T[]): (T & Progreso)[] {
  return personas.map((x) => ({ ...x, ...progresoPremio(p, x.cierres) }))
    .sort((a, b) => b.logrados - a.logrados || a.nombre.localeCompare(b.nombre, "es"));
}
