import { describe, expect, it } from "vitest";
import { eventosDelCaso, eventosEntre, generarIcs, type CasoCalendario } from "../calendario";

const P = {
  DIAS_ESPERA_DESEMPLEO: 46, ANIOS_CANDADO_RETIRO: 5,
  M40_ANIOS_DERECHO: 5, M40_SEMANAS_REQUERIDAS: 52, M40_MESES_BAJA: 2, M40_MESES_REINGRESO: 12, M40_DIA_LIMITE: 17, M40_PAGO_ADELANTADO: true,
  VENTANA_SIN_EXAMEN_MESES: 12, CONSERVACION_FRACCION: 0.25, CONSERVACION_MIN_MESES: 12, AVISO_M40_PAGO_DIAS: 5, AVISO_M40_PLAZO_DIAS: 60,
  AVISO_VENTANA_DIAS: 30, AVISO_EDAD_MESES: 6, AVISO_CONSERVACION_DIAS: 90, INFONAVIT_EDAD_AVISO: 69, INFONAVIT_EDAD_LIMITE: 70,
};
const HOY = "2026-10-27";
const base: CasoCalendario = {
  id: "c1", folio: "RP-0001", nombre: "Ana", etapa: "EXPEDIENTE", servicio: "RETIRO_DESEMPLEO",
  fechaBaja: "2026-10-01", estadoUltimoRetiro: "con_retiro", fechaUltimoRetiro: "2022-03-15",
  fechaLimiteIngreso: "2026-12-02", fechaIngresoSolicitud: null, fechaLimiteResolucion: null, fechaResolucion: null,
  fechaVencimientoContrato: "2027-04-01", fechaNacimiento: "1990-01-01", regimen: "L97", semanasCotizadas: 400, pagosM40: [],
};

describe("eventos del calendario (10.5)", () => {
  it("retiro: día 46 (T5), candado, límite de 15 días hábiles (T6) y vencimiento de contrato", () => {
    expect(eventosDelCaso(base, HOY, P).map((e) => [e.tipo, e.fecha])).toEqual([
      ["DIA46", "2026-11-16"], ["CANDADO", "2027-03-15"], ["SLA_LIMITE", "2026-12-02"], ["CONTRATO_VENCE", "2027-04-01"],
    ]);
  });
  it("lo cumplido ya no aparece: ingresada sin límite de SLA; casos cerrados sin eventos", () => {
    expect(eventosDelCaso({ ...base, etapa: "INGRESADA", fechaIngresoSolicitud: "2026-11-20" }, HOY, P).map((e) => e.tipo)).toEqual(["CONTRATO_VENCE"]);
    expect(eventosDelCaso({ ...base, etapa: "PERDIDO" }, HOY, P)).toEqual([]);
  });
  it("pensión: pagos M40 pendientes, 60/65 años, conservación (Ley 73)", () => {
    const c = { ...base, servicio: "MODALIDAD_40", etapa: "ESTRATEGIA_EN_EJECUCION", regimen: "L73", fechaBaja: "2022-11-30", semanasCotizadas: 900,
      fechaNacimiento: "1967-03-01", fechaLimiteIngreso: null, fechaVencimientoContrato: null,
      pagosM40: [{ mes: "2026-10-01", fechaLimite: "2026-10-17", pagado: true }, { mes: "2026-11-01", fechaLimite: "2026-11-17", pagado: false }] };
    expect(eventosDelCaso(c, HOY, P).map((e) => e.tipo)).toEqual(["PAGO_M40", "CONSERVACION", "CUMPLE_60", "CUMPLE_65"]);
  });
  it("rango y orden", () => {
    expect(eventosEntre([base], "2026-11-01", "2026-12-31", HOY, P).map((e) => e.tipo)).toEqual(["DIA46", "SLA_LIMITE"]);
  });
  it("el título lleva folio y primer nombre, nada sensible", () => {
    expect(eventosDelCaso(base, HOY, P)[0].titulo).toBe("Día 46: ya puede retirar · RP-0001 Ana");
  });
});

describe(".ics", () => {
  const ics = generarIcs(eventosDelCaso(base, HOY, P).slice(0, 1), "RPD · Irving", "20261027T120000Z", "https://rpd-control.vercel.app");
  it("evento de día completo con UID estable y fin exclusivo", () => {
    expect(ics).toContain("UID:DIA46-c1-20261116@rpd-control");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261116\r\nDTEND;VALUE=DATE:20261117");
    expect(ics).toContain("URL:https://rpd-control.vercel.app/casos/c1");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("escapa comas y punto y coma, y dobla renglones largos a 75 octetos", () => {
    const largo = generarIcs([{ fecha: "2026-11-16", tipo: "DIA46", casoId: "c", folio: "RP-1", nombre: "x", titulo: `Ana, López; ${"á".repeat(60)}` }], "x", "20261027T120000Z", "u");
    expect(largo).toContain("SUMMARY:Ana\\, López\; ");
    for (const l of largo.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });
});
