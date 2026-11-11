import { describe, expect, it } from "vitest";
import { esquemaReferencia, leerReferenciasAlta, telefonoDelCliente } from "./referencias";

const base = { nombre: "María López Pérez", telefono: "55 1234 5678", parentesco: "hermano", domicilio: "", anios_conocerlo: "", notas: "" };

describe("referencias personales", () => {
  it("acepta una referencia completa y normaliza el teléfono", () => {
    const r = esquemaReferencia.parse({ ...base, domicilio: "Calle 5 #10, Cuernavaca", anios_conocerlo: "12" });
    expect(r.telefono).toBe("+525512345678");
    expect(r.anios_conocerlo).toBe(12);
    expect(r.domicilio).toBe("Calle 5 #10, Cuernavaca");
    expect(r.notas).toBeNull();
  });
  it("pide nombre completo, teléfono de 10 dígitos y parentesco", () => {
    const r = esquemaReferencia.safeParse({ ...base, nombre: "María", telefono: "123", parentesco: "" });
    expect(r.success).toBe(false);
    const campos = r.error!.issues.map((i) => i.path[0]);
    expect(campos).toEqual(expect.arrayContaining(["nombre", "telefono", "parentesco"]));
  });
  it("los años de conocerlo son opcionales pero razonables", () => {
    expect(esquemaReferencia.safeParse({ ...base, anios_conocerlo: "150" }).success).toBe(false);
    expect(esquemaReferencia.safeParse({ ...base, anios_conocerlo: "2.5" }).success).toBe(false);
  });
  it("el teléfono de la referencia no puede ser el del cliente", () => {
    expect(telefonoDelCliente("+525512345678", "+525512345678")).toBe(true);
    expect(telefonoDelCliente("+525512345678", null)).toBe(false);
  });
});

describe("referencias en el alta (opcionales)", () => {
  it("sin nada escrito se guarda el alta sin referencias", () => {
    expect(leerReferenciasAlta({}, null)).toEqual({ referencias: [], errores: {} });
    expect(leerReferenciasAlta({ ref1_nombre: "  ", ref2_parentesco: "" }, null)).toEqual({ referencias: [], errores: {} });
  });
  it("una referencia llena se guarda y la vacía se omite", () => {
    const r = leerReferenciasAlta({ ref1_nombre: "María López Pérez", ref1_telefono: "5511112222", ref1_parentesco: "hermano" }, "+527771234567");
    expect(r.errores).toEqual({});
    expect(r.referencias).toHaveLength(1);
    expect(r.referencias[0]).toMatchObject({ orden: 1, telefono: "+525511112222", parentesco: "hermano" });
  });
  it("una referencia a medias se señala con su campo", () => {
    const r = leerReferenciasAlta({ ref2_nombre: "Juan Pérez" }, null);
    expect(r.referencias).toHaveLength(0);
    expect(Object.keys(r.errores)).toEqual(expect.arrayContaining(["ref2_telefono", "ref2_parentesco"]));
  });
  it("no acepta el teléfono del propio cliente", () => {
    const r = leerReferenciasAlta({ ref1_nombre: "Ana Ruiz Soto", ref1_telefono: "7771234567", ref1_parentesco: "amigo" }, "+527771234567");
    expect(r.errores.ref1_telefono).toMatch(/teléfono del cliente/);
  });
});
