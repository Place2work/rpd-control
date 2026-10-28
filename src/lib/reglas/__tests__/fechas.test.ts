import { describe, expect, it } from "vitest";
import {
  antiguedadCuenta,
  diasHabilesTranscurridos,
  fechaCumpleAnios,
  fechaElegibleDesempleo,
  fechaFinCandado,
  regimenPorPrimeraAlta,
  sumarAnios,
  sumarDiasHabiles,
  vencimientoContrato,
} from "../fechas";

// Parámetros y `hoy` de la sección 14.
const P = { DIAS_ESPERA_DESEMPLEO: 46, ANIOS_CANDADO_RETIRO: 5, VIGENCIA_CONTRATO_DIAS: 90 };
const HOY = "2026-10-27";

describe("T5 · día 46", () => {
  it("baja 2026-10-01 → elegible 2026-11-16", () => {
    expect(fechaElegibleDesempleo("2026-10-01", HOY, P)).toEqual({ fecha: "2026-11-16", diasFaltan: 20, yaPuede: false });
  });
  it("el día 46 ya puede; después también, sin días negativos", () => {
    expect(fechaElegibleDesempleo("2026-09-11", HOY, P)).toMatchObject({ fecha: "2026-10-27", diasFaltan: 0, yaPuede: true });
    expect(fechaElegibleDesempleo("2026-01-01", HOY, P)).toMatchObject({ diasFaltan: 0, yaPuede: true });
  });
  it("el plazo sale del parámetro, no del código", () => {
    expect(fechaElegibleDesempleo("2026-10-01", HOY, { DIAS_ESPERA_DESEMPLEO: 45 }).fecha).toBe("2026-11-15");
  });
});

describe("T6 · 15 días hábiles", () => {
  it("expediente completo 2026-11-10 con inhábil 2026-11-16 → 2026-12-02", () => {
    expect(sumarDiasHabiles("2026-11-10", 15, new Set(["2026-11-16"]))).toBe("2026-12-02");
  });
  it("salta fin de semana: viernes + 1 hábil = lunes", () => {
    expect(sumarDiasHabiles("2026-10-23", 1, new Set())).toBe("2026-10-26");
  });
  it("cuenta los hábiles transcurridos para el aviso del día 10", () => {
    expect(diasHabilesTranscurridos("2026-11-10", "2026-11-24", new Set(["2026-11-16"]))).toBe(9);
  });
});

describe("T7 · candado de 5 años", () => {
  it("último retiro 2022-03-15 → vigente hasta 2027-03-15", () => {
    expect(fechaFinCandado("con_retiro", "2022-03-15", HOY, P)).toEqual({ estado: "vigente", fecha: "2027-03-15", diasFaltan: 139 });
  });
  it("sin verificar bloquea; 'nunca retiró' queda libre", () => {
    expect(fechaFinCandado("por_verificar", null, HOY, P)).toEqual({ estado: "por_verificar" });
    expect(fechaFinCandado("nunca_retiro", null, HOY, P)).toEqual({ estado: "libre" });
  });
  it("un retiro de hace más de 5 años ya venció", () => {
    expect(fechaFinCandado("con_retiro", "2020-01-10", HOY, P)).toEqual({ estado: "vencido", fecha: "2025-01-10" });
  });
});

describe("cuenta Afore y contrato", () => {
  it("antigüedad en años completos", () => {
    expect(antiguedadCuenta("2022-10-28", HOY)).toBe(3);
    expect(antiguedadCuenta("2022-10-27", HOY)).toBe(4);
    expect(antiguedadCuenta("2026-01-01", HOY)).toBe(0);
  });
  it("fecha en que cumple 3 años; 29 de febrero cae en 28", () => {
    expect(fechaCumpleAnios("2024-02-29", 3)).toBe("2027-02-28");
    expect(sumarAnios("2024-02-29", 4)).toBe("2028-02-29");
  });
  it("vigencia del contrato: 90 días + suspensiones", () => {
    expect(vencimientoContrato("2026-10-27", 0, P)).toBe("2027-01-25");
    expect(vencimientoContrato("2026-10-27", 7, P)).toBe("2027-02-01");
  });
  it("régimen por primera alta (corte 1-jul-1997)", () => {
    expect(regimenPorPrimeraAlta("1997-06-30")).toBe("L73");
    expect(regimenPorPrimeraAlta("1997-07-01")).toBe("L97");
  });
});


describe("bimestres cotizados estimados", () => {
  it("bimestres completos entre alta y baja", async () => {
    const { bimestresEntre } = await import("../fechas");
    expect(bimestresEntre("2020-01-15", "2026-09-14")).toBe(39); // 79 meses completos
    expect(bimestresEntre("2026-01-01", "2026-02-28")).toBe(0); // 1 mes completo
    expect(bimestresEntre("2026-01-01", "2026-03-01")).toBe(1);
    expect(bimestresEntre("2026-05-01", "2026-01-01")).toBe(0); // fechas al revés
  });
  it("las semanas dan el tope real cotizado", async () => {
    const { bimestresPorSemanas } = await import("../fechas");
    expect(bimestresPorSemanas(168)).toBe(19);
    expect(bimestresPorSemanas(52)).toBe(5);
  });
});
