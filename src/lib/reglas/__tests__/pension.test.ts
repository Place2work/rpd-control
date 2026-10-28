// Sección 7.6 (fechas de pensión y Modalidad 40) y alertas de 8.1. hoy = 2026-10-27.
import { describe, expect, it } from "vitest";
import { sumarMeses } from "../fechas";
import { alertasPension, derechoM40, edadEn, estadoM40, fechasEdad, finConservacion, limitePagoM40, mesesPlanM40, type CasoPension, type ParametrosPension, type PagoM40Foto } from "../pension";

const P: ParametrosPension = {
  M40_ANIOS_DERECHO: 5, M40_SEMANAS_REQUERIDAS: 52, M40_MESES_BAJA: 2, M40_MESES_REINGRESO: 12, M40_DIA_LIMITE: 17, M40_PAGO_ADELANTADO: true,
  VENTANA_SIN_EXAMEN_MESES: 12, CONSERVACION_FRACCION: 0.25, CONSERVACION_MIN_MESES: 12,
  AVISO_M40_PAGO_DIAS: 5, AVISO_M40_PLAZO_DIAS: 60, AVISO_VENTANA_DIAS: 30, AVISO_EDAD_MESES: 6, AVISO_CONSERVACION_DIAS: 90,
  INFONAVIT_EDAD_AVISO: 69, INFONAVIT_EDAD_LIMITE: 70,
};
const HOY = "2026-10-27";

describe("fechas", () => {
  it("meses de calendario con fin de mes", () => {
    expect([sumarMeses("2026-01-31", 1), sumarMeses("2028-01-31", 1), sumarMeses("2026-11-15", 14)]).toEqual(["2026-02-28", "2028-02-29", "2028-01-15"]);
  });
  it("edad y cumpleaños 60/65/69/70", () => {
    expect([edadEn("1966-10-28", HOY), edadEn("1966-10-27", HOY)]).toEqual([59, 60]);
    expect(fechasEdad("1968-02-29")).toEqual({ cumple60: "2028-02-29", cumple65: "2033-02-28", cumple69: "2037-02-28", cumple70: "2038-02-28" });
  });
  it("M40: derecho a 5 años de la baja, 52 semanas, ventana sin examen a 12 meses (art. 85 RACERF)", () => {
    expect(derechoM40("2022-03-15", 60, P)).toEqual({ vence: "2027-03-15", cumpleSemanas: true, ventanaSinExamen: "2023-03-15" });
    expect(derechoM40("2022-03-15", 40, P).cumpleSemanas).toBe(false);
  });
  it("conservación de derechos Ley 73: ¼ del tiempo cotizado, mínimo 12 meses", () => {
    expect(finConservacion("2024-01-01", 1040, P)).toBe("2028-12-25"); // 1,040 sem × 7 / 4 = 1,820 días
    expect(finConservacion("2024-01-01", 100, P)).toBe("2025-01-01"); // 175 días < 12 meses
  });
});

describe("pagos M40", () => {
  it("vence el día 17 del mes cubierto (adelantado) o del siguiente", () => {
    expect(limitePagoM40("2026-11-01", P)).toBe("2026-11-17");
    expect(limitePagoM40("2026-12-01", { ...P, M40_PAGO_ADELANTADO: false })).toBe("2027-01-17");
    expect(limitePagoM40("2027-02-01", { ...P, M40_DIA_LIMITE: 30 })).toBe("2027-02-28");
  });
  it("meses del plan", () => {
    expect(mesesPlanM40("2026-11-01", "2027-02-01")).toEqual(["2026-11-01", "2026-12-01", "2027-01-01", "2027-02-01"]);
  });
  const pago = (mes: string, pagado: string | null): PagoM40Foto => ({ id: mes, mes, fechaLimite: limitePagoM40(mes, P), fechaPago: pagado });
  it("al corriente, atrasado con 1 mes, y baja con 2 meses seguidos (art. 220)", () => {
    expect(estadoM40([pago("2026-09-01", "2026-09-10"), pago("2026-10-01", "2026-10-15"), pago("2026-11-01", null)], HOY, P)).toMatchObject({ estado: "al_corriente", proximo: { mes: "2026-11-01" } });
    expect(estadoM40([pago("2026-09-01", "2026-09-10"), pago("2026-10-01", null), pago("2026-11-01", null)], HOY, P)).toMatchObject({ estado: "atrasado", vencidos: [{ mes: "2026-10-01" }] });
    expect(estadoM40([pago("2026-09-01", null), pago("2026-10-01", null)], HOY, P)).toEqual(expect.objectContaining({ estado: "baja", fechaBaja: "2026-10-18", reingresoHasta: "2027-10-18" }));
  });
  it("dos meses sin pago no seguidos no son baja", () => {
    expect(estadoM40([pago("2026-08-01", null), pago("2026-09-01", "2026-09-10"), pago("2026-10-01", null)], HOY, P).estado).toBe("atrasado");
  });
});

