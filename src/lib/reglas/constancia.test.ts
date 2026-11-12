import { describe, expect, it } from "vitest";
import { esConstanciaSemanas, leerConstancia } from "./constancia";

// Constancia inventada con el mismo formato que la del IMSS (datos ficticios).
const FICTICIA = `Instituto Mexicano del Seguro Social
Constancia de Semanas Cotizadas en el IMSS e
historial de registros afiliatorios de la persona asegurada
Estimado(a), | Fecha de emisión del reporte
PEREZ LOPEZ JUAN | 03 / 11 / 2026
DD | MM | YYYY
NSS: 12345678901 | Total de semanas cotizadas
CURP: PELJ800101HMSRPN09 | 640
Tu detalle de semanas cotizadas
Semanas Descontadas
Semanas cotizadas IMSS | (por disposición de recursos) (-) | Semanas Reintegradas (+)
700 | 75 | 15
Tu historia laboral
Nombre del patrón | COMERCIAL EJEMPLO SA DE CV
Registro Patronal | A1234567890
Entidad federativa | MORELOS
Fecha de alta | 01/03/2022 | Fecha de baja | 15/01/2026 | Salario Base de Cotización * | $ 1,250.50
Tipo de movimiento | Fecha de movimiento | Salario Base
BAJA | 15/01/2026 | $ 1,250.50
REINGRESO | 01/03/2022 | $ 900.00
Página 1 de 3
Nombre del patrón | SERVICIOS PRUEBA
Registro Patronal | B9876543210
Entidad federativa | GUERRERO
Fecha de alta | 10/05/2010 | Fecha de baja | 20/12/2015 | Salario Base de Cotización * | $ 300.00
Nombre del patrón | COMERCIAL EJEMPLO SA DE CV
Registro Patronal | A1234567890
Entidad federativa | MORELOS
Fecha de alta | 01/03/2022 | Fecha de baja | 15/01/2026 | Salario Base de Cotización * | $ 1,250.50
Cadena original |||Origen de Trámite:Internet (I)|Tipo Trámite:CONSTANCIA DE SEMANAS COTIZADAS|
Asegurado:JUAN|Folio:11112222333344445555|Número total de semanas cotizadas:640||`.split("\n");

describe("constancia de semanas cotizadas", () => {
  it("reconoce el documento", () => {
    expect(esConstanciaSemanas(FICTICIA)).toBe(true);
    expect(esConstanciaSemanas(["Estado de cuenta Afore", "Saldo"])).toBe(false);
  });
  it("lee datos de la persona, la fecha de emisión y el folio", () => {
    const r = leerConstancia(FICTICIA);
    expect(r).toMatchObject({ nombre: "PEREZ LOPEZ JUAN", nss: "12345678901", curp: "PELJ800101HMSRPN09", fechaEmision: "2026-11-03", folio: "11112222333344445555" });
  });
  it("lee el total y el desglose de semanas, y el total cuadra", () => {
    const r = leerConstancia(FICTICIA);
    expect(r).toMatchObject({ total: 640, cotizadas: 700, descontadas: 75, reintegradas: 15 });
    expect(r.avisos).toEqual([]);
  });
  it("lee los patrones sin repetir bloques y saca baja, primera alta, último patrón y salario", () => {
    const r = leerConstancia(FICTICIA);
    expect(r.patrones).toHaveLength(2);
    expect(r.patrones[0]).toEqual({ nombre: "COMERCIAL EJEMPLO SA DE CV", registro: "A1234567890", entidad: "MORELOS", alta: "2022-03-01", baja: "2026-01-15", sbc: 1250.5 });
    expect(r).toMatchObject({ fechaBaja: "2026-01-15", primeraAlta: "2010-05-10", ultimoPatron: "COMERCIAL EJEMPLO SA DE CV", sbcUltimo: 1250.5, cotizaActualmente: false, regimen: "L97" });
  });
  it("indica Ley 73 si la primera alta es anterior al 1 de julio de 1997", () => {
    const antigua = FICTICIA.map((l) => l.replace("Fecha de alta | 10/05/2010", "Fecha de alta | 30/06/1997"));
    expect(leerConstancia(antigua)).toMatchObject({ primeraAlta: "1997-06-30", regimen: "L73" });
    const justo = FICTICIA.map((l) => l.replace("Fecha de alta | 10/05/2010", "Fecha de alta | 01/07/1997"));
    expect(leerConstancia(justo).regimen).toBe("L97");
  });
  it("acepta el texto con espacios en lugar de « | » (otra herramienta de extracción)", () => {
    const conEspacios = FICTICIA.map((l) => l.replaceAll(" | ", "      "));
    expect(leerConstancia(conEspacios)).toMatchObject({ nss: "12345678901", total: 640, cotizadas: 700, fechaBaja: "2026-01-15" });
  });
  it("un patrón sin fecha de baja: sigue cotizando y no hay fecha de baja", () => {
    const vigente = FICTICIA.map((l) => l === "Fecha de alta | 01/03/2022 | Fecha de baja | 15/01/2026 | Salario Base de Cotización * | $ 1,250.50"
      ? "Fecha de alta | 01/03/2022 | Fecha de baja | Vigente | Salario Base de Cotización * | $ 1,250.50" : l);
    const r = leerConstancia(vigente);
    expect(r).toMatchObject({ cotizaActualmente: true, fechaBaja: null, ultimoPatron: "COMERCIAL EJEMPLO SA DE CV" });
    expect(r.avisos.join(" ")).toMatch(/sigue cotizando/);
  });
  it("avisa si el total no cuadra o faltan datos", () => {
    const mal = FICTICIA.map((l) => (l === "700 | 75 | 15" ? "700 | 75 | 0" : l));
    expect(leerConstancia(mal).avisos.join(" ")).toMatch(/no cuadra/);
    expect(leerConstancia(["Hola"]).avisos.length).toBeGreaterThan(2);
  });
});
