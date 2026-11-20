import { describe, expect, it } from "vitest";
import { nombrePropio, revisarIne, type IneCruda } from "./ine";

const base: IneCruda = {
  es_ine: true, nombre: "MARÍA DE LOURDES", apellido_paterno: "GÓMEZ", apellido_materno: "LÓPEZ",
  curp: "GOLM850312MMCMPR03", fecha_nacimiento: "1985-03-12", sexo: "M",
  calle: "AV DE LAS FLORES", numero_exterior: "123", numero_interior: null, colonia: "COL CENTRO",
  codigo_postal: "76000", municipio: "QUERÉTARO", estado: "QRO", vigencia: "2031",
};
const HOY = "2026-11-20";

describe("revisarIne", () => {
  it("limpia una lectura correcta", () => {
    const { lectura } = revisarIne(base, HOY);
    expect(lectura).toMatchObject({ nombre: "María de Lourdes", apellidoPaterno: "Gómez", curp: "GOLM850312MMCMPR03", fechaNacimiento: "1985-03-12",
      sexo: "M", calle: "Av de las Flores", codigoPostal: "76000", vigencia: 2031, vigente: true, avisos: [] });
  });
  it("rechaza lo que no es INE", () => {
    expect(revisarIne({ ...base, es_ine: false }, HOY).error).toMatch(/no parece/);
  });
  it("descarta una CURP con dígito verificador malo y avisa", () => {
    const { lectura } = revisarIne({ ...base, curp: "GOLM850312MMCMPR09" }, HOY);
    expect(lectura?.curp).toBeNull();
    expect(lectura?.avisos[0]).toMatch(/CURP/);
  });
  it("la fecha y el sexo de la CURP mandan", () => {
    const { lectura } = revisarIne({ ...base, fecha_nacimiento: "1985-12-03", sexo: "H" }, HOY);
    expect(lectura).toMatchObject({ fechaNacimiento: "1985-03-12", sexo: "M" });
    expect(lectura?.avisos.join(" ")).toMatch(/no coincide/);
  });
  it("vigencia vencida y rango tipo 2016-2026", () => {
    expect(revisarIne({ ...base, vigencia: "2015 - 2025" }, HOY).lectura).toMatchObject({ vigencia: 2025, vigente: false });
    expect(revisarIne({ ...base, vigencia: "2016 2026" }, HOY).lectura).toMatchObject({ vigencia: 2026, vigente: true });
  });
  it("código postal inválido y textos vacíos", () => {
    const { lectura } = revisarIne({ ...base, codigo_postal: "7600", numero_interior: "N/A", colonia: "  " }, HOY);
    expect(lectura).toMatchObject({ codigoPostal: null, numeroInterior: null, colonia: null });
    expect(lectura?.avisos[0]).toMatch(/5 dígitos/);
  });
  it("fecha futura o mal formada se ignora", () => {
    expect(revisarIne({ ...base, curp: null, fecha_nacimiento: "2030-01-01" }, HOY).lectura?.fechaNacimiento).toBeNull();
    expect(revisarIne({ ...base, curp: null, fecha_nacimiento: "12/03/1985" }, HOY).lectura?.fechaNacimiento).toBeNull();
  });
});

describe("nombrePropio", () => {
  it("respeta preposiciones y acentos", () => {
    expect(nombrePropio("JOSÉ DE LA CRUZ")).toBe("José de la Cruz");
    expect(nombrePropio("DEL VALLE")).toBe("Del Valle");
  });
});
