import { describe, expect, it } from "vitest";
import { alertasAcademia, estadoVigencia, evaluar, listaDias, recordatorioHoy, rellenar, repasosPorGraves, resolverMicroleccion, venceAlRecertificar } from "./actualizaciones";
import microlecciones from "../../../content/academia/microlecciones.json";
import type { Microleccion } from "../academia/tipos";

const P = { UMA_MENSUAL: "3700.00", UMA_DIARIA: "121.71", MODALIDAD_A_TOPE_UMAS: "10", HONORARIO_RETIRO_PCT: "0.30", COSTO_ADMIN_ALTA: "600", DIAS_ESPERA_DESEMPLEO: "46", SLA_DIAS_HABILES: "10", AFORE_DIAS_HABILES: "5" };
const A = { UMA_MENSUAL: "3566.22", UMA_DIARIA: "117.31", MODALIDAD_A_TOPE_UMAS: "10", HONORARIO_RETIRO_PCT: "0.26", COSTO_ADMIN_ALTA: "500", DIAS_ESPERA_DESEMPLEO: "45", SLA_DIAS_HABILES: "15", AFORE_DIAS_HABILES: "5" };
const ML = microlecciones as Microleccion[];

describe("plantillas de microlección (9.5)", () => {
  it("evalúa expresiones con parámetros vigentes y anteriores, sin eval", () => {
    expect(evaluar("P:UMA_MENSUAL*P:MODALIDAD_A_TOPE_UMAS", P, A)).toBe(37000);
    expect(evaluar("(3000-P:COSTO_ADMIN_ALTA)*0.4", P, A)).toBe(960);
    expect(evaluar("(A:COSTO_ADMIN_ALTA-P:COSTO_ADMIN_ALTA)*0.4", P, A)).toBe(-40);
    expect(() => evaluar("P:NO_EXISTE*2", P, A)).toThrow(/NO_EXISTE/);
    expect(() => evaluar("process.exit()", P, A)).toThrow();
  });
  it("rellena fechas, pesos, porcentajes y sumas de días a una fecha", () => {
    expect(rellenar("{{desde}} · {{P:UMA_MENSUAL|pesos}} · {{P:HONORARIO_RETIRO_PCT|pct}} · {{fecha:2026-10-01+P:DIAS_ESPERA_DESEMPLEO}}", P, A, "2027-02-01"))
      .toBe("1 de febrero de 2027 · $3,700.00 · 30% · 16 de noviembre de 2026");
  });
  it("cada plantilla se resuelve con 5 preguntas válidas y la respuesta correcta sale de los valores nuevos", () => {
    for (const m of ML) {
      const r = resolverMicroleccion(m, P, A, "2027-02-01");
      expect(r.preguntas, m.clave).toHaveLength(5);
      expect(r.contenido, m.clave).not.toMatch(/\{\{/);
      for (const q of r.preguntas) if (q.tipo === "opcion_multiple") expect(q.opciones[q.correcta], q.clave).toBeTruthy();
    }
    const uma = resolverMicroleccion(ML.find((m) => m.clave === "UMA")!, P, A, "2027-02-01");
    expect(uma.preguntas.find((q) => q.clave === "UMA-Q2")).toMatchObject({ correcta: 37000 });
    expect(uma.preguntas.find((q) => q.clave === "UMA-Q5")!.opciones[0]).toBe("$37,000.00");
    const dias = resolverMicroleccion(ML.find((m) => m.clave === "DIAS_ESPERA")!, P, A, "2027-02-01");
    expect(dias.preguntas.find((q) => q.clave === "DIAS_ESPERA-Q2")!.opciones[0]).toBe("16 de noviembre de 2026");
  });
  it("descarta una pregunta cuyas opciones quedan repetidas (el valor no cambió)", () => {
    const r = resolverMicroleccion(ML.find((m) => m.clave === "HONORARIO")!, P, { ...A, HONORARIO_RETIRO_PCT: "0.30" }, "2027-02-01");
    expect(r.preguntas.map((q) => q.clave)).not.toContain("HONORARIO-Q2");
  });
  it("las plantillas cubren los parámetros de los que dependen las preguntas (salvo IVA y la base de reparto)", () => {
    const cubiertos = new Set(ML.flatMap((m) => m.parametros));
    for (const p of ["UMA_MENSUAL", "HONORARIO_RETIRO_PCT", "COSTO_ADMIN_ALTA", "DIAS_ESPERA_DESEMPLEO", "SLA_DIAS_HABILES", "AFORE_DIAS_HABILES"]) expect(cubiertos.has(p), p).toBe(true);
  });
});

describe("vigencia (9.5)", () => {
  it("por vencer 30 días antes, vencida al día siguiente del vencimiento; sin vencimiento siempre vigente", () => {
    expect(estadoVigencia("2027-11-30", "2027-10-30", 30)).toBe("vigente");
    expect(estadoVigencia("2027-11-30", "2027-10-31", 30)).toBe("por_vencer");
    expect(estadoVigencia("2027-11-30", "2027-11-30", 30)).toBe("por_vencer");
    expect(estadoVigencia("2027-11-30", "2027-12-01", 30)).toBe("vencida");
    expect(estadoVigencia(null, "2030-01-01", 30)).toBe("vigente");
  });
  it("al recertificar antes de vencer se suma desde el vencimiento; ya vencida, desde hoy", () => {
    expect(venceAlRecertificar("2027-11-30", "2027-11-10", 12)).toBe("2028-11-30");
    expect(venceAlRecertificar("2027-11-30", "2027-12-15", 12)).toBe("2028-12-15");
    expect(venceAlRecertificar(null, "2027-12-15", null)).toBeNull();
  });
  it("recordatorios a los 7, 21 y 28 días; el último es crítico", () => {
    const d = listaDias("7, 21,28");
    expect(d).toEqual([7, 21, 28]);
    expect(recordatorioHoy("2027-02-01", "2027-02-08", d)).toEqual({ dia: 7, critico: false });
    expect(recordatorioHoy("2027-02-01", "2027-03-01", d)).toEqual({ dia: 28, critico: true });
    expect(recordatorioHoy("2027-02-01", "2027-02-09", d)).toBeNull();
  });
});

describe("repasos por incidencias graves (9.5)", () => {
  const p = { ventanaDias: 90, umbral: 2, plazoDias: 14 };
  it("2 graves en 90 días obligan a repasar el módulo de cada tipo en 14 días; leves y viejas no cuentan", () => {
    expect(repasosPorGraves([{ tipo: "documento_rechazado", severidad: "grave", fecha: "2027-01-10" }, { tipo: "promesa_monto", severidad: "leve", fecha: "2027-01-20" }], "2027-02-01", p)).toEqual([]);
    expect(repasosPorGraves([{ tipo: "documento_rechazado", severidad: "grave", fecha: "2026-10-01" }, { tipo: "alerta_ignorada", severidad: "grave", fecha: "2027-01-20" }], "2027-02-01", p)).toEqual([]);
    expect(repasosPorGraves([{ tipo: "documento_rechazado", severidad: "grave", fecha: "2027-01-10" }, { tipo: "alerta_ignorada", severidad: "grave", fecha: "2027-01-20" }], "2027-02-01", p))
      .toEqual([{ modulo: "R1-06", limite: "2027-02-15" }, { modulo: "N0-04", limite: "2027-02-15" }]);
  });
});

describe("alertas de la Academia (12.3)", () => {
  const vacio = { certificaciones: [], rutasEnCurso: [], solicitudes: [], actualizacionesPendientes: [], preguntasRevisar: [], metricasBajas: [] };
  const plazos = { sinAvanceDias: 7, solicitudDias: 3, recordatorios: [7, 21, 28] };
  it("certificación por vencer y vencida avisan a la persona y al Director, una vez por certificación", () => {
    const r = alertasAcademia({ ...vacio, certificaciones: [
      { id: "c1", usuarioId: "u1", nombre: "Ana", ruta: "R1", estado: "por_vencer", venceAt: "2027-03-01" },
      { id: "c2", usuarioId: "u1", nombre: "Ana", ruta: "R2", estado: "vencida", venceAt: "2027-01-31" },
      { id: "c3", usuarioId: "u1", nombre: "Ana", ruta: "N0", estado: "vigente", venceAt: null },
    ] }, "2027-02-10", plazos);
    expect(r.map((a) => [a.regla, a.severidad, a.clave])).toEqual([["CAP_CERT_POR_VENCER", "aviso", "CAP_CERT_POR_VENCER:c1"], ["CAP_CERT_VENCIDA", "critica", "CAP_CERT_VENCIDA:c2"]]);
    expect(r[0].para).toEqual({ persona: "u1", directores: true });
  });
  it("sin avance 7 días, solicitud sin atender 3 días, recordatorio de microlección, preguntas en revisión y métricas bajas", () => {
    const r = alertasAcademia({
      certificaciones: [],
      rutasEnCurso: [{ usuarioId: "u1", nombre: "Ana", ruta: "R1", ultimaActividad: "2027-02-03" }, { usuarioId: "u2", nombre: "Beto", ruta: "R1", ultimaActividad: "2027-02-05" }],
      solicitudes: [{ id: "s1", usuarioId: "u1", nombre: "Ana", tipo: "roleplay", referencia: "RP-01", creada: "2027-02-07" }, { id: "s2", usuarioId: "u1", nombre: "Ana", tipo: "entrevista", referencia: "P2", creada: "2027-02-09" }],
      actualizacionesPendientes: [{ actualizacionId: "a1", titulo: "Nueva UMA", publicada: "2027-01-13", usuarioId: "u1" }],
      preguntasRevisar: [{ cambioId: "k1", parametro: "UMA_MENSUAL", n: 2 }],
      metricasBajas: [{ usuarioId: "u1", nombre: "Ana", modulos: ["R1-06"] }, { usuarioId: "u2", nombre: "Beto", modulos: [] }],
    }, "2027-02-10", plazos);
    expect(r.map((a) => a.regla)).toEqual(["CAP_SIN_AVANCE", "CAP_ROLEPLAY_POR_EVALUAR", "CAP_ACTUALIZACION_PENDIENTE", "CAP_PREGUNTAS_REVISAR", "CAP_METRICA_BAJA"]);
    expect(r.find((a) => a.regla === "CAP_ACTUALIZACION_PENDIENTE")).toMatchObject({ severidad: "critica", para: { persona: "u1", directores: false } });
    expect(r.find((a) => a.regla === "CAP_METRICA_BAJA")!.clave).toBe("CAP_METRICA_BAJA:u1:2027-S06");
  });
});
