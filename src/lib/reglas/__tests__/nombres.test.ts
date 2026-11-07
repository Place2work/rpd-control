import { describe, expect, it } from "vitest";
import { limpiarNombre } from "../nombres";

const n = (nombre: string, apellido_paterno: string | null = null, apellido_materno: string | null = null) => ({ nombre, apellido_paterno, apellido_materno });

describe("nombre sin apellidos repetidos", () => {
  it("quita del nombre los apellidos que también se capturaron aparte", () => {
    expect(limpiarNombre(n("RUBICEL SALGADO TERAN", "SALGADO", "TERAN"))).toEqual(n("RUBICEL", "SALGADO", "TERAN"));
    expect(limpiarNombre(n("MARIO ARNOLD VALLADARES SILVA", "VALLADARES", "SILVA"))).toEqual(n("MARIO ARNOLD", "VALLADARES", "SILVA"));
  });
  it("aunque estén en otro orden, con dobles espacios o con acentos distintos", () => {
    expect(limpiarNombre(n("ANGEL DAVID JUAREZ  MARCELINO", "MARCELINO", "JUAREZ"))).toEqual(n("ANGEL DAVID", "MARCELINO", "JUAREZ"));
    expect(limpiarNombre(n("José Pérez", "Perez", null))).toEqual(n("José", "Perez", null));
  });
  it("apellido compuesto", () => {
    expect(limpiarNombre(n("Ana de la Cruz López", "de la Cruz", "López"))).toEqual(n("Ana", "de la Cruz", "López"));
  });
  it("no toca un nombre correcto ni deja el nombre vacío", () => {
    expect(limpiarNombre(n("PATRICIA SANDRA", "MERCADO", "JUAREZ"))).toEqual(n("PATRICIA SANDRA", "MERCADO", "JUAREZ"));
    expect(limpiarNombre(n("Salgado", "Salgado", null))).toEqual(n("Salgado", "Salgado", null));
    expect(limpiarNombre(n("PEDRO NAVA BERNAL"))).toEqual(n("PEDRO NAVA BERNAL"));
  });
  it("solo quita del final: un apellido igual a un nombre de pila se respeta", () => {
    expect(limpiarNombre(n("TERAN JOSE", "TERAN", null))).toEqual(n("TERAN JOSE", "TERAN", null));
  });
});
