// Casos de prueba de la sección 14.1 (T1 a T11, T13), con los parámetros de la sección 14.
import { describe, expect, it } from "vitest";
import {
  calcularModalidades, desglosarHonorario, impactoEnPension, incrementosLey73, minimoLey97, precalificar,
  type EntradaPrecalificacion, type ParametrosRetiro,
} from "../retiro";

const P: ParametrosRetiro = {
  UMA_MENSUAL: 3566.22, MODALIDAD_A_ANIOS: 3, MODALIDAD_A_BIMESTRES: 12, MODALIDAD_A_DIAS_SBC: 30, MODALIDAD_A_TOPE_UMAS: 10,
  MODALIDAD_B_ANIOS: 5, MODALIDAD_B_DIAS_SBC: 90, MODALIDAD_B_PCT_RCV: 0.115, UMBRAL_DIFERENCIA_MODALIDAD: 0.2,
  HONORARIO_RETIRO_PCT: 0.3, IVA: 0.16, L97_SEMANAS_2021: 750, L97_INCREMENTO_ANUAL: 25, L97_SEMANAS_TOPE: 1000,
  L73_SEMANAS_MINIMAS: 500, L73_SEMANAS_CRITICAS: 550, DIAS_ESPERA_DESEMPLEO: 46, ANIOS_CANDADO_RETIRO: 5,
};
const HOY = "2026-10-27";
const m = (x: Partial<Parameters<typeof calcularModalidades>[0]>) =>
  calcularModalidades({ sbcUltimo: null, sbcPromedio250: null, saldoRcv: 0, bimestres: 0, antiguedadAnios: 0, semanasTotales: 0, ...x }, P);

describe("7.2 / 7.3 montos y semanas", () => {
  it("T1: solo A, $15,000, pierde 60.0 semanas, 15% del saldo, honorario desglosado", () => {
    const r = m({ antiguedadAnios: 4, bimestres: 20, sbcUltimo: 500, saldoRcv: 100000, semanasTotales: 400 });
    expect(r.elegible).toBe("A");
    expect(r.opciones[0]).toMatchObject({ monto: 15000, semanasPerdidas: 60, semanasDespues: 340, pctSaldo: 15, honorario: 4500, subtotal: 3879.31, iva: 620.69 });
  });
  it("T2: A topada en 10 UMA = $35,662.20, pierde 71.3 semanas", () => {
    const r = m({ antiguedadAnios: 4, bimestres: 30, sbcUltimo: 2000, saldoRcv: 300000, semanasTotales: 600 });
    expect(r.opciones[0]).toMatchObject({ monto: 35662.2, semanasPerdidas: 71.3 });
  });
  it("T3: A $12,600 (105.0) y B $6,900 (57.5); por defecto A", () => {
    const r = m({ antiguedadAnios: 10, bimestres: 60, sbcUltimo: 420, sbcPromedio250: 400, saldoRcv: 60000, semanasTotales: 500 });
    expect(r.elegible).toBe("AB");
    expect(r.opciones.map((o) => [o.modalidad, o.monto, o.semanasPerdidas])).toEqual([["A", 12600, 105], ["B", 6900, 57.5]]);
    expect(r.porDefecto).toBe("A");
    expect(r.cuestaMenos).toBeNull(); // la diferencia de monto (45%) supera el 20%
  });
  it("T4: A $9,000 (18.0) y B = min($27,000, $57,500) = $27,000 (54.0); por defecto B", () => {
    const r = m({ antiguedadAnios: 10, bimestres: 60, sbcUltimo: 300, sbcPromedio250: 300, saldoRcv: 500000, semanasTotales: 1000 });
    expect(r.opciones.find((o) => o.modalidad === "B")).toMatchObject({ monto: 27000, semanasPerdidas: 54, detalle: { dias_sbc: 27000, pct_saldo: 57500 } });
    expect(r.opciones.find((o) => o.modalidad === "A")).toMatchObject({ monto: 9000, semanasPerdidas: 18 });
    expect(r.porDefecto).toBe("B");
  });
  it("con montos parecidos se resalta la que cuesta menos semanas", () => {
    // A = 30 × 900 = 27,000 y B = 90 × 280 = 25,200: difieren 6.7%, menos que el umbral de 20%.
    const parecidas = m({ antiguedadAnios: 10, bimestres: 60, sbcUltimo: 900, sbcPromedio250: 280, saldoRcv: 500000, semanasTotales: 1000 });
    expect(parecidas.opciones.map((o) => o.monto)).toEqual([27000, 25200]);
    expect(parecidas.porDefecto).toBe("A");
    expect(parecidas.cuestaMenos).toBe("B");
  });
  it("ningún monto supera el saldo (7.2.4)", () => {
    expect(m({ antiguedadAnios: 4, bimestres: 20, sbcUltimo: 1000, saldoRcv: 5000, semanasTotales: 100 }).opciones[0].monto).toBe(5000);
  });
});

