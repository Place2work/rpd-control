// Casos de la sección 9 y 14.1 (T11, T12, T13) con los parámetros de la sección 14.
import { describe, expect, it } from "vitest";
import {
  alertasDinero, comisionesDelCaso, conciliar, desglosarTotal, finDeMes, honorarioDePago, leerPctPactado, liquidacionReferidor, margenCaso,
  honorariosProyectados, pagoRepetido, pagosAforePermitidos, pctHonorarioRetiro, type CasoProyectable,
  repartoSocio, sumar, type CasoDinero, type ComisionGuardada, type EsquemasCaso, type ParametrosDinero,
} from "../comisiones";

const P: ParametrosDinero = {
  HONORARIO_RETIRO_PCT: 0.3, IVA: 0.16, BASE_HONORARIO: "neto", BASE_COMISION_VENDEDOR: "igual_honorario",
  BASE_REPARTO_SOCIO: "subtotal", COSTO_ADMIN_SOCIO_POR: "caso",
  FALLEC_COMISION_INICIAL: 3000, FALLEC_COMISION_MENSUALIDAD: 3000, FALLEC_COMISION_PCT_RECUPERADO: 0.05,
};
const ESCALONES = [{ desde: 1, hasta: 2, monto: 1000 }, { desde: 3, hasta: 10, monto: 2000 }, { desde: 11, hasta: null, monto: 3000 }];
const E: EsquemasCaso = {
  vendedor: { id: "ev", reglas: { tipo: "porcentaje", pct: 0.05, base: "monto_afore" } },
  referidor: { id: "er", reglas: { tipo: "escalonado_mensual", escalones: ESCALONES } },
  socio: { id: "es", reglas: { tipo: "reparto", pct_socio: 0.4, costo_admin: 500 } },
};
const HOY = "2026-10-27";
const caso = (x: Partial<CasoDinero>): CasoDinero => ({
  id: "c1", tipoServicio: "RETIRO_DESEMPLEO", contratoFirmado: true, perdido: false, montoEstimado: 10000,
  vendedorId: null, referidorId: null, socio: null, pagos: [], cobros: [], ...x,
});
const pago = (numero: number, neto: number, fecha = "2026-10-10", isr = 0) => ({ id: `p${numero}`, numero, fecha, bruto: neto + isr, isr, neto });
const cobro = (pagoId: string, honorario: number, estado: "por_cobrar" | "cobrado" = "cobrado", fecha: string | null = "2026-10-12") => {
  const d = desglosarTotal(honorario, 0.16);
  return { id: `k-${pagoId}`, pagoAforeId: pagoId, concepto: null, base: null, honorario: d.honorario, subtotal: d.subtotal, iva: d.iva, estado, fecha: estado === "cobrado" ? fecha : null };
};

describe("2.2 honorario sobre el depósito", () => {
  it("T11: Afore deposita $10,000 → $3,000 = $2,586.21 + IVA $413.79", () => {
    expect(honorarioDePago({ bruto: 10000, neto: 10000 }, P)).toEqual({ base: 10000, honorario: 3000, subtotal: 2586.21, iva: 413.79 });
  });
  it("con ISR retenido, el 30% va sobre el neto (decisión 28-oct); con bruto, sobre el bruto", () => {
    expect(honorarioDePago({ bruto: 11000, neto: 10000 }, P).honorario).toBe(3000);
    expect(honorarioDePago({ bruto: 11000, neto: 10000 }, { ...P, BASE_HONORARIO: "bruto" }).honorario).toBe(3300);
  });
  it("honorario fijo: el IVA es la diferencia y suma exacto", () => {
    const d = desglosarTotal(4999.99, 0.16);
    expect(d.subtotal + d.iva).toBeCloseTo(4999.99, 10);
  });
});

