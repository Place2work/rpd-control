import { describe, expect, it } from "vitest";
import { cascadaGanancia, flujoHonorarios } from "../finanzas";

describe("cascada de la ganancia", () => {
  it("9,150.18 + 95,021.10 − 24,084.62 − 5,500 = 74,586.66, cada paso arranca donde termina el anterior", () => {
    const c = cascadaGanancia({ cobrado: 9150.18, proyectado: 95021.1, comisiones: 24084.62, altas: 5500 });
    expect(c.map((p) => [p.etiqueta, p.base, p.valor])).toEqual([
      ["Cobrado", 0, 9150.18], ["Proyectado", 9150.18, 95021.1],
      ["Comisiones", 80086.66, 24084.62], ["Altas", 74586.66, 5500], ["Ganancia", 0, 74586.66],
    ]);
  });
  it("si los descuentos superan lo cobrado, la barra no baja de cero y la ganancia queda negativa", () => {
    const c = cascadaGanancia({ cobrado: 0, proyectado: 1000, comisiones: 400, altas: 900 });
    expect(c[3]).toMatchObject({ base: 0, valor: 600, monto: 900 });
    expect(c[4].monto).toBe(-300);
  });
});

describe("honorarios por mes: cobrados y proyectados", () => {
  it("12 meses alrededor de hoy; por cobrar, sin fecha y vencidos al mes actual; lo lejano en «Después»", () => {
    const r = flujoHonorarios({
      hoy: "2026-11-08", cobradosPorMes: [{ mes: "2026-11", total: 9150.18 }, { mes: "2026-08", total: 100 }, { mes: "2025-01", total: 5 }],
      porCobrar: 50, proyectados: [{ fecha: "2026-12-15", honorario: 1000 }, { fecha: null, honorario: 200 }, { fecha: "2026-10-01", honorario: 30 }, { fecha: "2027-09-01", honorario: 7 }],
    });
    expect(r[0]).toEqual({ mes: "2026-06", etiqueta: "jun 26", cobrado: 0, proyectado: 0 });
    expect(r.find((x) => x.mes === "2026-11")).toEqual({ mes: "2026-11", etiqueta: "nov", cobrado: 9150.18, proyectado: 280 });
    expect(r.find((x) => x.mes === "2026-12")!.proyectado).toBe(1000);
    expect(r.find((x) => x.mes === "2026-08")!.cobrado).toBe(100);
    expect(r[11].mes).toBe("2027-05");
    expect(r.find((x) => x.mes === "2027-01")!.etiqueta).toBe("ene 27");
    expect(r[12]).toEqual({ mes: "despues", etiqueta: "Después", cobrado: 0, proyectado: 7 });
  });
});
