import { describe, expect, it } from "vitest";
import { altasPorPersona, costoAdministrativo, costoDeAlta, costoVigente, leerCostoAlta, type Alta } from "../costo-alta";

const V = [
  { desde: "2026-01-01", hasta: "2026-11-30", monto: 500 },
  { desde: "2026-12-01", hasta: null, monto: 650.5 },
];
const alta = (fecha: string, asesorId: string | null = null): Alta => ({ fecha, asesorId });

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
      { personaId: "ana", fecha: "2026-11-06", asesorId: "v1" }, { personaId: "ana", fecha: "2026-11-06", asesorId: "v1" },
      { personaId: "ana", fecha: "2026-11-20", asesorId: null }, { personaId: "luis", fecha: "2026-10-27", asesorId: null },
    ];
    expect(altasPorPersona(casos)).toEqual([{ fecha: "2026-10-27", asesorId: null }, { fecha: "2026-11-06", asesorId: "v1" }]);
    expect(costoAdministrativo(altasPorPersona(casos), V).total).toBe(1000);
  });
});

describe("costo propio de un alta", () => {
  it("una pensión en $0 no suma y otra en $800 suma 800; las demás usan el general", () => {
    const altas: Alta[] = [alta("2026-11-02"), { ...alta("2026-11-03"), costo: 0 }, { ...alta("2026-11-04"), costo: 800 }];
    expect(costoAdministrativo(altas, V)).toEqual({ altas: 3, total: 1300 });
  });
  it("el costo propio viaja con el alta de la persona (su primer caso)", () => {
    const casos = [
      { personaId: "eva", fecha: "2026-11-05", asesorId: null, costo: 0 }, { personaId: "eva", fecha: "2026-11-05", asesorId: null, costo: 0 },
      { personaId: "rosa", fecha: "2026-11-06", asesorId: null, costo: null },
    ];
    expect(altasPorPersona(casos)).toEqual([{ fecha: "2026-11-05", asesorId: null, costo: 0 }, { fecha: "2026-11-06", asesorId: null }]);
    expect(costoAdministrativo(altasPorPersona(casos), V).total).toBe(500);
  });
  it("lee lo que escribe el Director", () => {
    expect(leerCostoAlta("")).toEqual({ costo: null });
    expect(leerCostoAlta("0")).toEqual({ costo: 0 });
    expect(leerCostoAlta("$1,250.5")).toEqual({ costo: 1250.5 });
    expect(leerCostoAlta("-5")).toHaveProperty("error");
    expect(leerCostoAlta("abc")).toHaveProperty("error");
    expect(leerCostoAlta("2000000")).toHaveProperty("error");
  });
});

describe("un solo costo administrativo (alta y reparto del asesor)", () => {
  it("el del alta manda; sin costo propio, el general vigente el día del alta", () => {
    expect(costoDeAlta(null, "2026-11-08", V)).toBe(500);
    expect(costoDeAlta(undefined, "2026-12-05", V)).toBe(650.5);
    expect(costoDeAlta(0, "2026-11-08", V)).toBe(0);
    expect(costoDeAlta(800, "2026-11-08", V)).toBe(800);
  });
});
