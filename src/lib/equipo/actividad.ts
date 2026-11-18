// Equipo en vivo (16-nov-2026): la actividad del día convertida en lo que hace cada avatar en la oficina 3D.
// Función pura: recibe los registros ya leídos y la hora. Nunca lleva nombres, teléfonos ni datos del cliente:
// solo quién del equipo hizo qué (y el municipio, en campo).
export type TipoActividad = "prospecto" | "campo" | "verificacion" | "etapa" | "cierre" | "jornada";
export type Actividad = { id: string; tipo: TipoActividad; usuarioId: string; at: string; detalle?: string | null };
export type Departamento = "direccion" | "analisis" | "asesores" | "vendedores" | "calle";

export const DEPARTAMENTO_DE_ROL: Record<string, Departamento> = {
  director: "direccion", asesor: "analisis", socio: "asesores", vendedor: "vendedores", campo: "calle",
};

export const NOMBRE_DEPARTAMENTO: Record<Departamento, string> = {
  direccion: "Dirección",
  analisis: "Análisis y verificación",
  asesores: "Asesores de pensiones",
  vendedores: "Vendedores",
  calle: "Calle · cambaceo",
};

/** Texto corto de la burbuja sobre el avatar. */
export function burbuja(a: Actividad): string {
  switch (a.tipo) {
    case "prospecto": return "+1 prospecto";
    case "campo": return a.detalle ? `+1 en ${a.detalle}` : "+1 prospecto de calle";
    case "verificacion": return "Verificó 1";
    case "etapa": return a.detalle ? `→ ${a.detalle}` : "Avanzó un caso";
    case "cierre": return "¡Honorario cobrado!";
    case "jornada": return a.detalle ? `Módulo en ${a.detalle}` : "Módulo instalado";
  }
}

/** Renglón del registro en vivo: «Niceforo levantó un prospecto en Jiutepec». */
export function renglon(a: Actividad, nombre: string): string {
  const quien = nombre.split(/\s+/)[0].toLowerCase().replace(/^./, (c) => c.toUpperCase());
  switch (a.tipo) {
    case "prospecto": return `${quien} registró un prospecto`;
    case "campo": return `${quien} levantó un prospecto${a.detalle ? ` en ${a.detalle}` : " en la calle"}`;
    case "verificacion": return `${quien} verificó un prospecto de campo`;
    case "etapa": return `${quien} movió un caso${a.detalle ? ` a «${a.detalle}»` : ""}`;
    case "cierre": return `${quien} cerró un caso: honorario cobrado`;
    case "jornada": return `${quien} instaló el módulo${a.detalle ? ` en ${a.detalle}` : ""}`;
  }
}

export type Resumen = { total: number; prospectos: number; verificados: number; avances: number; cierres: number };

/** Cuántas cosas hizo hoy cada persona (para la etiqueta del avatar y los contadores de arriba). */
export function resumenPorPersona(acts: Actividad[]): Map<string, Resumen> {
  const m = new Map<string, Resumen>();
  for (const a of acts) {
    const r = m.get(a.usuarioId) ?? { total: 0, prospectos: 0, verificados: 0, avances: 0, cierres: 0 };
    r.total++;
    if (a.tipo === "prospecto" || a.tipo === "campo") r.prospectos++;
    if (a.tipo === "verificacion") r.verificados++;
    if (a.tipo === "etapa") r.avances++;
    if (a.tipo === "cierre") r.cierres++;
    m.set(a.usuarioId, r);
  }
  return m;
}

/** Lo nuevo desde la última consulta (para lanzar burbujas solo una vez), en orden de llegada. */
export function nuevas(acts: Actividad[], vistas: Set<string>): Actividad[] {
  return acts.filter((a) => !vistas.has(a.id)).sort((x, y) => (x.at < y.at ? -1 : 1));
}