describe("2.2 / T11 / T13 honorario", () => {
  it("T11: depósito $10,000 → honorario $3,000 = $2,586.21 + IVA $413.79", () => {
    expect(desglosarHonorario(10000, P)).toEqual({ honorario: 3000, subtotal: 2586.21, iva: 413.79 });
  });
  it("7.7: $8,849.84 → honorario $2,654.95", () => {
    expect(desglosarHonorario(8849.84, P).honorario).toBe(2654.95);
  });
});

describe("7.4 impacto en la pensión", () => {
  it("mínimo Ley 97: 875 en 2026, 925 en 2028, tope 1,000", () => {
    expect([minimoLey97(2026, P), minimoLey97(2028, P), minimoLey97(2035, P)]).toEqual([875, 925, 1000]);
  });
  it("T8: Ley 97, 58 años, 950 semanas, pierde 40 → 910 < 925 → crítica", () => {
    const r = impactoEnPension({ regimen: "L97", fechaNacimiento: "1968-05-10", hoy: HOY, semanasAntes: 950, semanasDespues: 910, fechaBaja: null }, P);
    expect(r).toMatchObject({ severidad: "critica", minimoL97: 925 });
  });
  it("T9: Ley 73, 900 semanas, pierde 30 → de 8 a 7 incrementos → aviso", () => {
    expect([incrementosLey73(900, 500), incrementosLey73(870, 500)]).toEqual([8, 7]);
    const r = impactoEnPension({ regimen: "L73", fechaNacimiento: null, hoy: HOY, semanasAntes: 900, semanasDespues: 870, fechaBaja: null }, P);
    expect(r.severidad).toBe("aviso");
    expect(r.mensajes[0]).toMatch(/Pierde 1 incremento/);
  });
  it("Ley 73 debajo de 550 semanas es crítica", () => {
    expect(impactoEnPension({ regimen: "L73", fechaNacimiento: null, hoy: HOY, semanasAntes: 560, semanasDespues: 540, fechaBaja: null }, P).severidad).toBe("critica");
  });
});

// Un caso "todo cumple" sobre el que se varía una cosa a la vez.
const apto: EntradaPrecalificacion = {
  hoy: HOY, regimen: "L97", fechaNacimiento: "1990-01-01", fechaBaja: "2026-08-01", cotizaActualmente: false,
  fechaAperturaCuenta: "2018-01-01", estadoUltimoRetiro: "nunca_retiro", fechaUltimoRetiro: null, ideVigente: true,
  tipoCuenta: "registrada", saldoVoluntarias: 0,
  sbcUltimo: 500, sbcPromedio250: null, saldoRcv: 100000, bimestres: 20, antiguedadAnios: 8, semanasTotales: 400,
};

