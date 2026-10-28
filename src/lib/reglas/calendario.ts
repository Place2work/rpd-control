// Fechas del calendario (10.5) y exportación .ics (8.2). Funciones puras: reciben la foto del
// caso, `hoy` y los parámetros. En los eventos solo va el folio y el primer nombre del cliente
// (como en el correo diario): nada de NSS, CURP ni montos.
import { fechaElegibleDesempleo, fechaFinCandado, sumarDias, type EstadoUltimoRetiro, type FechaISO } from "./fechas";
import { derechoM40, fechasEdad, finConservacion, type ParametrosPension } from "./pension";

export type TipoEvento =
  | "DIA46" | "CANDADO" | "SLA_LIMITE" | "AFORE_RESOLUCION" | "CONTRATO_VENCE"
  | "PAGO_M40" | "M40_DERECHO" | "CONSERVACION" | "CUMPLE_60" | "CUMPLE_65";

export const NOMBRE_EVENTO: Record<TipoEvento, string> = {
  DIA46: "Día 46: ya puede retirar", CANDADO: "Termina el candado de 5 años", SLA_LIMITE: "Límite para ingresar a la Afore",
  AFORE_RESOLUCION: "Límite de resolución de la Afore", CONTRATO_VENCE: "Vence el contrato", PAGO_M40: "Pago de Modalidad 40",
  M40_DERECHO: "Vence el derecho a M40", CONSERVACION: "Vence la conservación de derechos", CUMPLE_60: "Cumple 60 años", CUMPLE_65: "Cumple 65 años",
};

export type Evento = { fecha: FechaISO; tipo: TipoEvento; casoId: string; folio: string; nombre: string; titulo: string };

export type CasoCalendario = {
  id: string; folio: string; nombre: string; etapa: string; servicio: string;
  fechaBaja: FechaISO | null; estadoUltimoRetiro: EstadoUltimoRetiro; fechaUltimoRetiro: FechaISO | null;
  fechaLimiteIngreso: FechaISO | null; fechaIngresoSolicitud: FechaISO | null; fechaLimiteResolucion: FechaISO | null; fechaResolucion: FechaISO | null;
  fechaVencimientoContrato: FechaISO | null; fechaNacimiento: FechaISO | null;
  regimen: string | null; semanasCotizadas: number | null;
  pagosM40: { mes: FechaISO; fechaLimite: FechaISO; pagado: boolean }[];
};

type Params = { DIAS_ESPERA_DESEMPLEO: number; ANIOS_CANDADO_RETIRO: number } & ParametrosPension;
const CERRADOS = new Set(["PERDIDO", "CERRADO", "PENSION_OTORGADA"]);
const ANTES_DE_INGRESAR = new Set(["PROSPECTO", "PRECALIFICADO", "EN_ESPERA", "CONTRATO", "EXPEDIENTE", "BLOQUEADO"]);
const PLANEACION = new Set(["PENSION_L73", "PENSION_L97", "MODALIDAD_40", "PTI_M10"]);

export function eventosDelCaso(c: CasoCalendario, hoy: FechaISO, p: Params): Evento[] {
  if (CERRADOS.has(c.etapa)) return [];
  const r: Evento[] = [];
  const add = (fecha: FechaISO | null, tipo: TipoEvento, detalle = "") => {
    if (fecha) r.push({ fecha, tipo, casoId: c.id, folio: c.folio, nombre: c.nombre, titulo: `${NOMBRE_EVENTO[tipo]}${detalle} · ${c.folio} ${c.nombre}` });
  };
  const retiro = c.servicio === "RETIRO_DESEMPLEO";
  if (retiro && c.fechaBaja && ANTES_DE_INGRESAR.has(c.etapa)) add(fechaElegibleDesempleo(c.fechaBaja, hoy, p).fecha, "DIA46");
  if (retiro && c.estadoUltimoRetiro === "con_retiro" && c.fechaUltimoRetiro && ANTES_DE_INGRESAR.has(c.etapa)) {
    const k = fechaFinCandado("con_retiro", c.fechaUltimoRetiro, hoy, p);
    if (k.estado === "vigente" || k.estado === "vencido") add(k.fecha, "CANDADO");
  }
  if (!c.fechaIngresoSolicitud) add(c.fechaLimiteIngreso, "SLA_LIMITE");
  if (!c.fechaResolucion) add(c.fechaLimiteResolucion, "AFORE_RESOLUCION");
  add(c.fechaVencimientoContrato, "CONTRATO_VENCE");
  for (const x of c.pagosM40) if (!x.pagado) add(x.fechaLimite, "PAGO_M40", ` (${x.mes.slice(0, 7)})`);
  if (PLANEACION.has(c.servicio)) {
    if (c.fechaBaja && !c.pagosM40.length) add(derechoM40(c.fechaBaja, null, p).vence, "M40_DERECHO");
    if (c.fechaBaja && c.regimen === "L73" && c.semanasCotizadas) add(finConservacion(c.fechaBaja, c.semanasCotizadas, p), "CONSERVACION");
    if (c.fechaNacimiento) {
      const e = fechasEdad(c.fechaNacimiento);
      add(e.cumple60, "CUMPLE_60");
      add(e.cumple65, "CUMPLE_65");
    }
  }
  return r;
}

/** Eventos de varios casos entre dos fechas (inclusive), ordenados por fecha. */
export function eventosEntre(casos: CasoCalendario[], desde: FechaISO, hasta: FechaISO, hoy: FechaISO, p: Params): Evento[] {
  return casos.flatMap((c) => eventosDelCaso(c, hoy, p)).filter((e) => e.fecha >= desde && e.fecha <= hasta)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.titulo.localeCompare(b.titulo)));
}

// ───────────── iCalendar (RFC 5545) ─────────────

const escapar = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const compacta = (f: FechaISO) => f.replaceAll("-", "");

/** Renglones de máximo 75 octetos, continuados con espacio (RFC 5545 §3.1). */
function doblar(linea: string): string {
  const bytes = new TextEncoder();
  const partes: string[] = [];
  let actual = "";
  for (const ch of linea) {
    if (bytes.encode(actual + ch).length > (partes.length ? 74 : 75)) { partes.push(actual); actual = ch; } else actual += ch;
  }
  partes.push(actual);
  return partes.join("\r\n ");
}

/**
 * Calendario de eventos de día completo. `sello` es la marca de tiempo DTSTAMP (UTC, "20261028T120000Z");
 * se recibe para que la función sea pura. El UID es estable: el mismo evento no se duplica al refrescar.
 */
export function generarIcs(eventos: Evento[], nombre: string, sello: string, urlBase: string): string {
  const l = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RetiroPorDesempleo.com//RPD Control//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapar(nombre)}`, "X-WR-TIMEZONE:America/Mexico_City", "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H",
  ];
  for (const e of eventos) {
    l.push(
      "BEGIN:VEVENT",
      `UID:${e.tipo}-${e.casoId}-${compacta(e.fecha)}@rpd-control`,
      `DTSTAMP:${sello}`,
      `DTSTART;VALUE=DATE:${compacta(e.fecha)}`,
      `DTEND;VALUE=DATE:${compacta(sumarDias(e.fecha, 1))}`,
      `SUMMARY:${escapar(e.titulo)}`,
      `URL:${urlBase}/casos/${e.casoId}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  l.push("END:VCALENDAR");
  return l.map(doblar).join("\r\n") + "\r\n";
}
