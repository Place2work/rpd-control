import { describe, expect, it } from "vitest";
import { calcularDesempeno, sugerirRepaso, type CasoDesempeno, type Metrica } from "./desempeno";

const P = { horasContacto: 24, diasAlerta: 1 };
const METAS = { contacto_24h: 0.9, prospecto_precalificado: 0.5, apto_contrato: 0.6, expediente_primera: 0.8, bloqueados: 0.1, l73_analisis: 1, no_conviene_desvio: 0.3, alertas_a_tiempo: 0.9, linea_roja: 0 };
const AHORA = "2026-11-12T18:00:00Z";
const base: CasoDesempeno = { creado: "2026-11-01T16:00:00Z", primerContacto: "2026-11-01T18:00:00Z", precalificado: false, resultado: null, contrato: false,
  docsRecibidos: 0, docsRechazados: 0, bloqueado: false, ley73: false, analisisImpacto: false, desviado: false, referido: false };
const caso = (x: Partial<CasoDesempeno>) => ({ ...base, ...x });
const de = (ms: Metrica[], c: string) => ms.find((m) => m.clave === c)!;

describe("desempeño (CAPACITACION.md 10)", () => {
  it("primer contacto: dentro de 24 h cuenta; vencido sin contacto cuenta en contra; dentro del plazo sin contacto no cuenta", () => {
    const ms = calcularDesempeno([
      caso({}),
      caso({ primerContacto: "2026-11-03T16:00:01Z" }),
      caso({ primerContacto: null }),
      caso({ creado: "2026-11-12T10:00:00Z", primerContacto: null }),
    ], [], 0, METAS, P, AHORA);
    expect(de(ms, "contacto_24h")).toMatchObject({ numerador: 1, denominador: 3, cumple: false });
  });
  it("embudo: prospecto → precalificado y apto → contrato", () => {
    const ms = calcularDesempeno([
      caso({ precalificado: true, resultado: "APTO", contrato: true }),
      caso({ precalificado: true, resultado: "APTO" }),
      caso({ precalificado: true, resultado: "NO_TODAVIA" }),
      caso({}),
    ], [], 0, METAS, P, AHORA);
    expect(de(ms, "prospecto_precalificado")).toMatchObject({ valor: 0.75, cumple: true });
    expect(de(ms, "apto_contrato")).toMatchObject({ valor: 0.5, cumple: false });
  });
  it("expediente a la primera solo cuenta casos con documentos; bloqueados es un techo", () => {
    const ms = calcularDesempeno([
      caso({ docsRecibidos: 4 }), caso({ docsRecibidos: 3, docsRechazados: 1 }), caso({ bloqueado: true }), ...Array.from({ length: 7 }, () => caso({})),
    ], [], 0, METAS, P, AHORA);
    expect(de(ms, "expediente_primera")).toMatchObject({ numerador: 1, denominador: 2, cumple: false });
    expect(de(ms, "bloqueados")).toMatchObject({ valor: 0.1, cumple: true });
  });
  it("Ley 73 con contrato necesita análisis de impacto (100%); «califica, no conviene» → desvío", () => {
    const ms = calcularDesempeno([
      caso({ ley73: true, contrato: true, analisisImpacto: true }), caso({ ley73: true, contrato: true }), caso({ ley73: true }),
      caso({ resultado: "CALIFICA_NO_CONVIENE", desviado: true }), caso({ resultado: "CALIFICA_NO_CONVIENE" }),
    ], [], 0, METAS, P, AHORA);
    expect(de(ms, "l73_analisis")).toMatchObject({ numerador: 1, denominador: 2, cumple: false });
    expect(de(ms, "no_conviene_desvio")).toMatchObject({ valor: 0.5, cumple: true });
  });
  it("alertas: a tiempo si se atienden a más tardar al día siguiente (hora de la Ciudad de México)", () => {
    const ms = calcularDesempeno([], [
      { disparo: "2026-11-10", atendida: "2026-11-11T23:30:00-06:00" }, // 11 de nov en CDMX (12 en UTC): a tiempo
      { disparo: "2026-11-09", atendida: "2026-11-11T09:00:00-06:00" }, // tarde
      { disparo: "2026-11-08", atendida: null }, // vencida sin atender
      { disparo: "2026-11-12", atendida: null }, // todavía en plazo: no cuenta
    ], 0, METAS, P, AHORA);
    expect(de(ms, "alertas_a_tiempo")).toMatchObject({ numerador: 1, denominador: 3 });
  });
  it("línea roja: meta 0; referidos es seguimiento sin meta; sin datos no se califica", () => {
    const ms = calcularDesempeno([caso({ referido: true })], [], 1, METAS, P, AHORA);
    expect(de(ms, "linea_roja")).toMatchObject({ valor: 1, cumple: false });
    expect(de(ms, "referidos")).toMatchObject({ valor: 1, meta: null, cumple: null });
    expect(de(ms, "apto_contrato")).toMatchObject({ valor: null, cumple: null });
  });
  it("sugiere repaso solo si dos métricas fallan dos semanas seguidas", () => {
    const malo = calcularDesempeno([caso({ docsRecibidos: 2, docsRechazados: 1, bloqueado: true })], [], 0, METAS, P, AHORA);
    expect(sugerirRepaso(malo, malo)).toEqual({ metricas: ["prospecto_precalificado", "expediente_primera", "bloqueados"], modulos: ["R1-05", "R1-06"] });
    const bien = calcularDesempeno([caso({ precalificado: true })], [], 0, METAS, P, AHORA);
    expect(sugerirRepaso(malo, bien).modulos).toEqual([]);
  });
});
