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
