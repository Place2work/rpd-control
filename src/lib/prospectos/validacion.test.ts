import { describe, expect, it } from "vitest";
import { digitoVerificadorCurp, digitoVerificadorNss } from "@/lib/reglas/identificadores";
import { esquemaAlta, normalizarWhatsapp } from "./validacion";

const base = { nombre: "Juana", whatsapp: "777 123 4567", tipo_servicio: "RETIRO_DESEMPLEO", origen: "whatsapp" };

describe("alta rápida", () => {
  it("normaliza el WhatsApp a E.164", () => {
    expect(normalizarWhatsapp("777 123 4567")).toBe("+527771234567");
    expect(normalizarWhatsapp("52 777 123 4567")).toBe("+527771234567");
    expect(normalizarWhatsapp("+1 (555) 123-4567")).toBe("+15551234567");
    expect(normalizarWhatsapp("12345")).toBeNull();
  });

  it("basta nombre, WhatsApp, servicio y origen", () => {
    const r = esquemaAlta.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ nombre: "Juana", whatsapp: "+527771234567" });
    expect(r.data?.curp).toBeUndefined();
    expect(r.data?.fecha_baja).toBeUndefined();
  });

  it("los campos vacíos del formulario cuentan como no capturados", () => {
    const r = esquemaAlta.safeParse({ ...base, apellido_paterno: "", fecha_baja: "", curp: " " });
    expect(r.success).toBe(true);
    expect(r.data?.apellido_paterno).toBeUndefined();
  });

  it("valida CURP y NSS con su dígito verificador y los normaliza", () => {
    const curp = "GOMJ800215HMSRRN0" + digitoVerificadorCurp("GOMJ800215HMSRRN0");
    const nss = "1234567890" + digitoVerificadorNss("1234567890");
    const ok = esquemaAlta.safeParse({ ...base, curp: curp.toLowerCase(), nss: "12-34567890" + nss.slice(10) });
    expect(ok.data).toMatchObject({ curp, nss });
    const mal = esquemaAlta.safeParse({ ...base, curp: "GOMJ800215HMSRRN0X", nss: "123" });
    expect(mal.success).toBe(false);
    expect(mal.error?.issues.map((i) => i.path[0]).sort()).toEqual(["curp", "nss"]);
  });

  it("rechaza WhatsApp corto y origen inventado", () => {
    const r = esquemaAlta.safeParse({ ...base, whatsapp: "123", origen: "tiktok" });
    expect(r.error?.issues.map((i) => i.path[0]).sort()).toEqual(["origen", "whatsapp"]);
  });
});