describe("pagos de la Afore por retiro", () => {
  it("modalidad A o sin elegir: un solo pago; B: hasta el máximo de mensualidades", () => {
    expect(pagosAforePermitidos("A", 6)).toBe(1);
    expect(pagosAforePermitidos(null, 6)).toBe(1);
    expect(pagosAforePermitidos("B", 6)).toBe(6);
  });
  it("detecta el doble registro (misma fecha y monto), no otra mensualidad", () => {
    const previos = [{ fecha: "2026-11-07", bruto: 35193 }];
    expect(pagoRepetido({ fecha: "2026-11-07", bruto: 35193.0 }, previos)).toEqual(previos[0]);
    expect(pagoRepetido({ fecha: "2026-12-07", bruto: 35193 }, previos)).toBeNull();
    expect(pagoRepetido({ fecha: "2026-11-07", bruto: 35193.01 }, previos)).toBeNull();
  });
});

describe("honorario pactado con el cliente", () => {
  it("sin pacto aplica el parámetro; con pacto, el pactado", () => {
    expect(pctHonorarioRetiro(null, P)).toBe(0.3);
    expect(pctHonorarioRetiro(0.22, P)).toBe(0.22);
  });
  it("con 22% pactado, la Afore deposita $10,000 → $2,200 = $1,896.55 + IVA $303.45", () => {
    expect(honorarioDePago({ bruto: 10000, neto: 10000 }, { ...P, HONORARIO_RETIRO_PCT: pctHonorarioRetiro(0.22, P) }))
      .toEqual({ base: 10000, honorario: 2200, subtotal: 1896.55, iva: 303.45 });
  });
  it("lee lo que escribe el usuario", () => {
    expect(leerPctPactado("22")).toEqual({ pct: 0.22 });
    expect(leerPctPactado(" 22.5 % ")).toEqual({ pct: 0.225 });
    expect(leerPctPactado("22,5")).toEqual({ pct: 0.225 });
    expect(leerPctPactado("")).toEqual({ pct: null });
    expect(leerPctPactado("0")).toHaveProperty("error");
    expect(leerPctPactado("100")).toHaveProperty("error");
    expect(leerPctPactado("veinte")).toHaveProperty("error");
    expect(leerPctPactado("0.22")).toEqual({ pct: 0.0022 }); // se escribe en por ciento, no en fracción
  });
});

describe("9.2 retiro de $10,000 con vendedor (T11)", () => {
  const c = caso({ vendedorId: "juan", pagos: [pago(1, 10000)], cobros: [cobro("p1", 3000)] });
  const r = comisionesDelCaso(c, E, P, HOY);
  it("comisión $500.00 devengada al cobrar", () => {
    expect(r).toEqual([expect.objectContaining({ clave: "vendedor:pago:1", base: 10000, monto: 500, estado: "devengada", fechaDevengo: "2026-10-12" })]);
  });
  it("margen antes de gastos $2,086.21", () => {
    expect(margenCaso(c.cobros, r)).toEqual({ honorario: 3000, iva: 413.79, comisiones: 500, margen: 2086.21 });
  });
});

