import { describe, expect, it } from "vitest";
import { centavos, panelFinanciero, porPagar, resumenGerente, semanaCerrada, semanaDe, sumarPaneles, whatsappMx } from "./campo";

describe("gerente de campo · dinero y semanas", () => {
  it("pesos a centavos sin flotantes", () => {
    expect(centavos("20")).toBe(2000);
    expect(centavos("20.5")).toBe(2050);
    expect(centavos("$1,250.00")).toBe(125000);
    expect(() => centavos("veinte")).toThrow();
  });
  it("semana de lunes a domingo y pago el miércoles siguiente", () => {
    expect(semanaDe("2026-11-16", 3)).toEqual({ inicio: "2026-11-16", fin: "2026-11-22", pago: "2026-11-25" }); // lunes
    expect(semanaDe("2026-11-22", 3)).toEqual({ inicio: "2026-11-16", fin: "2026-11-22", pago: "2026-11-25" }); // domingo
    expect(semanaDe("2026-11-23", 3).pago).toBe("2026-12-02");
  });
  it("agrupa lo no pagado por semana de verificación; lo verificado después del corte va al pago siguiente", () => {
    const ps = [
      { id: "p1", fecha: "2026-11-17", montoCent: 2000, pagada: false },
      { id: "p2", fecha: "2026-11-22", montoCent: 2000, pagada: false },
      { id: "p3", fecha: "2026-11-23", montoCent: 2000, pagada: false },
      { id: "p4", fecha: "2026-11-18", montoCent: 2000, pagada: true },
    ];
    const ds = [{ id: "d1", fecha: "2026-11-18", montoCent: 30000, pagada: false }];
    const l = porPagar(ps, ds, 3);
    expect(l).toHaveLength(2);
    expect(l[0]).toMatchObject({ semanaFin: "2026-11-22", fechaPago: "2026-11-25", prospectos: ["p1", "p2"], dias: ["d1"], montoProspectosCent: 4000, montoDiasCent: 30000, totalCent: 34000 });
    expect(l[1]).toMatchObject({ fechaPago: "2026-12-02", prospectos: ["p3"], totalCent: 2000 });
    expect(semanaCerrada(l[0], "2026-11-22")).toBe(false);
    expect(semanaCerrada(l[0], "2026-11-23")).toBe(true);
  });
  it("resumen: 100 verificados a $20 son $2,000 por cobrar; lo pendiente se estima con la tarifa", () => {
    const ps = [...Array.from({ length: 100 }, () => ({ estado: "verificado", montoCent: 2000, pagada: false })),
      ...Array.from({ length: 10 }, () => ({ estado: "pendiente", montoCent: null, pagada: false })), { estado: "rechazado", montoCent: null, pagada: false }];
    const r = resumenGerente(ps, [{ estado: "aprobada", montoCent: 30000, pagada: false }, { estado: "pendiente", montoCent: null, pagada: false }], [], 2000, 0, "2026-11-20");
    expect(r.verificados).toEqual({ n: 100, cent: 200000 });
    expect(r.enRevision).toEqual({ n: 10, centEstimado: 20000 });
    expect(r.rechazados).toBe(1);
    expect(r.dias).toEqual({ aprobados: 1, cent: 30000, enRevision: 1 });
    expect(r.porCobrarCent).toBe(230000);
  });
  it("WhatsApp de México a +52 y 10 dígitos", () => {
    expect(whatsappMx("55 1234 5678")).toBe("+525512345678");
    expect(whatsappMx("+52 1 55 1234 5678")).toBe("+525512345678");
    expect(whatsappMx("12345")).toBeNull();
  });
});

describe("panel financiero del gerente de campo", () => {
  const tarifas = { prospectoCent: 2000, diaCent: 25000 };
  const prospectos = [
    { estado: "verificado", montoCent: 2000, pagada: true, fechaRegistro: "2026-11-03" },
    { estado: "verificado", montoCent: 2000, pagada: false, fechaRegistro: "2026-11-10" },
    { estado: "verificado", montoCent: 2500, pagada: false, fechaRegistro: "2026-11-11" },
    { estado: "pendiente", montoCent: null, pagada: false, fechaRegistro: "2026-11-13" },
    { estado: "pendiente", montoCent: null, pagada: false, fechaRegistro: "2026-11-13" },
    { estado: "rechazado", montoCent: null, pagada: false, fechaRegistro: "2026-10-30" },
  ];
  const dias = [{ estado: "aprobada", montoCent: 30000, pagada: false }, { estado: "pendiente", montoCent: null, pagada: false }, { estado: "aprobada", montoCent: 25000, pagada: true }];
  const pagos = [{ fechaPago: "2026-11-11", totalCent: 27000 }, { fechaPago: "2026-10-28", totalCent: 10000 }];
  const liq = [{ semanaInicio: "2026-11-09", semanaFin: "2026-11-15", fechaPago: "2026-11-18", prospectos: ["a", "b"], dias: ["d"], montoProspectosCent: 4500, montoDiasCent: 30000, totalCent: 34500 }];
  it("por pagar, en revisión (estimado), proyección, próximo pago, pagado y conteos", () => {
    const p = panelFinanciero(prospectos, dias, pagos, liq, tarifas, "2026-11-13");
    expect(p.porPagar).toEqual({ cent: 34500, prospectos: 2, dias: 1 });
    expect(p.enRevision).toEqual({ centEstimado: 2 * 2000 + 25000, prospectos: 2, dias: 1 });
    expect(p.proyeccionCent).toBe(34500 + 29000);
    expect(p.proximoPago).toEqual({ fecha: "2026-11-18", cent: 34500 });
    expect(p.pagado).toEqual({ mesCent: 27000, totalCent: 37000 });
    expect(p.prospectos).toEqual({ total: 6, semana: 4, mes: 5, verificados: 3, pendientes: 2, rechazados: 1 });
    expect(p.tasaVerificacion).toBe(75);
    expect(p.costoPorVerificadoCent).toBe(Math.round((37000 + 34500) / 3));
  });
  it("sin datos no divide entre cero; la suma recalcula cocientes y junta el próximo pago del mismo día", () => {
    const vacio = panelFinanciero([], [], [], [], tarifas, "2026-11-13");
    expect(vacio.tasaVerificacion).toBeNull();
    expect(vacio.costoPorVerificadoCent).toBeNull();
    const p = panelFinanciero(prospectos, dias, pagos, liq, tarifas, "2026-11-13");
    const t = sumarPaneles([p, p, vacio]);
    expect(t.porPagar.cent).toBe(69000);
    expect(t.proximoPago).toEqual({ fecha: "2026-11-18", cent: 69000 });
    expect(t.tasaVerificacion).toBe(75);
    expect(t.prospectos.total).toBe(12);
  });
});
