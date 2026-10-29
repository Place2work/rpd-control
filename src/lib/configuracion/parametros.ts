// Edición de parámetros con vigencia (10.9). Funciones puras: validan el valor según su tipo y
// calculan cómo queda la vigencia. Nunca se borra ni se cambia un valor que ya se usó: el nuevo
// empieza en una fecha (hoy o después) y el anterior se cierra el día previo.
import { sumarDias, type FechaISO } from "@/lib/reglas/fechas";

export type TipoParametro = "decimal" | "entero" | "texto" | "json";

// Valores permitidos para los parámetros de texto que son una opción.
export const OPCIONES: Record<string, readonly string[]> = {
  BASE_HONORARIO: ["neto", "bruto"],
  BASE_COMISION_VENDEDOR: ["igual_honorario", "neto", "bruto"],
  BASE_REPARTO_SOCIO: ["subtotal", "total"],
  COSTO_ADMIN_SOCIO_POR: ["caso", "cobro"],
  M40_PAGO_ADELANTADO: ["si", "no"],
};

// Fracciones (0.26 = 26%) para mostrarlas como porcentaje.
export const ES_PORCENTAJE = new Set([
  "HONORARIO_RETIRO_PCT", "IVA", "MODALIDAD_B_PCT_RCV", "UMBRAL_DIFERENCIA_MODALIDAD", "FALLEC_COMISION_PCT_RECUPERADO",
  "FALLEC_HONORARIO_PCT_RECUPERADO", "CONSERVACION_FRACCION",
]);

export const GRUPOS: { titulo: string; prefijos: string[] }[] = [
  { titulo: "Retiro por desempleo", prefijos: ["UMA_", "MODALIDAD_", "UMBRAL_", "HONORARIO_", "L97_", "L73_", "DIAS_ESPERA", "ANIOS_CANDADO"] },
  { titulo: "Plazos y alertas", prefijos: ["VIGENCIA_", "SLA_", "AFORE_", "HORA_", "AVISO_", "ARCO_", "RETENCION_"] },
  { titulo: "Dinero y comisiones", prefijos: ["IVA", "BASE_", "COSTO_ADMIN", "FALLEC_COMISION"] },
  { titulo: "Pensión y Modalidad 40", prefijos: ["M40_", "VENTANA_", "CONSERVACION_", "INFONAVIT_"] },
  { titulo: "Contratos y prestador", prefijos: ["PRESTADOR_", "CONTRATO_", "FALLEC_HONORARIO", "FALLEC_REGIMEN", "PRIVACIDAD_"] },
];

export function grupoDe(clave: string): string {
  return GRUPOS.find((g) => g.prefijos.some((p) => clave.startsWith(p)))?.titulo ?? "Otros";
}

/** Valida y normaliza. Los porcentajes se capturan como "26" o "26%" y se guardan como 0.26. */
export function validarValor(clave: string, tipo: TipoParametro, entrada: string): { ok: true; valor: string } | { ok: false; error: string } {
  const t = entrada.trim();
  if (!t) return { ok: false, error: "Escribe el valor" };
  if (OPCIONES[clave]) {
    return OPCIONES[clave].includes(t) ? { ok: true, valor: t } : { ok: false, error: `Debe ser uno de: ${OPCIONES[clave].join(", ")}` };
  }
  if (tipo === "decimal" || tipo === "entero") {
    const limpio = t.replace(/[,$\s%]/g, "");
    let n = Number(limpio);
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: "Escribe un número mayor o igual a cero" };
    if (ES_PORCENTAJE.has(clave)) {
      if (n > 100) return { ok: false, error: "El porcentaje va de 0 a 100" };
      n = Math.round((n / 100) * 1e6) / 1e6;
    }
    if (tipo === "entero" && !Number.isInteger(n)) return { ok: false, error: "Debe ser un número entero" };
    return { ok: true, valor: String(n) };
  }
  if (tipo === "json") {
    try { JSON.parse(t); } catch { return { ok: false, error: "JSON no válido" }; }
  }
  if (t.length > 500) return { ok: false, error: "Máximo 500 caracteres" };
  return { ok: true, valor: t };
}

/** Cómo se muestra el valor guardado (0.26 → "26%"). */
export function valorVisible(clave: string, valor: string): string {
  if (ES_PORCENTAJE.has(clave) && Number.isFinite(Number(valor))) return `${+(Number(valor) * 100).toFixed(4)}%`;
  return valor;
}

export type FilaVigencia = { id: string; vigenteDesde: FechaISO; vigenteHasta: FechaISO | null };
export type PlanVigencia =
  | { ok: true; accion: "crear"; cerrar: { id: string; hasta: FechaISO }[] }
  | { ok: true; accion: "reemplazar"; id: string }
  | { ok: false; error: string };

/**
 * Nuevo valor desde `desde`. Reglas: no se programa en el pasado; un valor programado a futuro se
 * puede reemplazar antes de que empiece; si hay uno programado después de `desde`, primero se cambia ese.
 */
export function planNuevaVigencia(filas: FilaVigencia[], desde: FechaISO, hoy: FechaISO): PlanVigencia {
  if (desde < hoy) return { ok: false, error: "La fecha de inicio no puede ser anterior a hoy: los cálculos ya hechos no cambian" };
  const igual = filas.find((f) => f.vigenteDesde === desde);
  if (igual) {
    return desde > hoy ? { ok: true, accion: "reemplazar", id: igual.id } : { ok: false, error: "Ya hay un valor que empieza hoy; prográmalo desde mañana" };
  }
  const posterior = filas.filter((f) => f.vigenteDesde > desde).sort((a, b) => (a.vigenteDesde < b.vigenteDesde ? -1 : 1))[0];
  if (posterior) return { ok: false, error: `Ya hay un valor programado desde el ${posterior.vigenteDesde}; cámbialo primero` };
  const cerrar = filas
    .filter((f) => f.vigenteDesde < desde && (f.vigenteHasta === null || f.vigenteHasta >= desde))
    .map((f) => ({ id: f.id, hasta: sumarDias(desde, -1) }));
  return { ok: true, accion: "crear", cerrar };
}