describe("ciclo de la comisión del vendedor", () => {
  it("antes de pagos: estimada sobre el monto del cálculo; sin contrato, nada", () => {
    expect(comisionesDelCaso(caso({ vendedorId: "juan" }), E, P, HOY)).toEqual([expect.objectContaining({ clave: "vendedor:estimado", monto: 500, estado: "estimada" })]);
    expect(comisionesDelCaso(caso({ vendedorId: "juan", contratoFirmado: false }), E, P, HOY)).toEqual([]);
  });
  it("pago registrado sin cobrar: estimada con el monto real; no se devenga sin dinero", () => {
    const r = comisionesDelCaso(caso({ vendedorId: "juan", pagos: [pago(1, 8000)], cobros: [cobro("p1", 2400, "por_cobrar")] }), E, P, HOY);
    expect(r).toEqual([expect.objectContaining({ clave: "vendedor:pago:1", monto: 400, estado: "estimada", fechaDevengo: null })]);
  });
  it("modalidad B: una comisión por mensualidad, cada una se devenga con su cobro", () => {
    const r = comisionesDelCaso(caso({ vendedorId: "juan", pagos: [pago(1, 4500), pago(2, 4500, "2026-11-10")], cobros: [cobro("p1", 1350), cobro("p2", 1350, "por_cobrar")] }), E, P, HOY);
    expect(r.map((x) => [x.clave, x.monto, x.estado])).toEqual([["vendedor:pago:1", 225, "devengada"], ["vendedor:pago:2", 225, "estimada"]]);
  });
  it("caso perdido: se queda solo lo devengado", () => {
    const r = comisionesDelCaso(caso({ vendedorId: "juan", perdido: true, pagos: [pago(1, 4500), pago(2, 4500)], cobros: [cobro("p1", 1350), cobro("p2", 1350, "por_cobrar")] }), E, P, HOY);
    expect(r.map((x) => x.clave)).toEqual(["vendedor:pago:1"]);
    expect(comisionesDelCaso(caso({ vendedorId: "juan", perdido: true }), E, P, HOY)).toEqual([]);
  });
  it("pensión y otros servicios: sin comisión del vendedor hasta definir", () => {
    expect(comisionesDelCaso(caso({ vendedorId: "juan", tipoServicio: "PENSION_L73" }), E, P, HOY)).toEqual([]);
  });
});

describe("T13 socio licenciatario", () => {
  it("honorario $3,000: sobre subtotal $834.48; sobre honorario con IVA $1,000.00", () => {
    expect(repartoSocio(2586.21, 500, 0.4)).toEqual({ base: 2086.21, socio: 834.48, rpd: 1251.73 });
    expect(repartoSocio(3000, 500, 0.4).socio).toBe(1000);
  });
  it("en el caso: devengada al cobrar, con la base del parámetro", () => {
    const c = caso({ socio: { id: "s1", pct: 0.4, costoAdmin: 500 }, pagos: [pago(1, 10000)], cobros: [cobro("p1", 3000)] });
    expect(comisionesDelCaso(c, E, P, HOY)).toEqual([expect.objectContaining({ tipo: "socio", monto: 834.48, estado: "devengada" })]);
    expect(comisionesDelCaso(c, E, { ...P, BASE_REPARTO_SOCIO: "total" }, HOY)[0].monto).toBe(1000);
  });
  it("modalidad B: el costo administrativo se descuenta una vez por caso", () => {
    const c = caso({ socio: { id: "s1", pct: 0.4, costoAdmin: 500 }, pagos: [pago(1, 5000), pago(2, 5000)],
      cobros: [cobro("p1", 1500, "cobrado", "2026-10-01"), cobro("p2", 1500, "cobrado", "2026-10-20")] });
    // Subtotal de $1,500 = $1,293.10. Primero: (1,293.10 − 500) × 40% = 317.24. Segundo: 1,293.10 × 40% = 517.24.
    expect(comisionesDelCaso(c, E, P, HOY).map((x) => x.monto)).toEqual([317.24, 517.24]);
    expect(comisionesDelCaso(c, E, { ...P, COSTO_ADMIN_SOCIO_POR: "cobro" }, HOY).map((x) => x.monto)).toEqual([317.24, 317.24]);
  });
});

