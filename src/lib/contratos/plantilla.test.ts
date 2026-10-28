import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { enteroEnLetra, pesosEnLetra, porcentajeEnLetra } from "./letras";
import { BLANCO, bloques, llenar, negritas } from "./plantilla";

describe("números en letra", () => {
  it("como en los contratos vigentes", () => {
    expect(pesosEnLetra(10000)).toBe("$10,000.00 (diez mil pesos 00/100 M.N.)");
    expect(porcentajeEnLetra(0.26)).toBe("26% (veintiséis por ciento)");
    expect(porcentajeEnLetra(0.4)).toBe("40% (cuarenta por ciento)");
  });
  it("casos difíciles", () => {
    expect(enteroEnLetra(21, true)).toBe("veintiún");
    expect(pesosEnLetra(21000)).toBe("$21,000.00 (veintiún mil pesos 00/100 M.N.)");
    expect(pesosEnLetra(1)).toBe("$1.00 (un peso 00/100 M.N.)");
    expect(pesosEnLetra(1000000)).toBe("$1,000,000.00 (un millón de pesos 00/100 M.N.)");
    expect(pesosEnLetra(2654.95)).toBe("$2,654.95 (dos mil seiscientos cincuenta y cuatro pesos 95/100 M.N.)");
    expect(pesosEnLetra(100)).toBe("$100.00 (cien pesos 00/100 M.N.)");
    expect(pesosEnLetra(101)).toBe("$101.00 (ciento un pesos 00/100 M.N.)");
    expect(porcentajeEnLetra(0.125)).toBe("12.5% (doce punto cincuenta por ciento)");
  });
});

describe("llenado de plantillas", () => {
  const datos = { folio: "RP-27", cliente: { nombre: "Ana Pérez", curp: "" }, beneficiaria: null, lista: ["uno", "dos"] };
  it("variables, faltantes como línea para llenar, condicionales y listas", () => {
    const r = llenar("No. {{folio}} · {{cliente.nombre}} · {{cliente.curp}}{{#si beneficiaria}} con B{{/si}}{{#no beneficiaria}} sin B{{/no}}\n{{#cada lista}}{{letra}}) {{.}}\n{{/cada}}", datos);
    expect(r.texto).toBe(`No. RP-27 · Ana Pérez · ${BLANCO} sin B\na) uno\nb) dos\n`);
    expect(r.faltantes).toEqual(["cliente.curp"]);
  });
  it("bloques: encabezados, incisos multirrenglón, apartados, casillas y firmas", () => {
    const b = bloques("# TÍTULO\n## Contrato No. 1\n\nPárrafo que\nsigue.\n### CLÁUSULAS\nI. Declara:\n  a) Inciso que\n     continúa.\n  b) Otro\n#### PRIMERA. Objeto\n☐ INE\n[[firmas]]");
    expect(b.map((x) => x.tipo)).toEqual(["titulo", "subtitulo", "parrafo", "seccion", "apartado", "inciso", "inciso", "clausula", "casilla", "firmas"]);
    expect(b[5]).toEqual({ tipo: "inciso", etiqueta: "a)", texto: "Inciso que continúa." });
    expect(b[2]).toEqual({ tipo: "parrafo", texto: "Párrafo que sigue." });
  });
  it("negritas", () => {
    expect(negritas("El **26%** del monto")).toEqual([{ texto: "El ", negrita: false }, { texto: "26%", negrita: true }, { texto: " del monto", negrita: false }]);
  });
});

describe("plantillas vigentes (prisma/plantillas)", () => {
  const leer = (f: string) => fs.readFileSync(`${__dirname}/../../../prisma/plantillas/${f}`, "utf8");
  const datos = {
    folio: "RP-1", ciudad: "Cuernavaca, Morelos", fecha_firma: "7 de octubre de 2026", vigencia_dias: "180",
    prestador: { nombre: "P", nombre_comercial: "RPD", rfc: "R", regimen: "RESICO", domicilio: "D", banco: "B", cuenta: "1", clabe: "2" },
    cliente: { nombre: "C", curp: "X", nss: "1", domicilio: "D", email: "e@x.mx", identificacion: "INE", parentesco: "hija" },
    honorario: { pct: "26% (veintiséis por ciento)" }, precio: { pago_unico: "$1.00", pct_recuperado: "40%" },
    beneficiaria: { nombre: "B", relacion: "madre", curp: "Y", domicilio: "D", identificacion: "INE" },
    finado: { nombre: "F", curp: "Z", nss: "2", fecha_defuncion: "1 de enero de 2025", regimen: "Ley 1973", afore: "A" },
    advertencias: ["Primera advertencia.", "Segunda advertencia."], regularizacion: "el acta",
  };
  for (const f of ["contrato-retiro.md", "contrato-fallecimiento.md", "aviso-fallecimiento.md"]) {
    it(`${f}: con todos los datos no falta nada y los incisos no se cortan`, () => {
      const r = llenar(leer(f), datos);
      expect(r.faltantes).toEqual([]);
      const b = bloques(r.texto);
      expect(b.filter((x) => x.tipo === "firmas")).toHaveLength(1);
      // Un inciso que empieza con "y …" o con minúscula es la continuación de un renglón anterior.
      expect(b.filter((x) => x.tipo === "inciso" && /^(y |[a-z])/.test(x.texto)).map((x) => x.tipo === "inciso" && x.texto)).toEqual([]);
    });
  }
});

describe("plantillas iniciales", () => {
  it("el módulo generado coincide con prisma/plantillas (corre node scripts/plantillas-ts.cjs si falla)", async () => {
      const { PLANTILLAS_INICIALES } = await import("./plantillas-iniciales");
    for (const p of PLANTILLAS_INICIALES) {
      expect(p.cuerpo).toBe(fs.readFileSync(`${__dirname}/../../../prisma/plantillas/${p.archivo}`, "utf8"));
    }
  });
});
