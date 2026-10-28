import { describe, expect, it } from "vitest";
import { esquemaLead } from "./esquema";
import { firmar, verificarFirma } from "./firma";

const S = "secreto-de-prueba";
const AHORA = 1_793_000_000;
const cuerpo = JSON.stringify({ nombre: "Ana" });

describe("firma de /api/leads", () => {
  it("acepta la firma correcta dentro de la ventana", () => {
    expect(verificarFirma(S, String(AHORA - 60), firmar(S, String(AHORA - 60), cuerpo), cuerpo, AHORA)).toEqual({ ok: true });
  });
  it("rechaza cuerpo alterado, otro secreto, firma vieja y faltantes", () => {
    const ts = String(AHORA);
    expect(verificarFirma(S, ts, firmar(S, ts, cuerpo), cuerpo + " ", AHORA)).toMatchObject({ motivo: "invalida" });
    expect(verificarFirma(S, ts, firmar("otro", ts, cuerpo), cuerpo, AHORA)).toMatchObject({ motivo: "invalida" });
    expect(verificarFirma(S, String(AHORA - 301), firmar(S, String(AHORA - 301), cuerpo), cuerpo, AHORA)).toMatchObject({ motivo: "vencida" });
    expect(verificarFirma(S, null, null, cuerpo, AHORA)).toMatchObject({ motivo: "sin_firma" });
    expect(verificarFirma(undefined, ts, "x", cuerpo, AHORA)).toMatchObject({ motivo: "sin_secreto" });
  });
});

describe("datos del formulario", () => {
  const ok = { nombre: "Ana", whatsapp: "777 123 4567", servicio: "retiro", privacidad_aceptada: true };
  it("normaliza WhatsApp y mapea el servicio", () => {
    expect(esquemaLead.parse(ok)).toMatchObject({ whatsapp: "+527771234567", tipo_servicio: "RETIRO_DESEMPLEO" });
  });
  it("sin aviso de privacidad no pasa", () => {
    expect(esquemaLead.safeParse({ ...ok, privacidad_aceptada: false }).success).toBe(false);
  });
  it("rechaza servicio desconocido y fecha mal escrita", () => {
    expect(esquemaLead.safeParse({ ...ok, servicio: "otro" }).success).toBe(false);
    expect(esquemaLead.safeParse({ ...ok, fecha_baja: "31/12/2026" }).success).toBe(false);
  });
});