describe("T12 referidores", () => {
  it("2, 4 y 11 referidos cobrados en tres meses: $2,000 · $8,000 · $33,000", () => {
    expect([2, 4, 11].map((n) => liquidacionReferidor(ESCALONES, n))).toEqual([2000, 8000, 33000]);
  });
  it("el escalón se aplica a todos los del mes y se devenga al cerrar el mes", () => {
    const c = caso({ referidorId: "r1", pagos: [pago(1, 10000, "2026-09-10")], cobros: [cobro("p1", 3000, "cobrado", "2026-09-15")] });
    expect(comisionesDelCaso(c, E, P, HOY, { "2026-09": 4 })).toEqual([expect.objectContaining({ clave: "referido", monto: 2000, estado: "devengada", fechaDevengo: "2026-09-30", periodo: "2026-09-01" })]);
    // Mes en curso: estimada, el escalón todavía puede subir.
    const abierto = caso({ referidorId: "r1", pagos: [pago(1, 10000)], cobros: [cobro("p1", 3000, "cobrado", "2026-10-15")] });
    expect(comisionesDelCaso(abierto, E, P, HOY, { "2026-10": 2 })[0]).toMatchObject({ monto: 1000, estado: "estimada" });
  });
  it("sin cobro: estimada con el primer escalón", () => {
    expect(comisionesDelCaso(caso({ referidorId: "r1" }), E, P, HOY)[0]).toMatchObject({ monto: 1000, estado: "estimada" });
  });
  it("fin de mes", () => {
    expect([finDeMes("2026-02"), finDeMes("2028-02"), finDeMes("2026-12")]).toEqual(["2026-02-28", "2028-02-29", "2026-12-31"]);
  });
});

describe("fallecimiento: componentes", () => {
  it("$3,000 del pago inicial, 5% de lo recuperado y $3,000 de la primera mensualidad, una vez cada fijo", () => {
    const fallec: EsquemasCaso = { ...E, vendedor: { id: "ef", reglas: { tipo: "compuesto", componentes: [
      { clave: "pago_inicial", fijo_param: "FALLEC_COMISION_INICIAL" }, { clave: "recuperado", pct_param: "FALLEC_COMISION_PCT_RECUPERADO" },
      { clave: "primera_mensualidad", fijo_param: "FALLEC_COMISION_MENSUALIDAD" }] } } };
    const k = (id: string, concepto: string, base: number | null, fecha: string) => ({ id, pagoAforeId: null, concepto, base, honorario: 5000, subtotal: 4310.34, iva: 689.66, estado: "cobrado" as const, fecha });
    const r = comisionesDelCaso(caso({ tipoServicio: "FALLECIMIENTO", vendedorId: "juan", cobros: [
      k("a", "pago_inicial", null, "2026-09-01"), k("b", "recuperado", 80000, "2026-09-20"), k("c", "primera_mensualidad", null, "2026-10-05"), k("d", "primera_mensualidad", null, "2026-10-06")] }), fallec, P, HOY);
    expect(r.map((x) => [x.componente, x.monto])).toEqual([["pago_inicial", 3000], ["recuperado", 4000], ["primera_mensualidad", 3000]]);
  });
});

describe("conciliación", () => {
  const d = comisionesDelCaso(caso({ vendedorId: "juan", pagos: [pago(1, 10000)], cobros: [cobro("p1", 3000)] }), E, P, HOY)[0];
  const g = (x: Partial<ComisionGuardada>): ComisionGuardada => ({ id: "g1", clave: d.clave, estado: d.estado, monto: d.monto, base: d.base, regla: d.regla, fechaDevengo: d.fechaDevengo, beneficiarioId: "juan", ...x });
  it("igual: no hace nada; distinta: actualiza; sobrante: cancela; pagada: no se toca", () => {
    expect(conciliar([d], [g({})])).toEqual({ crear: [], actualizar: [], cancelar: [] });
    expect(conciliar([d], [g({ estado: "estimada" })]).actualizar).toHaveLength(1);
    expect(conciliar([], [g({ clave: "vendedor:estimado", estado: "estimada" })]).cancelar).toEqual(["g1"]);
    expect(conciliar([d], [g({ estado: "pagada", monto: 1 })])).toEqual({ crear: [], actualizar: [], cancelar: [] });
    expect(conciliar([], [g({ estado: "pagada" })]).cancelar).toEqual([]);
  });
  it("la estimada se reemplaza por la del pago real", () => {
    const c = conciliar([d], [g({ id: "g0", clave: "vendedor:estimado", estado: "estimada" })]);
    expect([c.crear.length, c.cancelar]).toEqual([1, ["g0"]]);
  });
});

