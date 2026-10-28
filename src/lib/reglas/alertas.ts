// Alertas por fecha (sección 8.1, las que no dependen de dinero ni de pensiones).
// Función pura: recibe la foto de los casos y `hoy`, devuelve las alertas que tocan.
// La clave de deduplicación hace que cada alerta se cree una sola vez aunque la tarea corra
// varias veces o un día se salte (las ventanas son de varios días, no de un día exacto).
import { diasEntre, diasHabilesTranscurridos, fechaElegibleDesempleo, fechaFinCandado, sumarAnios, type EstadoUltimoRetiro, type FechaISO } from "./fechas";

export type Severidad = "info" | "aviso" | "critica";

export type CasoAlertable = {
  id: string;
  folio: string;
  nombre: string;
  etapa: string;
  esRetiro: boolean;
  ownerId: string;
  asignadoA: string | null;
  vendedorId: string | null;
  fechaBaja: FechaISO | null;
  fechaAperturaCuenta: FechaISO | null;
  estadoUltimoRetiro: EstadoUltimoRetiro;
  fechaUltimoRetiro: FechaISO | null;
  fechaAlta: FechaISO; // creación del caso
  ultimoContacto: FechaISO | null; // último evento que no es del sistema
  ultimoMovimiento: FechaISO; // último evento de cualquier tipo
  ultimoDocumento: FechaISO | null;
  etapaDesde: FechaISO;
  fechaExpedienteCompleto: FechaISO | null;
  fechaLimiteIngreso: FechaISO | null;
  fechaIngresoSolicitud: FechaISO | null;
  fechaLimiteResolucion: FechaISO | null;
  fechaResolucion: FechaISO | null;
  fechaVencimientoContrato: FechaISO | null;
  documentosPorVencer: { id: string; nombre: string; vence: FechaISO }[];
};

export type Destinatario = "asesor" | "vendedor" | "director" | "dueno";

export type AlertaNueva = {
  regla: string;
  casoId: string;
  severidad: Severidad;
  mensaje: string;
  clave: string; // regla + caso + fecha de referencia (8: clave_dedup)
  para: Destinatario[];
};

export type ParametrosAlertas = {
  DIAS_ESPERA_DESEMPLEO: number;
  ANIOS_CANDADO_RETIRO: number;
  SLA_DIAS_HABILES: number;
  inhabiles: ReadonlySet<FechaISO>;
};

const ANTES_DE_INGRESAR = new Set(["PROSPECTO", "PRECALIFICADO", "EN_ESPERA", "CONTRATO", "EXPEDIENTE", "BLOQUEADO"]);
const ABIERTOS = new Set(["PROSPECTO", "PRECALIFICADO", "EN_ESPERA", "CONTRATO", "EXPEDIENTE", "INGRESADA", "RESOLUCION", "BLOQUEADO",
  "DIAGNOSTICO", "PLAN_ENTREGADO", "ESTRATEGIA_EN_EJECUCION", "SOLICITUD_PENSION", "RESOLUCION_IMSS"]);
const PROSPECCION = new Set(["PROSPECTO", "PRECALIFICADO", "EN_ESPERA", "DIAGNOSTICO", "PLAN_ENTREGADO"]);

// Cuántos días atrás todavía vale la pena avisar algo que "era hoy" (si la tarea no corrió).
const GRACIA = 7;

