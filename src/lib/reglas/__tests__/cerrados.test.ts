import { describe, expect, it } from "vitest";
import { embudoDelMes, filtrarCerrados, resumenCerrados, type ClienteCerrado } from "../cerrados";

const HOY = "2026-11-07";
const c = (x: Partial<ClienteCerrado>): ClienteCerrado => ({
  id: "c", folio: "RP-1", nombre: "Cliente", servicio: "Retiro", vendedorId: null, vendedor: null, cerradoEl: "2026-11-07",
  deposito: { fecha: "2026-11-07", neto: 35193 }, honorario: 9150.18, comprobantes: { con: 1, de: 1 }, proximoRetiro: "2031-11-07", ...x,
});

describe("clientes cerrados", () => {
  const filas = [
    c({ id: "a" }),
    c({ id: "b", cerradoEl: "2026-03-10", vendedorId: "v1", honorario: 1000.1, comprobantes: { con: 0, de: 1 }, proximoRetiro: "2026-12-20" }),
    c({ id: "c", cerradoEl: "2025-12-31", proximoRetiro: null, deposito: null, servicio: "Pensión" }),
  ];
  it("cuenta del mes, del año, total, honorario sin errores de redondeo y faltantes de comprobante", () => {
    expect(resumenCerrados(filas, HOY)).toEqual({ delMes: 1, delAnio: 2, total: 3, honorario: 19300.46, sinComprobante: 1 });
  });
  it("sin dinero visible (vendedor) el honorario es null", () => {
    expect(resumenCerrados([c({ honorario: null })], HOY).honorario).toBeNull();
  });
  it("filtra por mes, por vendedor y por próximo retiro en los siguientes N días", () => {
    expect(filtrarCerrados(filas, { mes: "2026-03" }, HOY).map((x) => x.id)).toEqual(["b"]);
    expect(filtrarCerrados(filas, { vendedor: "v1" }, HOY).map((x) => x.id)).toEqual(["b"]);
    expect(filtrarCerrados(filas, { vendedor: "sin" }, HOY).map((x) => x.id)).toEqual(["a", "c"]);
    expect(filtrarCerrados(filas, { proximos: 90 }, HOY).map((x) => x.id)).toEqual(["b"]);
  });
});

describe("embudo del mes", () => {
  it("cuenta lo que pasó en el mes aunque el caso se haya dado de alta antes; cada caso una vez", () => {
    const e = embudoDelMes(9, [
      { casoId: "rp1", etapa: "CERRADO" }, { casoId: "rp1", etapa: "PAGADO" },
      { casoId: "rp5", etapa: "PRECALIFICADO" }, { casoId: "rp6", etapa: "EXPEDIENTE" },
    ], [{ casoId: "rp1", neto: 35193 }, { casoId: "rp7", neto: 0.1 }, { casoId: "rp7", neto: 0.2 }]);
    expect(e).toEqual({ altas: 9, precalificados: 2, contratos: 1, pagados: 2, retirado: 35193.3 });
  });
  it("un caso que saltó a cerrado por el dinero no cuenta como precalificado ni contrato", () => {
    expect(embudoDelMes(0, [{ casoId: "rp1", etapa: "CERRADO" }], [])).toMatchObject({ precalificados: 0, contratos: 0, pagados: 1 });
  });
  it("sin movimientos todo en cero", () => {
    expect(embudoDelMes(0, [], [])).toEqual({ altas: 0, precalificados: 0, contratos: 0, pagados: 0, retirado: 0 });
  });
});
