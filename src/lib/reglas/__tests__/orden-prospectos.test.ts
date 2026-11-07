import { describe, expect, it } from "vitest";
import { ordenarPorRetiro } from "../orden-prospectos";

describe("orden de prospectos por fecha para retirar", () => {
  it("primero los que ya pueden (más antiguo arriba), luego los que faltan (menos días arriba), al final sin fecha", () => {
    const filas = [
      { id: "faltan13", fechaRetiro: "2026-11-20", alta: "2026-11-01" },
      { id: "sinBaja", fechaRetiro: null, alta: "2026-11-05" },
      { id: "faltan2", fechaRetiro: "2026-11-09", alta: "2026-11-02" },
      { id: "yaPuedeReciente", fechaRetiro: "2026-11-06", alta: "2026-10-01" },
      { id: "yaPuedeAntiguo", fechaRetiro: "2026-10-20", alta: "2026-09-01" },
      { id: "sinBajaViejo", fechaRetiro: null, alta: "2026-10-05" },
      { id: "hoy", fechaRetiro: "2026-11-07", alta: "2026-09-20" },
    ];
    expect(ordenarPorRetiro(filas, "2026-11-07").map((f) => f.id))
      .toEqual(["yaPuedeAntiguo", "yaPuedeReciente", "hoy", "faltan2", "faltan13", "sinBaja", "sinBajaViejo"]);
  });
});
