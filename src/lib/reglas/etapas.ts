// Máquina de estados del caso (sección 6). Función pura: recibe la foto del caso y dice si
// puede pasar a una etapa y, si no, qué le falta, en lenguaje para el asesor.
import type { Candado } from "./fechas";

export type Rol = "director" | "asesor" | "vendedor" | "socio";
export type Embudo = "retiro" | "pension";

export const ETAPAS_RETIRO = [
  "PROSPECTO", "PRECALIFICADO", "EN_ESPERA", "CONTRATO", "EXPEDIENTE", "INGRESADA", "RESOLUCION", "PAGADO", "CERRADO",
] as const;
export const ETAPAS_PENSION = [
  "PROSPECTO", "DIAGNOSTICO", "PLAN_ENTREGADO", "CONTRATO", "ESTRATEGIA_EN_EJECUCION", "SOLICITUD_PENSION",
  "RESOLUCION_IMSS", "PENSION_OTORGADA", "CERRADO", "SEGUIMIENTO",
] as const;
export const ETAPAS_LATERALES = ["BLOQUEADO", "PERDIDO"] as const;

export type Etapa = (typeof ETAPAS_RETIRO)[number] | (typeof ETAPAS_PENSION)[number] | (typeof ETAPAS_LATERALES)[number];

export const NOMBRE_ETAPA: Record<Etapa, string> = {
  PROSPECTO: "Prospecto",
  PRECALIFICADO: "Precalificado",
  EN_ESPERA: "En espera",
  CONTRATO: "Contrato firmado",
  EXPEDIENTE: "Armando expediente",
  INGRESADA: "Ingresada a Afore",
  RESOLUCION: "Resolución Afore",
  PAGADO: "Pagado por Afore",
  CERRADO: "Honorario cobrado",
  BLOQUEADO: "Bloqueado o rechazado",
  PERDIDO: "Perdido o desvío",
  DIAGNOSTICO: "Diagnóstico",
  PLAN_ENTREGADO: "Plan entregado",
  ESTRATEGIA_EN_EJECUCION: "Estrategia en ejecución",
  SOLICITUD_PENSION: "Solicitud de pensión ingresada",
  RESOLUCION_IMSS: "Resolución del IMSS",
  PENSION_OTORGADA: "Pensión otorgada",
  SEGUIMIENTO: "Seguimiento",
};

// Movimientos hacia adelante del retiro (diagrama 6). PERDIDO se permite desde cualquier etapa
// abierta; los regresos se tratan aparte (solo asesor y Director, con motivo).
const SIGUIENTES_RETIRO: Partial<Record<Etapa, Etapa[]>> = {
  PROSPECTO: ["PRECALIFICADO"],
  PRECALIFICADO: ["EN_ESPERA", "CONTRATO"],
  EN_ESPERA: ["CONTRATO"],
  CONTRATO: ["EXPEDIENTE"],
  EXPEDIENTE: ["INGRESADA", "BLOQUEADO"],
  INGRESADA: ["RESOLUCION", "BLOQUEADO"],
  RESOLUCION: ["PAGADO", "BLOQUEADO"],
  PAGADO: ["CERRADO"],
  BLOQUEADO: ["EXPEDIENTE"],
  PERDIDO: ["PROSPECTO"], // reabrir conserva el folio (6.3)
};

export type FotoCaso = {
  embudo: Embudo;
  etapa: Etapa;
  regimen: "L73" | "L97" | "por_definir" | null;
  tieneTelefono: boolean;
  resultadoPrecalificacion: string | null;
  dictamenManual: "APTO" | "NO_APTO" | null;
  dia46: { yaPuede: boolean; fecha: string; diasFaltan: number } | null; // null = sin fecha de baja
  candado: Candado;
  fechaContrato: string | null;
  analisisImpactoOk: boolean;
  clienteEntendioCosto: boolean;
  honorarioFijo: boolean;
  documentosPendientes: number; // obligatorios sin validar o vencidos
  fechaIngresoSolicitud: string | null;
  acuseAfore: string | null;
  resultadoAfore: "aprobado" | "rechazado" | "requiere_cita" | null;
  fechaResolucion: string | null;
  pagosAfore: number;
  cobrosPendientes: number;
  cobrosTotal: number;
};

export type Movimiento = { destino: Etapa; regreso: boolean; faltantes: string[] };

function ordenDe(embudo: Embudo): readonly Etapa[] {
  return embudo === "retiro" ? ETAPAS_RETIRO : ETAPAS_PENSION;
}

function siguientes(c: FotoCaso): Etapa[] {
  if (c.embudo === "retiro") return SIGUIENTES_RETIRO[c.etapa] ?? [];
  // Pensión (6.2): avance lineal.
  if (c.etapa === "PERDIDO") return ["PROSPECTO"];
  if (c.etapa === "BLOQUEADO") return ["ESTRATEGIA_EN_EJECUCION"];
  const orden = ETAPAS_PENSION as readonly Etapa[];
  const i = orden.indexOf(c.etapa);
  return i >= 0 && i < orden.length - 1 ? [orden[i + 1]] : [];
}

