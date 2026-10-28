// Fechas de pensión y Modalidad 40 (sección 7.6) y sus alertas (8.1). Funciones puras: reciben
// `hoy` y los parámetros; nunca leen el reloj ni la base. Plazos legales como parámetros:
//   - M40: el derecho vence a los 5 años de la baja (art. 219 LSS) y pide 52 semanas en los
//     últimos 5 años (art. 218). Dos meses sin pago = baja (art. 220), con 12 meses para reingresar.
//   - Ventana sin examen médico para incorporación voluntaria: baja + 12 meses (art. 85 RACERF).
//   - Conservación de derechos Ley 73: la cuarta parte del tiempo cotizado desde la baja, nunca
//     menos de 12 meses (art. 150 LSS 1973).
import { diasEntre, sumarAnios, sumarDias, sumarMeses, type FechaISO } from "./fechas";

export type ParametrosPension = {
  M40_ANIOS_DERECHO: number;          // 5
  M40_SEMANAS_REQUERIDAS: number;     // 52
  M40_MESES_BAJA: number;             // 2
  M40_MESES_REINGRESO: number;        // 12
  M40_DIA_LIMITE: number;             // 17
  M40_PAGO_ADELANTADO: boolean;       // true: el mes M se paga a más tardar el día 17 del mismo mes
  VENTANA_SIN_EXAMEN_MESES: number;   // 12
  CONSERVACION_FRACCION: number;      // 0.25
  CONSERVACION_MIN_MESES: number;     // 12
  AVISO_M40_PAGO_DIAS: number;        // 5
  AVISO_M40_PLAZO_DIAS: number;       // 60
  AVISO_VENTANA_DIAS: number;         // 30
  AVISO_EDAD_MESES: number;           // 6
  AVISO_CONSERVACION_DIAS: number;    // 90
  INFONAVIT_EDAD_AVISO: number;       // 69
  INFONAVIT_EDAD_LIMITE: number;      // 70
};

// ───────────── Edades ─────────────

export function edadEn(fechaNacimiento: FechaISO, hoy: FechaISO): number {
  const [a, m, d] = fechaNacimiento.split("-").map(Number);
  const [ha, hm, hd] = hoy.split("-").map(Number);
  return ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0);
}

export function fechasEdad(fechaNacimiento: FechaISO) {
  return { cumple60: sumarAnios(fechaNacimiento, 60), cumple65: sumarAnios(fechaNacimiento, 65), cumple69: sumarAnios(fechaNacimiento, 69), cumple70: sumarAnios(fechaNacimiento, 70) };
}

// ───────────── Derecho a M40, ventana y conservación ─────────────

export function derechoM40(fechaBaja: FechaISO, semanasUltimos5Anios: number | null, p: ParametrosPension) {
  return {
    vence: sumarAnios(fechaBaja, p.M40_ANIOS_DERECHO),
    cumpleSemanas: semanasUltimos5Anios === null ? null : semanasUltimos5Anios >= p.M40_SEMANAS_REQUERIDAS,
    ventanaSinExamen: sumarMeses(fechaBaja, p.VENTANA_SIN_EXAMEN_MESES),
  };
}

/** Fin de la conservación de derechos (Ley 73): baja + ¼ del tiempo cotizado, mínimo 12 meses. */
export function finConservacion(fechaBaja: FechaISO, semanasCotizadas: number, p: ParametrosPension): FechaISO {
  const porSemanas = sumarDias(fechaBaja, Math.floor(semanasCotizadas * 7 * p.CONSERVACION_FRACCION));
  const minimo = sumarMeses(fechaBaja, p.CONSERVACION_MIN_MESES);
  return porSemanas > minimo ? porSemanas : minimo;
}

// ───────────── Pagos M40 ─────────────

