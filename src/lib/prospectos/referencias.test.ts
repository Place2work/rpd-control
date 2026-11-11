import { describe, expect, it } from "vitest";
import { esquemaReferencia, telefonoDelCliente } from "./referencias";

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
