import { describe, expect, it } from "vitest";
import { bloquesMarkdown, enLinea } from "./markdown";

describe("markdown de las lecciones", () => {
  it("negritas, cursivas y código en línea", () => {
    expect(enLinea("Antes **500** semanas y *estimado* con `APTO`.")).toEqual([
      { tipo: "texto", texto: "Antes " }, { tipo: "negrita", texto: "500" }, { tipo: "texto", texto: " semanas y " },
      { tipo: "cursiva", texto: "estimado" }, { tipo: "texto", texto: " con " }, { tipo: "codigo", texto: "APTO" }, { tipo: "texto", texto: "." },
    ]);
  });
  it("títulos, listas con continuación, tablas sin la fila separadora y citas", () => {
    const b = bloquesMarkdown("**Objetivos:** leer.\n\n- uno\n  sigue\n- dos\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n> cita\n> dos");
    expect(b.map((x) => x.tipo)).toEqual(["parrafo", "lista", "tabla", "cita"]);
    expect(b[1]).toMatchObject({ tipo: "lista", items: [[{ texto: "uno sigue" }], [{ texto: "dos" }]] });
    expect(b[2]).toMatchObject({ tipo: "tabla", filas: [[[{ texto: "1" }], [{ texto: "2" }]]] });
  });
  it("«Lo que dices» y «Lo que nunca dices» van en recuadro, con la lista que les sigue", () => {
    const b = bloquesMarkdown("**Lo que dices:** *\"Hola\"*\n\n**Lo que nunca dices:**\n\n- *\"Ya no piden los 5 años\"*\n\nOtro párrafo.");
    expect(b.map((x) => x.tipo)).toEqual(["recuadro", "recuadro", "parrafo"]);
    expect(b[0]).toMatchObject({ variante: "dices" });
    expect(b[1]).toMatchObject({ variante: "nunca", bloques: [{ tipo: "lista" }] });
    expect(b[0]).toMatchObject({ bloques: [{ tipo: "parrafo", texto: [{ tipo: "cursiva", texto: "\"Hola\"" }] }] });
  });
  it("bloques de código se conservan tal cual", () => {
    expect(bloquesMarkdown("```\ncociente = saldo ÷ semanas\n```")).toEqual([{ tipo: "codigo", texto: "cociente = saldo ÷ semanas" }]);
  });
});