describe("7.5 los 6 resultados", () => {
  it("APTO con el texto para el cliente (7.7)", () => {
    const r = precalificar({ ...apto, sbcPromedio250: null, antiguedadAnios: 4 }, P);
    expect(r.resultado).toBe("APTO");
    expect(r.explicacion).toMatch(/Puedes retirar hasta \$15,000\.00 \(estimado\)/);
    expect(r.explicacion).toMatch(/se descuentan 60 semanas de las 400/);
  });
  it("T7: último retiro 2022-03-15 → NO_TODAVIA hasta 2027-03-15", () => {
    const r = precalificar({ ...apto, estadoUltimoRetiro: "con_retiro", fechaUltimoRetiro: "2022-03-15" }, P);
    expect(r).toMatchObject({ resultado: "NO_TODAVIA", fechaElegibilidad: "2027-03-15" });
  });
  it("NO_TODAVIA toma la fecha más lejana entre día 46 y candado", () => {
    const r = precalificar({ ...apto, fechaBaja: "2026-10-01", estadoUltimoRetiro: "con_retiro", fechaUltimoRetiro: "2021-11-01" }, P);
    expect(r).toMatchObject({ resultado: "NO_TODAVIA", fechaElegibilidad: "2026-11-16" });
  });
  it("cotiza actualmente → NO_TODAVIA sin fecha", () => {
    expect(precalificar({ ...apto, cotizaActualmente: true }, P)).toMatchObject({ resultado: "NO_TODAVIA", fechaElegibilidad: null });
  });
  it("cuenta con menos de 3 años → NO_TODAVIA con la fecha en que cumple 3 (decisión 27-oct)", () => {
    const r = precalificar({ ...apto, fechaAperturaCuenta: "2024-05-01", antiguedadAnios: 2 }, P);
    expect(r).toMatchObject({ resultado: "NO_TODAVIA", fechaElegibilidad: "2027-05-01" });
  });
  it("T10: todo cumple pero el último retiro está por verificar → APTO_BLOQUEADO con tarea", () => {
    const r = precalificar({ ...apto, estadoUltimoRetiro: "por_verificar" }, P);
    expect(r.resultado).toBe("APTO_BLOQUEADO");
    expect(r.tareas).toContain("Verificar el último retiro en el estado de cuenta Afore.");
  });
  it("IDE vencido o cuenta asignada también bloquean", () => {
    expect(precalificar({ ...apto, ideVigente: false }, P).resultado).toBe("APTO_BLOQUEADO");
    expect(precalificar({ ...apto, tipoCuenta: "asignada" }, P).resultado).toBe("APTO_BLOQUEADO");
  });
  it("T8 completo: Ley 97 con 58 años y 950 semanas → CALIFICA_NO_CONVIENE, sugiere pensión", () => {
    // SBC y saldo elegidos para perder exactamente 40 semanas: 30×500 = 15,000; 15,000 × 950 / 356,250 = 40.
    const r = precalificar({ ...apto, fechaNacimiento: "1968-05-10", semanasTotales: 950, saldoRcv: 356250 }, P);
    expect(r.elegida).toMatchObject({ semanasPerdidas: 40, semanasDespues: 910 });
    expect(r).toMatchObject({ resultado: "CALIFICA_NO_CONVIENE", servicioSugerido: "PENSION_L97" });
  });
  it("Ley 73 con 55+ y sin modalidad → NO_ELEGIBLE_DESVIO a pensión", () => {
    const r = precalificar({ ...apto, regimen: "L73", fechaNacimiento: "1968-01-01", fechaAperturaCuenta: "2025-01-01", antiguedadAnios: 1 }, P);
    expect(r).toMatchObject({ resultado: "NO_ELEGIBLE_DESVIO", servicioSugerido: "PENSION_L73" });
  });
  it("constancia y estado de cuenta en ceros → NO_ELEGIBLE_DEFINITIVO", () => {
    expect(precalificar({ ...apto, semanasTotales: 0, saldoRcv: 0 }, P).resultado).toBe("NO_ELEGIBLE_DEFINITIVO");
  });
  it("el asesor puede elegir A aunque califique a B (7.2.3)", () => {
    const r = precalificar({ ...apto, sbcPromedio250: 300, saldoRcv: 500000, semanasTotales: 1000, modalidadElegida: "A" }, P);
    expect(r.elegida?.modalidad).toBe("A");
  });
});
