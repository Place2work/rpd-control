import { describe, expect, it } from "vitest";
import type { ReglaIntentos, Ruta } from "@/lib/academia/tipos";
import { calificar, estadoRuta, esCorrecta, puedeIntentar, seleccionarPreguntas, venceEl } from "./capacitacion";

const q = (clave: string, critica = false, correcta = 1) => ({ clave, critica, tipo: "opcion_multiple" as const, correcta, tolerancia: null });

describe("calificación (9.1)", () => {
  const preguntas = [q("A", true), q("B"), q("C"), q("D"), q("E")];
  it("aprueba con el mínimo y todas las críticas bien", () => {
    const r = calificar(preguntas, { A: 1, B: 1, C: 1, D: 1, E: 0 }, 0.8);
    expect(r).toMatchObject({ aciertos: 4, total: 5, calificacion: 0.8, criticasOk: true, aprobado: true });
  });
  it("una crítica fallada reprueba aunque el total pase del mínimo (14.1)", () => {
    const r = calificar([...preguntas, q("F"), q("G"), q("H"), q("I"), q("J")], { A: 0, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, H: 1, I: 1, J: 1 }, 0.8);
    expect(r).toMatchObject({ calificacion: 0.9, criticasOk: false, criticasFalladas: ["A"], aprobado: false });
  });
  it("debajo del mínimo reprueba; sin respuesta cuenta como error", () => {
    expect(calificar(preguntas, { A: 1, B: 1, C: 1 }, 0.8)).toMatchObject({ aciertos: 3, aprobado: false });
  });
  it("las numéricas aceptan la tolerancia", () => {
    const num = { tipo: "numerica" as const, correcta: 60, tolerancia: 0.1 };
    expect(esCorrecta(num, 60.05)).toBe(true);
    expect(esCorrecta(num, 60.2)).toBe(false);
    expect(esCorrecta({ tipo: "numerica", correcta: 15000, tolerancia: 0 }, 15000)).toBe(true);
    expect(esCorrecta(num, null)).toBe(false);
  });
});

describe("selección de preguntas", () => {
  const banco = Array.from({ length: 30 }, (_, i) => ({ clave: `Q${String(i).padStart(2, "0")}`, critica: i < 5 }));
  it("el examen de ruta incluye todas las críticas y llega a n", () => {
    const s = seleccionarPreguntas(banco, 25, true, "intento-1");
    expect(s).toHaveLength(25);
    expect(s.filter((p) => p.critica)).toHaveLength(5);
  });
  it("es reproducible con la semilla y cambia con otra", () => {
    expect(seleccionarPreguntas(banco, 10, false, "x").map((p) => p.clave)).toEqual(seleccionarPreguntas(banco, 10, false, "x").map((p) => p.clave));
    expect(seleccionarPreguntas(banco, 10, false, "x").map((p) => p.clave)).not.toEqual(seleccionarPreguntas(banco, 10, false, "y").map((p) => p.clave));
  });
  it("si el banco es chico, sirve todas", () => {
    expect(seleccionarPreguntas(banco.slice(0, 4), 25, true, "s")).toHaveLength(4);
  });
});

