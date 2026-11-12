import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verificarFirmaResend } from "./firma";

const llave = Buffer.from("llave-de-prueba-de-32-bytes!!!!!").toString("base64");
const SECRETO = `whsec_${llave}`;
const firmar = (id: string, ts: string, cuerpo: string) => `v1,${createHmac("sha256", Buffer.from(llave, "base64")).update(`${id}.${ts}.${cuerpo}`).digest("base64")}`;

describe("firma de Resend (Svix)", () => {
  const cuerpo = '{"type":"email.received"}', ts = "1700000000";
  it("acepta una firma válida, también entre varias", () => {
    expect(verificarFirmaResend(SECRETO, "msg_1", ts, firmar("msg_1", ts, cuerpo), cuerpo, 1700000010)).toEqual({ ok: true });
    expect(verificarFirmaResend(SECRETO, "msg_1", ts, `v1,AAAA ${firmar("msg_1", ts, cuerpo)}`, cuerpo, 1700000010)).toEqual({ ok: true });
  });
  it("rechaza cuerpo alterado, firma de otro id, fuera de tiempo, sin secreto o sin cabeceras", () => {
    expect(verificarFirmaResend(SECRETO, "msg_1", ts, firmar("msg_1", ts, cuerpo), cuerpo + " ", 1700000010)).toMatchObject({ ok: false, motivo: "firma" });
    expect(verificarFirmaResend(SECRETO, "msg_2", ts, firmar("msg_1", ts, cuerpo), cuerpo, 1700000010)).toMatchObject({ ok: false, motivo: "firma" });
    expect(verificarFirmaResend(SECRETO, "msg_1", ts, firmar("msg_1", ts, cuerpo), cuerpo, 1700000400)).toMatchObject({ ok: false, motivo: "fuera_de_tiempo" });
    expect(verificarFirmaResend(undefined, "msg_1", ts, "v1,x", cuerpo, 1700000010)).toMatchObject({ ok: false, motivo: "sin_secreto" });
    expect(verificarFirmaResend(SECRETO, null, ts, "v1,x", cuerpo, 1700000010)).toMatchObject({ ok: false, motivo: "sin_cabeceras" });
  });
});