/** Lo que le falta al caso para entrar a `destino` (vacío = puede). No incluye el motivo. */
export function requisitos(c: FotoCaso, destino: Etapa): string[] {
  const f: string[] = [];
  const apto = c.dictamenManual === "APTO" || c.resultadoPrecalificacion === "APTO";

  switch (destino) {
    case "PROSPECTO":
      if (!c.tieneTelefono) f.push("Captura un teléfono o WhatsApp");
      break;
    case "PRECALIFICADO":
      // Mientras no exista la calculadora (fase 2), el dictamen manual habilita (decisión 28-oct).
      if (!c.resultadoPrecalificacion && c.dictamenManual !== "APTO") {
        f.push(c.dictamenManual === "NO_APTO"
          ? "El dictamen es «No apto»: márcalo como perdido o cambia el dictamen"
          : "Registra el dictamen «Apto» en IMSS y Afore");
      }
      break;
    case "EN_ESPERA": {
      const esperaDia46 = c.dia46 && !c.dia46.yaPuede;
      const esperaCandado = c.candado.estado === "vigente";
      if (!esperaDia46 && !esperaCandado) f.push("No hay fecha que esperar: ni el día 46 ni el candado de 5 años están en el futuro");
      break;
    }
    case "CONTRATO":
      if (c.embudo === "retiro") {
        if (!apto) f.push("Falta el dictamen «Apto»");
        if (!c.dia46) f.push("Captura la fecha de baja");
        else if (!c.dia46.yaPuede) f.push(`Todavía no llega el día 46 (${c.dia46.fecha})`);
        if (c.candado.estado === "por_verificar") f.push("Verifica el último retiro en el estado de cuenta Afore");
        if (c.candado.estado === "vigente") f.push(`El candado de 5 años sigue hasta el ${c.candado.fecha}`);
        if (c.regimen === "L73" && !(c.analisisImpactoOk && c.clienteEntendioCosto)) {
          f.push("Ley 73: registra el análisis de impacto y que el cliente entendió el costo en semanas (2.5)");
        }
      } else if (!c.honorarioFijo) {
        f.push("Captura el honorario fijo");
      }
      if (!c.fechaContrato) f.push("Captura la fecha de firma del contrato");
      break;
    case "EXPEDIENTE":
      if (!c.fechaContrato) f.push("Falta la fecha de firma del contrato");
      break;
    case "INGRESADA":
      if (c.documentosPendientes > 0) {
        f.push(`Faltan ${c.documentosPendientes} ${c.documentosPendientes === 1 ? "documento obligatorio validado" : "documentos obligatorios validados"}`);
      }
      if (!c.fechaIngresoSolicitud) f.push("Captura la fecha de ingreso a la Afore");
      if (!c.acuseAfore) f.push("Captura el folio o acuse de la Afore");
      break;
    case "RESOLUCION":
      if (c.resultadoAfore !== "aprobado") f.push("Registra la resolución favorable de la Afore");
      if (!c.fechaResolucion) f.push("Captura la fecha de resolución");
      break;
    case "PAGADO":
      if (c.pagosAfore < 1) f.push("Registra al menos un pago de la Afore");
      break;
    case "CERRADO":
      if (c.cobrosTotal < 1 || c.cobrosPendientes > 0) f.push("Todos los cobros del honorario deben estar cobrados");
      break;
  }
  return f;
}

/** Movimientos que se ofrecen desde la etapa actual, con lo que falta para cada uno. */
export function movimientosPosibles(c: FotoCaso, rol: Rol): Movimiento[] {
  const lista: Movimiento[] = siguientes(c).map((d) => ({ destino: d, regreso: false, faltantes: requisitos(c, d) }));

  if (c.etapa !== "PERDIDO" && c.etapa !== "CERRADO") {
    lista.push({ destino: "PERDIDO", regreso: false, faltantes: [] });
  }
  if (c.embudo === "pension" && !["BLOQUEADO", "PERDIDO", "PROSPECTO"].includes(c.etapa)) {
    lista.push({ destino: "BLOQUEADO", regreso: false, faltantes: [] });
  }

  // Regresos (6.3): solo asesor y Director, a cualquier etapa anterior del mismo embudo.
  if (rol === "director" || rol === "asesor") {
    const orden = ordenDe(c.embudo);
    const i = orden.indexOf(c.etapa);
    for (const anterior of orden.slice(0, Math.max(0, i))) {
      if (!lista.some((m) => m.destino === anterior)) lista.push({ destino: anterior, regreso: true, faltantes: [] });
    }
  }
  return lista;
}

/** Validación final del servidor: la misma que ve la pantalla, más el motivo obligatorio. */
export function validarTransicion(c: FotoCaso, destino: Etapa, rol: Rol, motivo: string | null): string[] {
  const m = movimientosPosibles(c, rol).find((x) => x.destino === destino);
  if (!m) return [`No se puede pasar de «${NOMBRE_ETAPA[c.etapa]}» a «${NOMBRE_ETAPA[destino]}»`];
  const faltantes = [...m.faltantes];
  const sinMotivo = !motivo || motivo.trim().length < 5;
  if ((m.regreso || destino === "BLOQUEADO" || destino === "PERDIDO") && sinMotivo) {
    faltantes.push("Escribe el motivo (mínimo 5 caracteres)");
  }
  return faltantes;
}