describe("8.1 alertas de dinero y 14.2 cuadre", () => {
  it("honorario sin cobro a los 2 días; mensualidad B pendiente a los 35; comisión sin pagar > 7 días", () => {
    const a = alertasDinero([
      { id: "c1", folio: "RP-1", nombre: "Ana", etapa: "PAGADO", modalidad: "B", pagos: [{ id: "p1", numero: 1, fecha: "2026-09-20", cobrado: true, tieneCobro: true }, { id: "p2", numero: 2, fecha: "2026-10-25", cobrado: false, tieneCobro: true }] },
      { id: "c2", folio: "RP-2", nombre: "Beto", etapa: "PAGADO", modalidad: "B", pagos: [{ id: "q1", numero: 1, fecha: "2026-09-20", cobrado: true, tieneCobro: true }] },
    ], [{ id: "k1", beneficiario: "Juan", beneficiarioClave: "usuario:juan", monto: 500, fechaDevengo: "2026-10-12" }, { id: "k2", beneficiario: "Juan", beneficiarioClave: "usuario:juan", monto: 225.5, fechaDevengo: "2026-10-25" }], HOY);
    expect(a.map((x) => x.regla)).toEqual(["HONORARIO_POR_COBRAR", "PAGO_AFORE_PENDIENTE", "COMISION_POR_PAGAR"]);
    expect(a[2].mensaje).toMatch(/1 comisión devengada por \$500\.00/);
  });
  it("suma al centavo", () => {
    expect(sumar([0.1, 0.2, 834.48, 1251.73])).toBe(2086.51);
  });
});

describe("honorario proyectado antes del depósito de la Afore", () => {
  const caso = (x: Partial<CasoProyectable>): CasoProyectable => ({ id: "c", etapa: "INGRESADA", montoEsperado: 35193, pctPactado: null, pagosAfore: 0, ...x });
  it("con el 30% general, $35,193 esperados proyectan $10,557.90; con 22% pactado, $7,742.46", () => {
    const r = honorariosProyectados([caso({ id: "a" }), caso({ id: "b", pctPactado: 0.22 })], P);
    expect(r.filas.map((f) => f.honorario)).toEqual([10557.9, 7742.46]);
    expect(r.total).toBe(18300.36);
  });
  it("no proyecta si ya hay pago registrado, si está cerrado o perdido, o sin monto", () => {
    expect(honorariosProyectados([caso({ pagosAfore: 1 }), caso({ etapa: "CERRADO" }), caso({ etapa: "PERDIDO" }), caso({ montoEsperado: null })], P).filas).toEqual([]);
  });
});

describe("porcentaje propio de cada vendedor", () => {
  it("con 7% propio, $35,193 de la Afore dan $2,463.51; sin % propio, el del esquema (5%)", () => {
    const pago1 = pago(1, 35193);
    const conPct = comisionesDelCaso(caso({ vendedorId: "v1", vendedorPct: 0.07, pagos: [pago1], cobros: [cobro("p1", 10557.9)] }), E, P, HOY);
    expect(conPct.find((x) => x.tipo === "vendedor")).toMatchObject({ monto: 2463.51, estado: "devengada" });
    expect(conPct.find((x) => x.tipo === "vendedor")!.regla).toContain("7%");
    const sinPct = comisionesDelCaso(caso({ vendedorId: "v1", pagos: [pago1], cobros: [cobro("p1", 10557.9)] }), E, P, HOY);
    expect(sinPct.find((x) => x.tipo === "vendedor")!.monto).toBe(1759.65);
  });
});

describe("reparto del asesor sobre el honorario con IVA (desde 8-nov-2026)", () => {
  it("35,190 netos al 30%: (10,557 − 500) × 40% = 4,022.80 para el asesor y 6,034.20 para la empresa", () => {
    expect(repartoSocio(10557, 500, 0.4)).toEqual({ base: 10057, socio: 4022.8, rpd: 6034.2 });
    expect(repartoSocio(10557, 0, 0.4)).toEqual({ base: 10557, socio: 4222.8, rpd: 6334.2 });
  });
});
