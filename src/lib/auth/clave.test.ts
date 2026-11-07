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
