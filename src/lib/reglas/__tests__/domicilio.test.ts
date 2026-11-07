import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { componerDomicilio, estadoPorCodigoPostal } from "../domicilio";

describe("domicilio por partes", () => {
  it("arma el texto del contrato con las partes que haya", () => {
    expect(componerDomicilio({ calle: "Santa Elena", numeroExterior: "202", numeroInterior: "402 C", colonia: "Marbella", codigoPostal: "76226", municipio: "Querétaro", estado: "Querétaro" }))
      .toBe("Santa Elena 202, Int. 402 C, Col. Marbella, C.P. 76226, Querétaro, Querétaro");
    expect(componerDomicilio({ calle: " Av.  Morelos ", municipio: "Cuernavaca", estado: "Morelos" })).toBe("Av. Morelos, Cuernavaca, Morelos");
  });
  it("no duplica «Col.» y sin partes regresa null", () => {
    expect(componerDomicilio({ colonia: "Col. Centro" })).toBe("Col. Centro");
    expect(componerDomicilio({ colonia: "Fraccionamiento Las Flores" })).toBe("Fraccionamiento Las Flores");
    expect(componerDomicilio({})).toBeNull();
    expect(componerDomicilio({ calle: "  ", estado: "" })).toBeNull();
  });
});

describe("estado por código postal", () => {
  it("sugiere el estado por los dos primeros dígitos", () => {
    expect(estadoPorCodigoPostal("76226")).toBe("Querétaro");
    expect(estadoPorCodigoPostal("62440")).toBe("Morelos");
    expect(estadoPorCodigoPostal("06700")).toBe("Ciudad de México");
    expect(estadoPorCodigoPostal("1234")).toBeNull();
    expect(estadoPorCodigoPostal("18000")).toBeNull();
  });
  it("los nombres coinciden con el catálogo del INEGI", () => {
    const cat = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/catalogos/municipios-mx.json"), "utf8")) as { estados: { nombre: string }[] };
    const nombres = new Set(cat.estados.map((e) => e.nombre));
    for (const cp of ["01000", "20000", "21000", "23000", "24000", "25000", "28000", "29000", "31000", "34000", "36000", "39000", "42000", "44000",
      "50000", "58000", "62000", "63000", "64000", "68000", "72000", "76000", "77000", "78000", "80000", "83000", "86000", "87000", "90000", "91000", "97000", "98000"]) {
      expect(nombres.has(estadoPorCodigoPostal(cp)!), cp).toBe(true);
    }
  });
});
