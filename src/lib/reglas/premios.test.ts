import { describe, expect, it } from "vitest";
import { progresoPremio, tablaPremio } from "./premios";

const tele = { meta: 30, desde: "2026-11-16", hasta: null };

describe("premios del equipo", () => {
  it("solo cuentan los cierres desde el inicio del premio; sin fecha límite", () => {
    expect(progresoPremio(tele, ["2026-11-15", "2026-11-16", "2027-05-01"])).toEqual({ logrados: 2, faltan: 28, pct: 6, ganado: false });
  });
  it("con fecha límite, lo de después no cuenta", () => {
    expect(progresoPremio({ meta: 2, desde: "2026-11-16", hasta: "2026-12-31" }, ["2026-12-31", "2027-01-01"]).logrados).toBe(1);
  });
  it("al llegar a la meta lo gana; el avance no pasa de 100% ni faltan negativos", () => {
    const fechas = Array.from({ length: 31 }, () => "2026-12-01");
    expect(progresoPremio(tele, fechas)).toEqual({ logrados: 31, faltan: 0, pct: 100, ganado: true });
  });
  it("la tabla ordena por avance y luego por nombre", () => {
    const t = tablaPremio(tele, [{ nombre: "Beto", cierres: ["2026-12-01"] }, { nombre: "Ana", cierres: ["2026-12-01"] }, { nombre: "Ciro", cierres: [] },
      { nombre: "Dora", cierres: ["2026-12-01", "2026-12-02"] }]);
    expect(t.map((x) => x.nombre)).toEqual(["Dora", "Ana", "Beto", "Ciro"]);
  });
});
