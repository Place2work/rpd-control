import { describe, expect, it } from "vitest";
import {
  curpParcial,
  datosDeCurp,
  digitoVerificadorCurp,
  validarClabe,
  digitoVerificadorNss,
  enmascararClabe,
  enmascararNss,
  tipoIdentificador,
  validarCurp,
  validarNss,
} from "../identificadores";

// Identificadores ficticios: el dígito verificador se calcula con el mismo algoritmo.
const CURP_BASE = "GOMJ800215HMSRRN0"; // 17 caracteres, Morelos, nacido 1980
const CURP = CURP_BASE + digitoVerificadorCurp(CURP_BASE);
const NSS_BASE = "1234567890";
const NSS = NSS_BASE + digitoVerificadorNss(NSS_BASE);

describe("CURP", () => {
  it("acepta una CURP con formato y dígito correctos, en minúsculas y con espacios", () => {
    expect(validarCurp(` ${CURP.toLowerCase()} `)).toEqual({ valido: true, valor: CURP });
  });
  it("rechaza dígito verificador incorrecto", () => {
    const mala = CURP_BASE + ((Number(CURP[17]) + 1) % 10);
    expect(validarCurp(mala)).toMatchObject({ valido: false, error: expect.stringContaining("verificador") });
  });
  it("rechaza longitud y formato", () => {
    expect(validarCurp("ABC")).toMatchObject({ valido: false });
    expect(validarCurp("GOMJ801315HMSRRN01")).toMatchObject({ valido: false }); // mes 13
  });
  it("deriva fecha de nacimiento y sexo, con el siglo del carácter 17", () => {
    expect(datosDeCurp(CURP)).toEqual({ fechaNacimiento: "1980-02-15", sexo: "H" });
    const base2000 = "PEMA050310MDFRRNA";
    expect(datosDeCurp(base2000 + digitoVerificadorCurp(base2000))).toEqual({ fechaNacimiento: "2005-03-10", sexo: "M" });
  });
  it("muestra la CURP parcial para el vendedor", () => {
    expect(curpParcial(CURP)).toBe(`GOMJ${"•".repeat(12)}${CURP.slice(16)}`);
  });
});

describe("NSS", () => {
  it("calcula Luhn sobre los 10 primeros dígitos", () => {
    expect(digitoVerificadorNss("1234567890")).toBe(3);
  });
  it("acepta NSS con guiones o espacios", () => {
    expect(validarNss(`${NSS.slice(0, 2)}-${NSS.slice(2, 4)} ${NSS.slice(4)}`)).toEqual({ valido: true, valor: NSS });
  });
  it("rechaza longitud o dígito incorrectos", () => {
    expect(validarNss("123")).toMatchObject({ valido: false });
    expect(validarNss(NSS_BASE + ((Number(NSS[10]) + 1) % 10))).toMatchObject({ valido: false });
  });
  it("enmascara como en la sección 3", () => {
    expect(enmascararNss("1002")).toBe("•••••••1002");
    expect(enmascararClabe("1234")).toBe("•••• 1234");
  });
});

describe("tipoIdentificador", () => {
  it("distingue CURP, NSS y texto libre", () => {
    expect(tipoIdentificador(CURP)).toBe("curp");
    expect(tipoIdentificador(NSS)).toBe("nss");
    expect(tipoIdentificador("Juan Pérez")).toBeNull();
    expect(tipoIdentificador("777 123 4567")).toBeNull(); // 10 dígitos: teléfono
  });
});

describe("CLABE", () => {
  it("acepta una CLABE con dígito verificador correcto y rechaza la alterada", () => {
    expect(validarClabe("002 010 07777777777 1").valido).toBe(true); // ejemplo de Banxico
    expect(validarClabe("002010077777777772").valido).toBe(false);
    expect(validarClabe("12345")).toEqual({ valido: false, error: "La CLABE tiene 18 dígitos" });
  });
});
