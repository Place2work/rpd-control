import { describe, expect, it } from "vitest";
import { grupoDe, planNuevaVigencia, validarValor, valorVisible } from "./parametros";

describe("validar valores", () => {
  it("porcentajes: se capturan como 26 o 26% y se guardan como fracción", () => {
    expect(validarValor("HONORARIO_RETIRO_PCT", "decimal", "26%")).toEqual({ ok: true, valor: "0.26" });
    expect(validarValor("IVA", "decimal", "16")).toEqual({ ok: true, valor: "0.16" });
    expect(validarValor("HONORARIO_RETIRO_PCT", "decimal", "130")).toMatchObject({ ok: false });
    expect(valorVisible("HONORARIO_RETIRO_PCT", "0.26")).toBe("26%");
  });
  it("montos con comas y signo; enteros; negativos y texto no", () => {
    expect(validarValor("UMA_MENSUAL", "decimal", "$3,566.22")).toEqual({ ok: true, valor: "3566.22" });
    expect(validarValor("DIAS_ESPERA_DESEMPLEO", "entero", "46")).toEqual({ ok: true, valor: "46" });
    expect(validarValor("DIAS_ESPERA_DESEMPLEO", "entero", "46.5")).toMatchObject({ ok: false });
    expect(validarValor("UMA_MENSUAL", "decimal", "-1")).toMatchObject({ ok: false });
    expect(validarValor("UMA_MENSUAL", "decimal", "abc")).toMatchObject({ ok: false });
  });
  it("opciones cerradas", () => {
    expect(validarValor("BASE_HONORARIO", "texto", "bruto")).toEqual({ ok: true, valor: "bruto" });
    expect(validarValor("BASE_HONORARIO", "texto", "otro")).toMatchObject({ ok: false });
  });
  it("grupos", () => {
    expect([grupoDe("UMA_MENSUAL"), grupoDe("M40_DIA_LIMITE"), grupoDe("PRESTADOR_RFC"), grupoDe("XYZ")]).toEqual(["Retiro por desempleo", "Pensión y Modalidad 40", "Contratos y prestador", "Otros"]);
  });
});

describe("vigencias", () => {
  const HOY = "2026-10-29";
  const filas = [{ id: "a", vigenteDesde: "2026-01-01", vigenteHasta: "2026-10-27" }, { id: "b", vigenteDesde: "2026-10-28", vigenteHasta: null }];
  it("nuevo valor desde mañana: cierra el vigente el día anterior", () => {
    expect(planNuevaVigencia(filas, "2026-11-01", HOY)).toEqual({ ok: true, accion: "crear", cerrar: [{ id: "b", hasta: "2026-10-31" }] });
  });
  it("no en el pasado; no encima de uno de hoy; uno futuro se reemplaza", () => {
    expect(planNuevaVigencia(filas, "2026-10-01", HOY)).toMatchObject({ ok: false });
    expect(planNuevaVigencia([{ id: "c", vigenteDesde: HOY, vigenteHasta: null }], HOY, HOY)).toMatchObject({ ok: false });
    expect(planNuevaVigencia([...filas, { id: "f", vigenteDesde: "2027-01-01", vigenteHasta: null }], "2027-01-01", HOY)).toEqual({ ok: true, accion: "reemplazar", id: "f" });
  });
  it("si hay uno programado después, primero se cambia ese", () => {
    expect(planNuevaVigencia([...filas, { id: "f", vigenteDesde: "2027-01-01", vigenteHasta: null }], "2026-12-01", HOY)).toMatchObject({ ok: false, error: expect.stringMatching(/2027-01-01/) });
  });
  it("parámetro nuevo sin historia", () => {
    expect(planNuevaVigencia([], HOY, HOY)).toEqual({ ok: true, accion: "crear", cerrar: [] });
  });
});
