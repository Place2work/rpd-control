import { describe, expect, it } from "vitest";
import { alertasDelDia, resolverDestinatarios, type CasoAlertable } from "../alertas";

const HOY = "2026-10-27";
const P = { DIAS_ESPERA_DESEMPLEO: 46, ANIOS_CANDADO_RETIRO: 5, SLA_DIAS_HABILES: 15, inhabiles: new Set(["2026-11-02", "2026-11-16"]) };
const base: CasoAlertable = {
  id: "c1", folio: "RP-0001", nombre: "Juana", etapa: "PROSPECTO", esRetiro: true,
  ownerId: "v1", asignadoA: "a1", vendedorId: "v1",
  fechaBaja: null, fechaAperturaCuenta: null, estadoUltimoRetiro: "por_verificar", fechaUltimoRetiro: null,
  fechaAlta: HOY, ultimoContacto: HOY, ultimoMovimiento: HOY, ultimoDocumento: null, etapaDesde: HOY,
  fechaExpedienteCompleto: null, fechaLimiteIngreso: null, fechaIngresoSolicitud: null, fechaLimiteResolucion: null,
  fechaResolucion: null, fechaVencimientoContrato: null, documentosPorVencer: [],
};
const reglas = (c: Partial<CasoAlertable>, hoy = HOY) => alertasDelDia([{ ...base, ...c }], hoy, P).map((a) => a.regla);

describe("día 46", () => {
  it("aviso 3 días antes, crítica el día", () => {
    expect(reglas({ fechaBaja: "2026-09-14" })).toEqual(["DIA46_PROXIMO"]); // elegible 30-oct
    expect(reglas({ fechaBaja: "2026-09-11" })).toEqual(["DIA46_HOY"]); // elegible hoy
    expect(reglas({ fechaBaja: "2026-09-01" })).toEqual([]); // hace más de 7 días: ya no se avisa
    expect(reglas({ fechaBaja: "2026-10-01" })).toEqual([]); // faltan 20 días
  });
  it("la misma fecha produce siempre la misma clave (no se duplica)", () => {
    const a = alertasDelDia([{ ...base, fechaBaja: "2026-09-11" }], HOY, P)[0];
    const b = alertasDelDia([{ ...base, fechaBaja: "2026-09-11" }], "2026-10-29", P)[0];
    expect(a.clave).toBe(b.clave);
  });
  it("no avisa si el caso ya se ingresó o se perdió", () => {
    expect(reglas({ fechaBaja: "2026-09-11", etapa: "INGRESADA" })).toEqual([]);
    expect(reglas({ fechaBaja: "2026-09-11", etapa: "PERDIDO" })).toEqual([]);
  });
});

describe("candado y cuenta", () => {
  it("fin del candado: 7 días antes y el día", () => {
    expect(reglas({ estadoUltimoRetiro: "con_retiro", fechaUltimoRetiro: "2021-10-30" })).toEqual(["CANDADO5_FIN"]);
    expect(reglas({ estadoUltimoRetiro: "con_retiro", fechaUltimoRetiro: "2021-10-27" })).toEqual(["CANDADO5_FIN"]);
    expect(reglas({ estadoUltimoRetiro: "con_retiro", fechaUltimoRetiro: "2022-03-15" })).toEqual([]);
  });
  it("la cuenta cumple 3 años", () => {
    expect(reglas({ fechaAperturaCuenta: "2023-10-25" })).toEqual(["CUENTA_3_5_ANIOS"]);
  });
});

describe("prospectos", () => {
  it("sin contacto a las 24 h y luego cada 3 días, con clave distinta por tanda", () => {
    const una = alertasDelDia([{ ...base, fechaAlta: "2026-10-26", ultimoContacto: null }], HOY, P);
    const otra = alertasDelDia([{ ...base, fechaAlta: "2026-10-26", ultimoContacto: null }], "2026-10-30", P);
    expect(una[0].regla).toBe("PROSPECTO_SIN_CONTACTO");
    expect(una[0].clave).not.toBe(otra[0].clave);
    expect(reglas({ fechaAlta: HOY, ultimoContacto: null })).toEqual([]); // recién dado de alta
  });
  it("frío a los 14 días sin movimiento", () => {
    expect(reglas({ ultimoMovimiento: "2026-10-13" })).toEqual(["PROSPECTO_FRIO"]);
  });
});

describe("expediente, plazos y contrato", () => {
  it("documento por vencer en 7 días", () => {
    expect(reglas({ documentosPorVencer: [{ id: "d1", nombre: "Comprobante de domicilio", vence: "2026-11-02" }] })).toEqual(["DOC_POR_VENCER"]);
  });
  it("expediente detenido 5 días sin documento", () => {
    expect(reglas({ etapa: "EXPEDIENTE", etapaDesde: "2026-10-20" })).toEqual(["EXPEDIENTE_DETENIDO"]);
    expect(reglas({ etapa: "EXPEDIENTE", etapaDesde: "2026-10-20", ultimoDocumento: "2026-10-26" })).toEqual([]);
  });
  it("15 días hábiles: riesgo desde el día 10 y vencido después del límite (T6)", () => {
    const comun = { etapa: "EXPEDIENTE", fechaExpedienteCompleto: "2026-11-10", fechaLimiteIngreso: "2026-12-02", etapaDesde: "2026-11-10", ultimoDocumento: "2026-11-10" };
    expect(reglas(comun, "2026-11-23")).toEqual([]); // día hábil 8
    expect(reglas(comun, "2026-11-25")).toContain("SLA_15_RIESGO"); // día hábil 10
    expect(reglas(comun, "2026-12-03")).toContain("SLA_15_VENCIDO");
  });
  it("Afore sin resolución y contrato por vencer", () => {
    expect(reglas({ etapa: "INGRESADA", fechaIngresoSolicitud: "2026-10-19", fechaLimiteResolucion: "2026-10-26" })).toEqual(["AFORE_SIN_RESOLUCION"]);
    expect(reglas({ etapa: "EXPEDIENTE", etapaDesde: HOY, fechaVencimientoContrato: "2026-11-05" })).toEqual(["CONTRATO_POR_VENCER"]);
  });
});

describe("destinatarios", () => {
  const a = { regla: "DIA46_HOY", casoId: "c1", severidad: "critica" as const, mensaje: "", clave: "", para: ["asesor", "vendedor", "director"] as const };
  it("asesor, vendedor y directores sin repetir", () => {
    expect(resolverDestinatarios({ ...a, para: [...a.para] }, base, ["d1", "a1"]).sort()).toEqual(["a1", "d1", "v1"]);
  });
  it("sin asesor asignado, lo del asesor va al Director", () => {
    expect(resolverDestinatarios({ ...a, para: ["asesor"] }, { ...base, asignadoA: null }, ["d1"])).toEqual(["d1"]);
  });
});