/** Fecha límite del pago del mes cubierto ("2026-11-01"): día 17 del mismo mes (adelantado) o del siguiente. */
export function limitePagoM40(mesCubierto: FechaISO, p: ParametrosPension): FechaISO {
  const base = sumarMeses(mesCubierto.slice(0, 8) + "01", p.M40_PAGO_ADELANTADO ? 0 : 1);
  const [a, m] = base.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${base.slice(0, 8)}${String(Math.min(p.M40_DIA_LIMITE, ultimo)).padStart(2, "0")}`;
}

/** Meses a pagar de un plan M40: del primer mes al último, inclusive. */
export function mesesPlanM40(desde: FechaISO, hasta: FechaISO): FechaISO[] {
  const r: FechaISO[] = [];
  for (let m = desde.slice(0, 8) + "01"; m <= hasta.slice(0, 8) + "01"; m = sumarMeses(m, 1)) r.push(m);
  return r;
}

export type PagoM40Foto = { id: string; mes: FechaISO; fechaLimite: FechaISO; fechaPago: FechaISO | null };
export type EstadoM40 =
  | { estado: "al_corriente"; proximo: PagoM40Foto | null }
  | { estado: "atrasado"; vencidos: PagoM40Foto[]; proximo: PagoM40Foto | null }
  | { estado: "baja"; vencidos: PagoM40Foto[]; fechaBaja: FechaISO; reingresoHasta: FechaISO };

/** Pagos vencidos sin registrar. Con M40_MESES_BAJA vencidos seguidos, la persona causó baja. */
export function estadoM40(pagos: PagoM40Foto[], hoy: FechaISO, p: ParametrosPension): EstadoM40 {
  const orden = [...pagos].sort((a, b) => (a.mes < b.mes ? -1 : 1));
  const vencidos = orden.filter((x) => !x.fechaPago && x.fechaLimite < hoy);
  const proximo = orden.find((x) => !x.fechaPago && x.fechaLimite >= hoy) ?? null;
  // Racha de meses seguidos sin pago (la que importa para la baja).
  let racha: PagoM40Foto[] = [];
  for (const x of orden) {
    if (x.fechaLimite >= hoy) break;
    racha = x.fechaPago ? [] : [...racha, x];
    if (racha.length >= p.M40_MESES_BAJA) {
      const fechaBaja = sumarDias(racha[p.M40_MESES_BAJA - 1].fechaLimite, 1);
      return { estado: "baja", vencidos, fechaBaja, reingresoHasta: sumarMeses(fechaBaja, p.M40_MESES_REINGRESO) };
    }
  }
  return vencidos.length ? { estado: "atrasado", vencidos, proximo } : { estado: "al_corriente", proximo };
}

// ───────────── 8.1 Alertas de pensión ─────────────

export type CasoPension = {
  id: string; folio: string; nombre: string; etapa: string; servicio: string;
  regimen: "L73" | "L97" | "por_definir" | null;
  fechaNacimiento: FechaISO | null; fechaBaja: FechaISO | null; semanasCotizadas: number | null;
  pagosM40: PagoM40Foto[];
};
export type AlertaPension = { regla: string; casoId: string; severidad: "info" | "aviso" | "critica"; mensaje: string; clave: string; para: ("asesor" | "director")[] };

const CERRADOS = new Set(["PERDIDO", "CERRADO", "PENSION_OTORGADA"]);
const PLANEACION = new Set(["PENSION_L73", "PENSION_L97", "MODALIDAD_40", "PTI_M10"]);
const VIVIENDA = new Set(["PENSION_L73", "PENSION_L97", "MODALIDAD_40", "DEVOLUCION_INFONAVIT"]);
const mesTexto = (mes: FechaISO) => new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${mes}T00:00:00Z`));

