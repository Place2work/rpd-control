// Lectura de parámetros vigentes (sección 5.9). No son datos sensibles: se leen sin RLS.
import "server-only";
import { prismaSistema } from "@/lib/db/prisma";
import { hoyCDMX } from "@/lib/tiempo";

export async function parametrosVigentes(claves: string[], fecha = hoyCDMX()): Promise<Record<string, string>> {
  const dia = new Date(`${fecha}T00:00:00Z`);
  const filas = await prismaSistema.parametro.findMany({
    where: {
      clave: { in: claves },
      vigente_desde: { lte: dia },
      OR: [{ vigente_hasta: null }, { vigente_hasta: { gte: dia } }],
    },
    orderBy: { vigente_desde: "desc" },
  });
  const r: Record<string, string> = {};
  for (const f of filas) r[f.clave] ??= f.valor;
  return r;
}

export type LigasConsulta = { curp: string; nss: string; semanas: string };

// Valores de respaldo por si alguien borra el parámetro; los vigentes salen de la tabla.
const LIGAS_RESPALDO: LigasConsulta = {
  curp: "https://www.gob.mx/curp/",
  nss: "https://serviciosdigitales.imss.gob.mx/gestionAsegurados-web-externo/asignacionNSS",
  semanas: "https://serviciosdigitales.imss.gob.mx/semanascotizadas-web/usuarios/IngresoAsegurado",
};

export async function ligasConsulta(): Promise<LigasConsulta> {
  try {
    const p = await parametrosVigentes(["LIGA_CONSULTA_CURP", "LIGA_CONSULTA_NSS", "LIGA_CONSULTA_SEMANAS"]);
    return {
      curp: p.LIGA_CONSULTA_CURP ?? LIGAS_RESPALDO.curp,
      nss: p.LIGA_CONSULTA_NSS ?? LIGAS_RESPALDO.nss,
      semanas: p.LIGA_CONSULTA_SEMANAS ?? LIGAS_RESPALDO.semanas,
    };
  } catch {
    return LIGAS_RESPALDO;
  }
}

// Parámetros numéricos que usan las reglas de fechas (7.1) y los días inhábiles cargados.
export async function parametrosFechas(fecha = hoyCDMX()) {
  const p = await parametrosVigentes(["DIAS_ESPERA_DESEMPLEO", "ANIOS_CANDADO_RETIRO", "VIGENCIA_CONTRATO_DIAS", "SLA_DIAS_HABILES", "AFORE_DIAS_HABILES"], fecha);
  const numero = (clave: string) => {
    const v = Number(p[clave]);
    if (!Number.isFinite(v)) throw new Error(`Falta el parámetro ${clave} vigente al ${fecha}`);
    return v;
  };
  const inhabiles = await prismaSistema.diaInhabil.findMany({ select: { fecha: true } });
  return {
    DIAS_ESPERA_DESEMPLEO: numero("DIAS_ESPERA_DESEMPLEO"),
    ANIOS_CANDADO_RETIRO: numero("ANIOS_CANDADO_RETIRO"),
    VIGENCIA_CONTRATO_DIAS: numero("VIGENCIA_CONTRATO_DIAS"),
    SLA_DIAS_HABILES: numero("SLA_DIAS_HABILES"),
    AFORE_DIAS_HABILES: numero("AFORE_DIAS_HABILES"),
    inhabiles: new Set(inhabiles.map((d) => d.fecha.toISOString().slice(0, 10))),
  };
}

// Parámetros del motor de retiro (7.2 a 7.5), vigentes en la fecha del cálculo: así un
// cálculo viejo se reproduce con la UMA de su fecha (14.2).
export async function parametrosRetiro(fecha = hoyCDMX()) {
  const claves = [
    "UMA_MENSUAL", "MODALIDAD_A_ANIOS", "MODALIDAD_A_BIMESTRES", "MODALIDAD_A_DIAS_SBC", "MODALIDAD_A_TOPE_UMAS",
    "MODALIDAD_B_ANIOS", "MODALIDAD_B_DIAS_SBC", "MODALIDAD_B_PCT_RCV", "UMBRAL_DIFERENCIA_MODALIDAD", "HONORARIO_RETIRO_PCT", "IVA",
    "L97_SEMANAS_2021", "L97_INCREMENTO_ANUAL", "L97_SEMANAS_TOPE", "L73_SEMANAS_MINIMAS", "L73_SEMANAS_CRITICAS",
    "DIAS_ESPERA_DESEMPLEO", "ANIOS_CANDADO_RETIRO", "UMA_DIARIA",
  ] as const;
  const p = await parametrosVigentes([...claves], fecha);
  const r = {} as Record<(typeof claves)[number], number>;
  for (const k of claves) {
    const v = Number(p[k]);
    if (!Number.isFinite(v)) throw new Error(`Falta el parámetro ${k} vigente al ${fecha}`);
    r[k] = v;
  }
  return r;
}