describe("intentos (9.3)", () => {
  const quiz: ReglaIntentos = { n: 10, minimo: 0.8, intentos_max: null, espera_horas: 1, bloqueo_dias: 0 };
  const examen: ReglaIntentos = { n: 25, intentos_max: 3, espera_horas: 0, bloqueo_dias: 7 };
  const fallo = (dia: string) => ({ inicio: `${dia}T10:00:00.000Z`, fin: `${dia}T10:20:00.000Z`, aprobado: false });
  it("quiz: ilimitados, pero una hora de espera después de reprobar", () => {
    expect(puedeIntentar([fallo("2026-11-12")], quiz, "2026-11-12T10:50:00.000Z")).toEqual({ ok: false, motivo: "espera", desde: "2026-11-12T11:20:00.000Z" });
    expect(puedeIntentar([fallo("2026-11-12")], quiz, "2026-11-12T11:21:00.000Z")).toEqual({ ok: true });
  });
  it("examen: tres fallidos bloquean 7 días; después hay tres intentos más", () => {
    const tres = [fallo("2026-11-10"), fallo("2026-11-11"), fallo("2026-11-12")];
    expect(puedeIntentar(tres.slice(0, 2), examen, "2026-11-12T00:00:00.000Z")).toEqual({ ok: true });
    expect(puedeIntentar(tres, examen, "2026-11-15T00:00:00.000Z")).toEqual({ ok: false, motivo: "bloqueo", desde: "2026-11-19T10:20:00.000Z" });
    expect(puedeIntentar(tres, examen, "2026-11-19T10:21:00.000Z")).toEqual({ ok: true });
    expect(puedeIntentar([...tres, fallo("2026-11-20")], examen, "2026-11-21T00:00:00.000Z")).toEqual({ ok: true });
  });
  it("un intento abierto (menos de 2 horas) impide abrir otro", () => {
    expect(puedeIntentar([{ inicio: "2026-11-12T10:00:00.000Z", fin: null, aprobado: null }], examen, "2026-11-12T10:30:00.000Z")).toEqual({ ok: false, motivo: "en_curso" });
    expect(puedeIntentar([{ inicio: "2026-11-12T10:00:00.000Z", fin: null, aprobado: null }], examen, "2026-11-12T13:00:00.000Z")).toEqual({ ok: true });
  });
});

describe("estado de una ruta (3.2, 9.4)", () => {
  const N0: Ruta = { clave: "N0", nombre: "Inducción", orden: 0, prerrequisitos: [], vigencia_meses: null, permisos_habilita: [],
    requisitos: { examen: { minimo: 0.8, n: 25 }, acuses: ["codigo_conducta", "privacidad_interna"] } };
  const R1: Ruta = { clave: "R1", nombre: "Retiro", orden: 1, prerrequisitos: ["N0"], vigencia_meses: 12, permisos_habilita: [],
    requisitos: { examen: { minimo: 0.8, n: 25 }, casos: 4, roleplays: ["RP-01", "RP-02"], shadowing: 3 } };
  const vacio = () => ({ leidos: new Set<string>(), examenesAprobados: new Set<"N0" | "R1">(), acuses: new Set<"codigo_conducta" | "privacidad_interna">(), certificadas: new Set<"N0" | "R1">() });
  const mods = ["N0-01", "N0-02", "N0-03", "N0-04"];
  it("N0: sin acuses ni lecturas no puede examinarse", () => {
    const e = estadoRuta(N0, mods, vacio());
    expect(e).toMatchObject({ disponible: true, puedeExamen: false, otorgable: false, avance: 0 });
    expect(e.pendientes.join(" ")).toMatch(/Código de conducta.*Leer 4 módulos.*examen/);
  });
  it("N0: con acuses y módulos leídos puede examinarse; con el examen aprobado se otorga", () => {
    const a = vacio(); mods.forEach((m) => a.leidos.add(m)); a.acuses.add("codigo_conducta"); a.acuses.add("privacidad_interna");
    expect(estadoRuta(N0, mods, a)).toMatchObject({ puedeExamen: true, otorgable: false, avance: 80 });
    a.examenesAprobados.add("N0");
    expect(estadoRuta(N0, mods, a)).toMatchObject({ puedeExamen: false, otorgable: true, avance: 100, pendientes: [] });
  });
  it("R1: bloqueada sin N0; con N0 se lee y se examina, pero la certificación espera la práctica", () => {
    const r1 = ["R1-01", "R1-02"];
    expect(estadoRuta(R1, r1, vacio())).toMatchObject({ disponible: false, bloqueo: expect.stringMatching(/N0/) });
    const a = vacio(); a.certificadas.add("N0"); a.examenesAprobados.add("N0"); r1.forEach((m) => a.leidos.add(m)); a.examenesAprobados.add("R1");
    const e = estadoRuta(R1, r1, a);
    expect(e).toMatchObject({ disponible: true, otorgable: false, pendientes: ["Resolver 4 casos prácticos en el simulador (0 de 4)"] });
    expect(e.proximamente).toEqual(["Juego de roles RP-01 y RP-02 con el Director", "3 casos acompañados"]);
  });
});

describe("vigencia", () => {
  it("12 meses, ajustando el fin de mes; N0 no vence", () => {
    expect(venceEl("2026-11-12", 12)).toBe("2027-11-12");
    expect(venceEl("2028-02-29", 12)).toBe("2029-02-28");
    expect(venceEl("2026-11-12", null)).toBeNull();
  });
});