export function alertasDelDia(casos: CasoAlertable[], hoy: FechaISO, p: ParametrosAlertas): AlertaNueva[] {
  const r: AlertaNueva[] = [];
  const add = (c: CasoAlertable, regla: string, severidad: Severidad, mensaje: string, referencia: string, para: Destinatario[]) =>
    r.push({ regla, casoId: c.id, severidad, mensaje: `${c.nombre} (${c.folio}): ${mensaje}`, clave: `${regla}:${c.id}:${referencia}`, para });

  for (const c of casos) {
    if (!ABIERTOS.has(c.etapa)) continue;

    // Día 46 (8.1): aviso 3 días antes y crítica el día que llega.
    if (c.esRetiro && c.fechaBaja && ANTES_DE_INGRESAR.has(c.etapa)) {
      const d = fechaElegibleDesempleo(c.fechaBaja, hoy, p);
      const atraso = diasEntre(d.fecha, hoy);
      if (!d.yaPuede && d.diasFaltan <= 3) add(c, "DIA46_PROXIMO", "aviso", `en ${d.diasFaltan} ${d.diasFaltan === 1 ? "día" : "días"} ya puede retirar`, d.fecha, ["asesor", "vendedor"]);
      if (d.yaPuede && atraso <= GRACIA) add(c, "DIA46_HOY", "critica", "ya puede retirar (día 46)", d.fecha, ["asesor", "vendedor", "director"]);
    }

    // Fin del candado de 5 años: 7 días antes y el día.
    if (c.esRetiro && c.estadoUltimoRetiro === "con_retiro" && c.fechaUltimoRetiro && ANTES_DE_INGRESAR.has(c.etapa)) {
      const k = fechaFinCandado("con_retiro", c.fechaUltimoRetiro, hoy, p);
      if (k.estado === "vigente" && k.diasFaltan <= 7) add(c, "CANDADO5_FIN", "aviso", `en ${k.diasFaltan} días termina el candado de 5 años`, `${k.fecha}:previo`, ["asesor"]);
      if (k.estado === "vencido" && diasEntre(k.fecha, hoy) <= GRACIA) add(c, "CANDADO5_FIN", "aviso", "terminó el candado de 5 años; ya puede volver a retirar", k.fecha, ["asesor"]);
    }

    // La cuenta cumple 3 o 5 años: cambia la modalidad disponible.
    if (c.esRetiro && c.fechaAperturaCuenta && ANTES_DE_INGRESAR.has(c.etapa)) {
      for (const anios of [3, 5]) {
        const f = sumarAnios(c.fechaAperturaCuenta, anios);
        const desde = diasEntre(f, hoy);
        if (desde >= 0 && desde <= GRACIA) {
          add(c, "CUENTA_3_5_ANIOS", "info", `la cuenta Afore cumplió ${anios} años (modalidad ${anios === 3 ? "A" : "B"} disponible)`, f, ["asesor"]);
        }
      }
    }

    // Prospecto sin contacto: a las 24 h y luego cada 3 días. Frío: 14 días sin movimiento.
    if (PROSPECCION.has(c.etapa)) {
      if (!c.ultimoContacto) {
        const dias = diasEntre(c.fechaAlta, hoy);
        if (dias >= 1 && dias < 14) {
          const tanda = dias === 1 ? 0 : Math.floor((dias - 1) / 3);
          add(c, "PROSPECTO_SIN_CONTACTO", "aviso", `lleva ${dias} ${dias === 1 ? "día" : "días"} sin contacto`, `${c.fechaAlta}:${tanda}`, ["dueno"]);
        }
      }
      const quieto = diasEntre(c.ultimoMovimiento, hoy);
      if (quieto >= 14) add(c, "PROSPECTO_FRIO", "info", `${quieto} días sin movimiento; considera archivarlo`, c.ultimoMovimiento, ["dueno"]);
    }

    // Documentos por vencer (7 días antes).
    for (const doc of c.documentosPorVencer) {
      const faltan = diasEntre(hoy, doc.vence);
      if (faltan >= 0 && faltan <= 7) add(c, "DOC_POR_VENCER", "aviso", `${doc.nombre} vence en ${faltan} ${faltan === 1 ? "día" : "días"}`, `${doc.id}:${doc.vence}`, ["asesor"]);
    }

    // Expediente detenido: 5 días en "Armando expediente" sin documento nuevo.
    if (c.etapa === "EXPEDIENTE" && !c.fechaExpedienteCompleto) {
      const ref = c.ultimoDocumento && c.ultimoDocumento > c.etapaDesde ? c.ultimoDocumento : c.etapaDesde;
      const dias = diasEntre(ref, hoy);
      if (dias >= 5) add(c, "EXPEDIENTE_DETENIDO", "aviso", `${dias} días sin documentos nuevos; considera suspender el contrato`, ref, ["asesor"]);
    }

    // 15 días hábiles para ingresar (2.4): riesgo en el día 10, vencido después del 15.
    if (c.fechaExpedienteCompleto && !c.fechaIngresoSolicitud) {
      const habiles = diasHabilesTranscurridos(c.fechaExpedienteCompleto, hoy, p.inhabiles);
      if (c.fechaLimiteIngreso && hoy > c.fechaLimiteIngreso) {
        add(c, "SLA_15_VENCIDO", "critica", `pasaron los ${p.SLA_DIAS_HABILES} días hábiles para ingresar a la Afore`, c.fechaExpedienteCompleto, ["director"]);
      } else if (habiles >= 10) {
        add(c, "SLA_15_RIESGO", "aviso", `día hábil ${habiles} de ${p.SLA_DIAS_HABILES} sin ingresar a la Afore`, c.fechaExpedienteCompleto, ["asesor", "director"]);
      }
    }

    // La Afore no resolvió en 5 días hábiles.
    if (c.fechaIngresoSolicitud && c.fechaLimiteResolucion && !c.fechaResolucion && hoy > c.fechaLimiteResolucion) {
      add(c, "AFORE_SIN_RESOLUCION", "aviso", "pasaron 5 días hábiles del acuse sin resolución de la Afore", c.fechaIngresoSolicitud, ["asesor"]);
    }

    // Contrato por vencer: 10 días antes de los 90 (más suspensiones).
    if (c.fechaVencimientoContrato) {
      const faltan = diasEntre(hoy, c.fechaVencimientoContrato);
      if (faltan >= 0 && faltan <= 10) add(c, "CONTRATO_POR_VENCER", "aviso", `el contrato vence en ${faltan} días`, c.fechaVencimientoContrato, ["asesor", "director"]);
    }
  }
  return r;
}

/** Quién recibe cada alerta. Sin asesor asignado, lo del asesor va al Director (bandeja general). */
export function resolverDestinatarios(a: AlertaNueva, c: Pick<CasoAlertable, "ownerId" | "asignadoA" | "vendedorId">, directores: string[]): string[] {
  const ids = new Set<string>();
  for (const d of a.para) {
    if (d === "asesor") (c.asignadoA ? [c.asignadoA] : directores).forEach((x) => ids.add(x));
    if (d === "vendedor" && c.vendedorId) ids.add(c.vendedorId);
    if (d === "director") directores.forEach((x) => ids.add(x));
    if (d === "dueno") ids.add(c.ownerId);
  }
  return [...ids];
}