describe("alertas de pensión (8.1)", () => {
  const base: CasoPension = { id: "c", folio: "RP-1", nombre: "Rosa", etapa: "ESTRATEGIA_EN_EJECUCION", servicio: "MODALIDAD_40", regimen: "L73", fechaNacimiento: null, fechaBaja: null, semanasCotizadas: null, pagosM40: [] };
  const reglas = (c: Partial<CasoPension>, hoy = HOY) => alertasPension([{ ...base, ...c }], hoy, P).map((a) => a.regla);
  const pago = (mes: string, pagado: string | null): PagoM40Foto => ({ id: mes, mes, fechaLimite: limitePagoM40(mes, P), fechaPago: pagado });
  it("M40: pago próximo 5 días antes; un mes sin pago es crítico", () => {
    expect(reglas({ pagosM40: [pago("2026-10-01", "2026-10-10"), pago("2026-11-01", null)] }, "2026-11-12")).toEqual(["M40_PAGO_PROXIMO"]);
    expect(reglas({ pagosM40: [pago("2026-10-01", null), pago("2026-11-01", null)] }, "2026-10-20")).toEqual(["M40_UN_MES_SIN_PAGO"]);
    expect(alertasPension([{ ...base, pagosM40: [pago("2026-09-01", null), pago("2026-10-01", null)] }], HOY, P)[0].mensaje).toMatch(/causó baja/);
  });
  it("derecho a M40 por vencer (60 días antes), solo si no hay pagos programados", () => {
    expect(reglas({ fechaBaja: "2021-12-01" })).toEqual(["M40_PLAZO_5_ANIOS"]); // vence 2026-12-01: faltan 35 días
    expect(reglas({ fechaBaja: "2021-12-01", pagosM40: [pago("2026-11-01", null)] })).toEqual([]);
  });
  it("ventana de 12 meses y conservación de derechos Ley 73", () => {
    expect(reglas({ servicio: "PTI_M10", fechaBaja: "2025-11-15" })).toEqual(["VENTANA_12_MESES"]);
    expect(reglas({ servicio: "PENSION_L73", fechaBaja: "2025-12-20", semanasCotizadas: 200 })).toContain("CONSERVACION_DERECHOS"); // 12 meses → 2026-12-20
  });
  it("edad de pensión 6 meses antes de 60 y 65; Infonavit a los 69", () => {
    expect(reglas({ servicio: "PENSION_L73", fechaNacimiento: "1967-03-01" })).toEqual(["EDAD_PENSION"]); // cumple 60 el 2027-03-01
    expect(reglas({ servicio: "PENSION_L73", fechaNacimiento: "1957-01-01" })).toEqual(["INFONAVIT_70"]);
    expect(reglas({ servicio: "FALLECIMIENTO", fechaNacimiento: "1967-03-01" })).toEqual([]);
  });
  it("casos cerrados no generan alertas", () => {
    expect(reglas({ etapa: "PERDIDO", fechaBaja: "2021-12-01" })).toEqual([]);
  });
});
