import { describe, expect, it } from "vitest";
import { movimientosPosibles, requisitos, validarTransicion, type FotoCaso } from "../etapas";

const base: FotoCaso = {
  embudo: "retiro",
  etapa: "PROSPECTO",
  regimen: "L97",
  tieneTelefono: true,
  resultadoPrecalificacion: null,
  dictamenManual: null,
  dia46: { yaPuede: true, fecha: "2026-10-20", diasFaltan: 0 },
  candado: { estado: "libre" },
  fechaContrato: null,
  analisisImpactoOk: false,
  clienteEntendioCosto: false,
  honorarioFijo: false,
  documentosPendientes: 0,
  fechaIngresoSolicitud: null,
  acuseAfore: null,
  resultadoAfore: null,
  fechaResolucion: null,
  pagosAfore: 0,
  cobrosPendientes: 0,
  cobrosTotal: 0,
};
const destinos = (c: FotoCaso, rol: "director" | "vendedor" = "director") => movimientosPosibles(c, rol).map((m) => m.destino);

describe("Precalificado: el dictamen manual sustituye al cálculo mientras no haya calculadora", () => {
  it("sin dictamen no avanza", () => {
    expect(requisitos(base, "PRECALIFICADO")).toEqual(["Registra el dictamen «Apto» en IMSS y Afore"]);
  });
  it("con dictamen Apto avanza", () => {
    expect(requisitos({ ...base, dictamenManual: "APTO" }, "PRECALIFICADO")).toEqual([]);
  });
  it("con dictamen No apto sugiere marcarlo como perdido", () => {
    expect(requisitos({ ...base, dictamenManual: "NO_APTO" }, "PRECALIFICADO")[0]).toMatch(/perdido/);
  });
});

describe("Contrato (6.1)", () => {
  const listo: FotoCaso = { ...base, etapa: "PRECALIFICADO", dictamenManual: "APTO", fechaContrato: "2026-10-27" };
  it("con todo en orden puede firmar", () => {
    expect(requisitos(listo, "CONTRATO")).toEqual([]);
  });
  it("no firma antes del día 46 ni con el candado vigente o sin verificar", () => {
    const f = requisitos({ ...listo, dia46: { yaPuede: false, fecha: "2026-11-16", diasFaltan: 20 }, candado: { estado: "por_verificar" } }, "CONTRATO");
    expect(f).toContain("Todavía no llega el día 46 (2026-11-16)");
    expect(f).toContain("Verifica el último retiro en el estado de cuenta Afore");
    expect(requisitos({ ...listo, candado: { estado: "vigente", fecha: "2027-03-15", diasFaltan: 139 } }, "CONTRATO"))
      .toContain("El candado de 5 años sigue hasta el 2027-03-15");
  });
  it("Ley 73 exige análisis de impacto y que el cliente entendió el costo (2.5)", () => {
    expect(requisitos({ ...listo, regimen: "L73" }, "CONTRATO")[0]).toMatch(/Ley 73/);
    expect(requisitos({ ...listo, regimen: "L73", analisisImpactoOk: true, clienteEntendioCosto: true }, "CONTRATO")).toEqual([]);
  });
  it("sin fecha de baja ni fecha de firma, lo dice", () => {
    expect(requisitos({ ...listo, dia46: null, fechaContrato: null }, "CONTRATO")).toEqual(
      expect.arrayContaining(["Captura la fecha de baja", "Captura la fecha de firma del contrato"]));
  });
});

describe("En espera", () => {
  it("solo si hay fecha futura (día 46 o candado)", () => {
    const c = { ...base, etapa: "PRECALIFICADO" as const, dictamenManual: "APTO" as const };
    expect(requisitos(c, "EN_ESPERA")).toHaveLength(1);
    expect(requisitos({ ...c, dia46: { yaPuede: false, fecha: "2026-11-16", diasFaltan: 20 } }, "EN_ESPERA")).toEqual([]);
  });
});

describe("Ingresada y resolución", () => {
  const exp: FotoCaso = { ...base, etapa: "EXPEDIENTE", fechaContrato: "2026-10-27" };
  it("no ingresa con documentos obligatorios pendientes (14.2)", () => {
    expect(requisitos({ ...exp, documentosPendientes: 2, fechaIngresoSolicitud: "2026-10-28", acuseAfore: "A1" }, "INGRESADA"))
      .toEqual(["Faltan 2 documentos obligatorios validados"]);
    expect(requisitos({ ...exp, fechaIngresoSolicitud: "2026-10-28", acuseAfore: "A1" }, "INGRESADA")).toEqual([]);
  });
  it("resolución solo si la Afore aprobó", () => {
    expect(requisitos({ ...exp, etapa: "INGRESADA", resultadoAfore: "rechazado", fechaResolucion: "2026-11-02" }, "RESOLUCION"))
      .toEqual(["Registra la resolución favorable de la Afore"]);
  });
});

describe("movimientos y permisos", () => {
  it("nunca salta etapas", () => {
    expect(destinos(base)).not.toContain("CONTRATO");
    expect(validarTransicion(base, "INGRESADA", "director", null)[0]).toMatch(/No se puede pasar/);
  });
  it("perdido siempre disponible pero con motivo", () => {
    expect(destinos(base, "vendedor")).toContain("PERDIDO");
    expect(validarTransicion(base, "PERDIDO", "vendedor", "")).toEqual(["Escribe el motivo (mínimo 5 caracteres)"]);
    expect(validarTransicion(base, "PERDIDO", "vendedor", "No contesta desde hace 3 semanas")).toEqual([]);
  });
  it("regresar solo asesor o Director, con motivo (6.3)", () => {
    const c: FotoCaso = { ...base, etapa: "CONTRATO", fechaContrato: "2026-10-27" };
    expect(destinos(c, "vendedor")).not.toContain("PROSPECTO");
    expect(destinos(c, "director")).toEqual(expect.arrayContaining(["PROSPECTO", "PRECALIFICADO", "EN_ESPERA"]));
    expect(validarTransicion(c, "PRECALIFICADO", "director", null)).toEqual(["Escribe el motivo (mínimo 5 caracteres)"]);
  });
  it("un perdido se reabre como prospecto; bloqueado regresa a expediente", () => {
    expect(destinos({ ...base, etapa: "PERDIDO" })).toContain("PROSPECTO");
    expect(destinos({ ...base, etapa: "BLOQUEADO" })).toContain("EXPEDIENTE");
  });
  it("pensión avanza en línea y exige honorario fijo para el contrato", () => {
    const p: FotoCaso = { ...base, embudo: "pension", etapa: "PLAN_ENTREGADO", fechaContrato: "2026-10-27" };
    expect(destinos(p, "vendedor")).toContain("CONTRATO");
    expect(requisitos(p, "CONTRATO")).toEqual(["Captura el honorario fijo"]);
  });
});