describe("casos prácticos contra el motor (sección 7, 14.1)", () => {
  it("cada caso C-R tiene el resultado esperado que da el motor de la calculadora (montos al centavo, semanas a 0.1)", async () => {
    const fs = await import("node:fs");
    const { resultadoCasoRetiro } = await import("./capacitacion");
    const P = { UMA_MENSUAL: 3566.22, MODALIDAD_A_ANIOS: 3, MODALIDAD_A_BIMESTRES: 12, MODALIDAD_A_DIAS_SBC: 30, MODALIDAD_A_TOPE_UMAS: 10,
      MODALIDAD_B_ANIOS: 5, MODALIDAD_B_DIAS_SBC: 90, MODALIDAD_B_PCT_RCV: 0.115, UMBRAL_DIFERENCIA_MODALIDAD: 0.2, HONORARIO_RETIRO_PCT: 0.3, IVA: 0.16,
      L97_SEMANAS_2021: 750, L97_INCREMENTO_ANUAL: 25, L97_SEMANAS_TOPE: 1000, L73_SEMANAS_MINIMAS: 500, L73_SEMANAS_CRITICAS: 550, DIAS_ESPERA_DESEMPLEO: 46, ANIOS_CANDADO_RETIRO: 5 };
    const casos = JSON.parse(fs.readFileSync(`${__dirname}/../../../content/academia/casos.json`, "utf8"));
    const retiro = casos.filter((c: { tipo: string }) => c.tipo === "retiro");
    expect(retiro.map((c: { clave: string }) => c.clave).sort()).toEqual(["C-R01", "C-R02", "C-R03", "C-R04", "C-R05", "C-R06", "C-R07", "C-R08", "C-R09"]);
    for (const c of retiro) {
      const motor = resultadoCasoRetiro(c.datos, c.hoy, P);
      for (const [campo, valor] of Object.entries(c.esperado)) expect(motor[campo as keyof typeof motor], `${c.clave} · ${campo}`).toEqual(valor);
    }
  });
  it("compara con tolerancia de $1 y 0.1 semanas; el resultado y las fechas, exactos", async () => {
    const { compararCaso } = await import("./capacitacion");
    const motor = { resultado: "APTO", montoA: 15000, semanasA: 60, fechaElegibilidad: "2027-03-15" };
    expect(compararCaso(["resultado", "montoA", "semanasA"], { resultado: "apto", montoA: 15000.9, semanasA: 60.05 }, motor)).toEqual({ diferencias: [], aprobado: true });
    const r = compararCaso(["resultado", "montoA", "fechaElegibilidad"], { resultado: "APTO_BLOQUEADO", montoA: 15002, fechaElegibilidad: "2027-03-16" }, motor);
    expect(r.aprobado).toBe(false);
    expect(r.diferencias.map((d) => d.campo)).toEqual(["resultado", "montoA", "fechaElegibilidad"]);
  });
  it("los casos cuentan para la ruta: R1 pide 4", () => {
    const R1: Ruta = { clave: "R1", nombre: "Retiro", orden: 1, prerrequisitos: ["N0"], vigencia_meses: 12, permisos_habilita: [],
      requisitos: { examen: { minimo: 0.8, n: 25 }, casos: 4, roleplays: ["RP-01"], shadowing: 3 } };
    const a = { leidos: new Set(["R1-01"]), examenesAprobados: new Set<"N0" | "R1">(["N0", "R1"]), acuses: new Set<"codigo_conducta">(), certificadas: new Set<"N0">(["N0"]), casosAprobados: new Set(["C-R01", "C-R02"]) };
    const e = estadoRuta(R1, ["R1-01"], a, ["C-R01", "C-R02", "C-R03", "C-R04", "C-R08", "C-R09"]);
    expect(e.pendientes).toEqual(["Resolver 2 casos prácticos en el simulador (2 de 4)"]);
    a.casosAprobados.add("C-R03"); a.casosAprobados.add("C-R09");
    expect(estadoRuta(R1, ["R1-01"], a, ["C-R01", "C-R02", "C-R03", "C-R04", "C-R08", "C-R09"]).pendientes).toEqual([]);
  });
});
