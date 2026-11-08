import { describe, expect, it } from "vitest";
import { altasPorPersona, costoAdministrativo, costoVigente, type Alta } from "../costo-alta";

const V = [
  { desde: "2026-01-01", hasta: "2026-11-30", monto: 500 },
  { desde: "2026-12-01", hasta: null, monto: 650.5 },
];
const alta = (fecha: string, vendedorId: string | null = null): Alta => ({ fecha, vendedorId });

describe("costo administrativo por alta", () => {
  it("10 prospectos a $500 son $5,000", () => {
    const altas = Array.from({ length: 10 }, (_, i) => alta(`2026-11-${String(i + 1).padStart(2, "0")}`));
    expect(costoAdministrativo(altas, V)).toEqual({ altas: 10, total: 5000 });
  });
  it("cada alta se valúa con el costo vigente el día en que se dio de alta", () => {
    expect(costoVigente("2026-11-30", V)).toBe(500);
    expect(costoVigente("2026-12-01", V)).toBe(650.5);
    expect(costoAdministrativo([alta("2026-11-30"), alta("2026-12-01"), alta("2026-12-02")], V).total).toBe(1801);
  });
  it("filtra por periodo y sin costo configurado vale 0", () => {
    const altas = [alta("2025-12-31"), alta("2026-11-07"), alta("2026-11-20")];
    expect(costoAdministrativo(altas, V, { desde: "2026-11-01", hasta: "2026-11-30" })).toEqual({ altas: 2, total: 1000 });
    expect(costoAdministrativo(altas, V)).toEqual({ altas: 3, total: 1000 });
  });
});

describe("una alta por persona", () => {
  it("un cliente con tres servicios es una sola alta (la primera)", () => {
    const casos = [
      { personaId: "ana", fecha: "2026-11-06", vendedorId: "v1" }, { personaId: "ana", fecha: "2026-11-06", vendedorId: "v1" },
      { personaId: "ana", fecha: "2026-11-20", vendedorId: null }, { personaId: "luis", fecha: "2026-10-27", vendedorId: null },
    ];
    expect(altasPorPersona(casos)).toEqual([{ fecha: "2026-10-27", vendedorId: null }, { fecha: "2026-11-06", vendedorId: "v1" }]);
    expect(costoAdministrativo(altasPorPersona(casos), V).total).toBe(1000);
  });
});
