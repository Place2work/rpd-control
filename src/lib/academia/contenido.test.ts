// El contenido de la Academia es coherente y el módulo generado está al día con content/academia/.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { ACUSES, EVALUACION, MODULOS, PREGUNTAS, RUTAS } = await import("./contenido");
const base = path.join(__dirname, "../../../content/academia");

describe("contenido de la Academia", () => {
  it("el módulo generado coincide con content/academia (corre npm run academia:contenido si falla)", async () => {
    expect(RUTAS).toEqual(JSON.parse(fs.readFileSync(path.join(base, "rutas.json"), "utf8")));
    expect(ACUSES).toEqual(JSON.parse(fs.readFileSync(path.join(base, "acuses.json"), "utf8")));
    expect(EVALUACION).toEqual(JSON.parse(fs.readFileSync(path.join(base, "evaluacion.json"), "utf8")));
    for (const m of MODULOS) {
      expect(fs.readFileSync(path.join(base, m.ruta, `${m.clave}.md`), "utf8")).toContain(m.contenido.trim());
    }
    const enDisco = RUTAS.flatMap((r) => JSON.parse(fs.readFileSync(path.join(base, "preguntas", `${r.clave}.json`), "utf8")));
    expect(PREGUNTAS).toEqual(enDisco);
    const { MICROLECCIONES } = await import("./contenido");
    expect(MICROLECCIONES).toEqual(JSON.parse(fs.readFileSync(path.join(base, "microlecciones.json"), "utf8")));
  });
  it("las 5 rutas con sus módulos (sección 5) y requisitos de la sección 3.2", () => {
    expect(RUTAS.map((r) => r.clave)).toEqual(["N0", "R1", "R2", "P1", "P2"]);
    const cuenta = (r: string) => MODULOS.filter((m) => m.ruta === r).length;
    expect([cuenta("N0"), cuenta("R1"), cuenta("R2"), cuenta("P1"), cuenta("P2")]).toEqual([4, 7, 2, 6, 2]);
    expect(RUTAS.map((r) => r.requisitos.examen.minimo)).toEqual([0.8, 0.8, 0.85, 0.85, 0.9]);
  });
  it("cada pregunta tiene módulo existente, respuesta válida y versión", () => {
    const claves = new Set(MODULOS.map((m) => m.clave));
    for (const p of PREGUNTAS) {
      expect(claves.has(p.modulo), p.clave).toBe(true);
      expect(p.modulo.slice(0, 2), p.clave).toBe(p.clave.slice(0, 2));
      if (p.tipo === "opcion_multiple") expect(p.opciones[p.correcta], p.clave).toBeTruthy();
      else expect(p.tolerancia, p.clave).not.toBeNull();
      expect(p.version).toBeGreaterThan(0);
    }
    expect(new Set(PREGUNTAS.map((p) => p.clave)).size).toBe(PREGUNTAS.length);
  });
  it("todas las rutas tienen preguntas críticas y ninguna lección menciona documentos que ya no se piden como obligatorios", () => {
    for (const r of RUTAS) expect(PREGUNTAS.some((p) => p.clave.startsWith(r.clave) && p.critica), r.clave).toBe(true);
    const r106 = MODULOS.find((m) => m.clave === "R1-06")!.contenido;
    expect(r106).not.toMatch(/\| Certificación de baja del IMSS \|/);
    expect(r106).not.toMatch(/\| Comprobante de registro en la Afore \|/);
    expect(MODULOS.map((m) => m.contenido).join(" ")).not.toMatch(/\bvendedor/i);
  });
  it("las numéricas del retiro coinciden con el ejemplo de la lección (C-R01)", () => {
    expect(PREGUNTAS.find((p) => p.clave === "R1-Q04")).toMatchObject({ tipo: "numerica", correcta: 15000 });
    expect(PREGUNTAS.find((p) => p.clave === "R1-Q05")).toMatchObject({ tipo: "numerica", correcta: 60, tolerancia: 0.1 });
  });
});

describe("permisos por ruta (3.2)", () => {
  it("la tabla cap_permisos_ruta de la migración coincide con rutas.json (cada ruta incluye los de sus prerrequisitos)", () => {
    const sql = fs.readFileSync(path.join(__dirname, "../../../prisma/migrations/20261113003600_academia_permisos/migration.sql"), "utf8");
    const enSql = [...sql.matchAll(/\('(N0|R1|R2|P1|P2)', '([a-z0-9_.A-Z]+)'\)/g)].map((m) => `${m[1]}:${m[2]}`).sort();
    const heredados = (c: string): string[] => { const r = RUTAS.find((x) => x.clave === c)!; return [...r.permisos_habilita, ...r.prerrequisitos.flatMap(heredados)]; };
    const esperado = RUTAS.flatMap((r) => [...new Set(heredados(r.clave))].map((p) => `${r.clave}:${p}`)).sort();
    expect(enSql).toEqual(esperado);
  });
  it("cada ruta que pide casos tiene suficientes casos en el simulador", async () => {
    const { CASOS } = await import("./contenido");
    for (const r of RUTAS) if (r.requisitos.casos) expect(CASOS.filter((c) => c.ruta === r.clave).length, r.clave).toBeGreaterThanOrEqual(r.requisitos.casos);
  });
});

describe("microlecciones (9.5)", () => {
  it("cada plantilla usa parámetros que existen en la semilla y enlaza lecciones existentes", async () => {
    const { MICROLECCIONES } = await import("./contenido");
    const semilla = fs.readFileSync(path.join(__dirname, "../../../prisma/seed.ts"), "utf8");
    const claves = new Set(MODULOS.map((m) => m.clave));
    for (const m of MICROLECCIONES) {
      for (const k of new Set([...JSON.stringify(m).matchAll(/[PA]:([A-Z0-9_]+)/g)].map((x) => x[1]))) expect(semilla, `${m.clave}: ${k}`).toContain(`clave: "${k}"`);
      for (const mod of m.modulos) expect(claves.has(mod), `${m.clave}: ${mod}`).toBe(true);
    }
  });
});
