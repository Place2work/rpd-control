import { describe, expect, it } from "vitest";
import { burbuja, nuevas, renglon, resumenPorPersona, type Actividad } from "./actividad";

const a = (id: string, tipo: Actividad["tipo"], usuarioId: string, at: string, detalle?: string): Actividad => ({ id, tipo, usuarioId, at, detalle });

describe("equipo en vivo", () => {
  it("burbujas y renglones sin datos del cliente; nombre propio con mayúscula inicial", () => {
    expect(burbuja(a("1", "campo", "g", "t", "Jiutepec"))).toBe("+1 en Jiutepec");
    expect(burbuja(a("2", "cierre", "s", "t"))).toBe("¡Honorario cobrado!");
    expect(renglon(a("3", "campo", "g", "t", "Jiutepec"), "NICEFORO JUAN EREIVA PERALTA")).toBe("Niceforo levantó un prospecto en Jiutepec");
    expect(renglon(a("4", "etapa", "s", "t", "Contrato firmado"), "ana lópez")).toBe("Ana movió un caso a «Contrato firmado»");
  });
  it("resumen por persona", () => {
    const r = resumenPorPersona([a("1", "campo", "g", "t"), a("2", "campo", "g", "t"), a("3", "verificacion", "d", "t"), a("4", "cierre", "s", "t"), a("5", "etapa", "s", "t")]);
    expect(r.get("g")).toMatchObject({ total: 2, prospectos: 2 });
    expect(r.get("s")).toMatchObject({ total: 2, cierres: 1, avances: 1 });
  });
  it("solo lo nuevo, en orden de llegada", () => {
    const n = nuevas([a("2", "etapa", "s", "2026-11-18T16:00:00Z"), a("1", "campo", "g", "2026-11-18T15:00:00Z"), a("0", "campo", "g", "2026-11-18T14:00:00Z")], new Set(["0"]));
    expect(n.map((x) => x.id)).toEqual(["1", "2"]);
  });
});
