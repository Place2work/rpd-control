import { describe, expect, it } from "vitest";
import { ALFABETO_CLAVE, claveTemporal, MINIMO_CLAVE } from "./clave";

describe("contraseña temporal", () => {
  it("4 bloques de 4 caracteres sin letras confusas y más larga que el mínimo", () => {
    const c = claveTemporal();
    expect(c).toMatch(/^[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){3}$/);
    expect(c.length).toBeGreaterThanOrEqual(MINIMO_CLAVE);
    expect([...c.replace(/-/g, "")].every((x) => ALFABETO_CLAVE.includes(x))).toBe(true);
    expect(c).not.toMatch(/[0O1lI]/);
  });
  it("no se repite", () => {
    const muchas = new Set(Array.from({ length: 2000 }, claveTemporal));
    expect(muchas.size).toBe(2000);
  });
});

describe("contraseña propia", () => {
  it("pide mínimo 6 caracteres, una mayúscula y un número", async () => {
    const { validarClave } = await import("./clave");
    expect(validarClave("Retiro7")).toBeNull();
    expect(validarClave("Abc12")).toMatch(/mínimo 6 caracteres/);
    expect(validarClave("retiro7")).toMatch(/mayúscula/);
    expect(validarClave("Retiros")).toMatch(/número/);
    expect(validarClave("")).toBe("Tu contraseña necesita: mínimo 6 caracteres, al menos una letra mayúscula (A-Z), al menos un número (0-9).");
    expect(validarClave("Ñandú2026")).toBeNull();
  });
});