// Parámetros del dinero y las comisiones (2.2, 9 y decisiones 14.3 del 28-oct).
export async function parametrosDinero(fecha = hoyCDMX()): Promise<import("@/lib/reglas/comisiones").ParametrosDinero> {
  const p = await parametrosVigentes([
    "HONORARIO_RETIRO_PCT", "IVA", "BASE_HONORARIO", "BASE_COMISION_VENDEDOR", "BASE_REPARTO_SOCIO", "COSTO_ADMIN_SOCIO_POR",
    "FALLEC_COMISION_INICIAL", "FALLEC_COMISION_MENSUALIDAD", "FALLEC_COMISION_PCT_RECUPERADO",
  ], fecha);
  const numero = (clave: string) => {
    const v = Number(p[clave]);
    if (!Number.isFinite(v)) throw new Error(`Falta el parámetro ${clave} vigente al ${fecha}`);
    return v;
  };
  const opcion = <T extends string>(clave: string, validas: readonly T[], defecto: T): T =>
    (validas as readonly string[]).includes(p[clave]) ? (p[clave] as T) : defecto;
  return {
    HONORARIO_RETIRO_PCT: numero("HONORARIO_RETIRO_PCT"),
    IVA: numero("IVA"),
    BASE_HONORARIO: opcion("BASE_HONORARIO", ["neto", "bruto"], "neto"),
    BASE_COMISION_VENDEDOR: opcion("BASE_COMISION_VENDEDOR", ["igual_honorario", "neto", "bruto"], "igual_honorario"),
    BASE_REPARTO_SOCIO: opcion("BASE_REPARTO_SOCIO", ["subtotal", "total"], "subtotal"),
    COSTO_ADMIN_SOCIO_POR: opcion("COSTO_ADMIN_SOCIO_POR", ["caso", "cobro"], "caso"),
    FALLEC_COMISION_INICIAL: numero("FALLEC_COMISION_INICIAL"),
    FALLEC_COMISION_MENSUALIDAD: numero("FALLEC_COMISION_MENSUALIDAD"),
    FALLEC_COMISION_PCT_RECUPERADO: numero("FALLEC_COMISION_PCT_RECUPERADO"),
  };
}

// Plazos de pensión y Modalidad 40 (7.6) y avisos de 8.1.
export async function parametrosPension(fecha = hoyCDMX()): Promise<import("@/lib/reglas/pension").ParametrosPension> {
  const numeros = ["M40_ANIOS_DERECHO", "M40_SEMANAS_REQUERIDAS", "M40_MESES_BAJA", "M40_MESES_REINGRESO", "M40_DIA_LIMITE",
    "VENTANA_SIN_EXAMEN_MESES", "CONSERVACION_FRACCION", "CONSERVACION_MIN_MESES", "AVISO_M40_PAGO_DIAS", "AVISO_M40_PLAZO_DIAS",
    "AVISO_VENTANA_DIAS", "AVISO_EDAD_MESES", "AVISO_CONSERVACION_DIAS", "INFONAVIT_EDAD_AVISO", "INFONAVIT_EDAD_LIMITE"] as const;
  const p = await parametrosVigentes([...numeros, "M40_PAGO_ADELANTADO"], fecha);
  const r = {} as Record<(typeof numeros)[number], number>;
  for (const k of numeros) {
    const v = Number(p[k]);
    if (!Number.isFinite(v)) throw new Error(`Falta el parámetro ${k} vigente al ${fecha}`);
    r[k] = v;
  }
  return { ...r, M40_PAGO_ADELANTADO: p.M40_PAGO_ADELANTADO !== "no" };
}