export function alertasPension(casos: CasoPension[], hoy: FechaISO, p: ParametrosPension): AlertaPension[] {
  const r: AlertaPension[] = [];
  const en = (desde: number, hasta: number, dias: number) => dias >= desde && dias <= hasta;
  for (const c of casos) {
    if (CERRADOS.has(c.etapa)) continue;
    const add = (regla: string, severidad: AlertaPension["severidad"], mensaje: string, ref: string, para: AlertaPension["para"]) =>
      r.push({ regla, casoId: c.id, severidad, mensaje: `${c.nombre} (${c.folio}): ${mensaje}`, clave: `${regla}:${c.id}:${ref}`, para });

    // Pagos M40.
    if (c.pagosM40.length) {
      const e = estadoM40(c.pagosM40, hoy, p);
      if (e.estado === "baja") {
        add("M40_UN_MES_SIN_PAGO", "critica", `causó baja en Modalidad 40 por falta de pago; puede reingresar hasta el ${e.reingresoHasta}`, `baja:${e.fechaBaja}`, ["asesor", "director"]);
      } else if (e.estado === "atrasado") {
        const v = e.vencidos[0];
        add("M40_UN_MES_SIN_PAGO", "critica", `falta el pago de Modalidad 40 de ${mesTexto(v.mes)}; si no se paga el siguiente, causa baja`, v.id, ["asesor", "director"]);
      }
      const prox = e.estado === "baja" ? null : e.proximo;
      if (prox && en(0, p.AVISO_M40_PAGO_DIAS, diasEntre(hoy, prox.fechaLimite))) {
        add("M40_PAGO_PROXIMO", "aviso", `el pago de Modalidad 40 de ${mesTexto(prox.mes)} vence el ${prox.fechaLimite}`, prox.id, ["asesor"]);
      }
    }

    if (PLANEACION.has(c.servicio) && c.fechaBaja) {
      const d = derechoM40(c.fechaBaja, null, p);
      // Derecho a M40 por vencer, si todavía no hay pagos programados.
      if (!c.pagosM40.length && en(0, p.AVISO_M40_PLAZO_DIAS, diasEntre(hoy, d.vence))) {
        add("M40_PLAZO_5_ANIOS", "critica", `el ${d.vence} vence el derecho a inscribirse a Modalidad 40 (5 años desde la baja)`, d.vence, ["asesor"]);
      }
      if (en(0, p.AVISO_VENTANA_DIAS, diasEntre(hoy, d.ventanaSinExamen))) {
        add("VENTANA_12_MESES", "aviso", `el ${d.ventanaSinExamen} cierra la ventana de 12 meses para incorporarse sin examen médico`, d.ventanaSinExamen, ["asesor"]);
      }
      if (c.regimen === "L73" && c.semanasCotizadas) {
        const fin = finConservacion(c.fechaBaja, c.semanasCotizadas, p);
        if (en(0, p.AVISO_CONSERVACION_DIAS, diasEntre(hoy, fin))) {
          add("CONSERVACION_DERECHOS", "critica", `el ${fin} vence la conservación de derechos (Ley 73)`, fin, ["asesor"]);
        }
      }
    }

    if (c.fechaNacimiento) {
      const f = fechasEdad(c.fechaNacimiento);
      if (PLANEACION.has(c.servicio)) {
        for (const [edad, fecha] of [[60, f.cumple60], [65, f.cumple65]] as const) {
          if (hoy >= sumarMeses(fecha, -p.AVISO_EDAD_MESES) && hoy <= fecha) {
            add("EDAD_PENSION", "info", `cumple ${edad} años el ${fecha}`, `${edad}`, ["asesor"]);
          }
        }
      }
      const aviso = sumarAnios(c.fechaNacimiento, p.INFONAVIT_EDAD_AVISO), limite = sumarAnios(c.fechaNacimiento, p.INFONAVIT_EDAD_LIMITE);
      if (VIVIENDA.has(c.servicio) && hoy >= aviso && hoy < limite) {
        add("INFONAVIT_70", "aviso", `tiene ${p.INFONAVIT_EDAD_AVISO} años: si tiene saldo de vivienda sin reclamar, a los ${p.INFONAVIT_EDAD_LIMITE} (${limite}) pasa al Fondo de Pensiones para el Bienestar`, limite, ["asesor"]);
      }
    }
  }
  return r;
}
