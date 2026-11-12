import { describe, expect, it } from "vitest";
import { autenticado, direccionDe, esRemitenteImss, identificadoresEnTexto, ligaDeConfirmacion, ligasImss, solicitudUnicaReciente } from "./correo-imss";

describe("correos del IMSS", () => {
  it("reconoce remitentes del IMSS y nada más", () => {
    expect(direccionDe("IMSS <NoResponder@imss.gob.mx>")).toBe("noresponder@imss.gob.mx");
    expect(esRemitenteImss("IMSS <noresponder@imss.gob.mx>")).toBe(true);
    expect(esRemitenteImss("constancias@serviciosdigitales.imss.gob.mx")).toBe(true);
    expect(esRemitenteImss("falso@imss.gob.mx.estafa.com")).toBe(false);
    expect(esRemitenteImss("alguien@gmail.com")).toBe(false);
  });
  it("exige DKIM o SPF aprobados", () => {
    expect(autenticado({ dkim: "pass", spf: "fail" })).toBe(true);
    expect(autenticado({ dkim: [{ result: "pass" }] })).toBe(true);
    expect(autenticado({ spf: { result: "pass" } })).toBe(true);
    expect(autenticado({ dkim: "fail", spf: "softfail" })).toBe(false);
    expect(autenticado(null)).toBe(false);
  });
  it("solo toma ligas https de imss.gob.mx y elige la de confirmación", () => {
    const html = '<a href="https://serviciosdigitales.imss.gob.mx/semanascotizadas-web/confirmar?t=abc&amp;x=1">Confirmar</a> <a href="https://phishing.com/imss.gob.mx">x</a> http://imss.gob.mx/inseguro';
    const ligas = ligasImss(html, "Visita https://www.imss.gob.mx.");
    expect(ligas).toEqual(["https://serviciosdigitales.imss.gob.mx/semanascotizadas-web/confirmar?t=abc&x=1", "https://www.imss.gob.mx/"]);
    expect(ligaDeConfirmacion(ligas)).toBe("https://serviciosdigitales.imss.gob.mx/semanascotizadas-web/confirmar?t=abc&x=1");
    expect(ligaDeConfirmacion(["https://www.imss.gob.mx/"])).toBe("https://www.imss.gob.mx/");
    expect(ligaDeConfirmacion([])).toBeNull();
  });
  it("encuentra CURP y NSS en el texto", () => {
    expect(identificadoresEnTexto("Asegurado con CURP pelj800101hmsrpn09 y NSS 12345678901.")).toEqual({ curps: ["PELJ800101HMSRPN09"], nsss: ["12345678901"] });
    expect(identificadoresEnTexto(null)).toEqual({ curps: [], nsss: [] });
  });
  it("sin identificadores, se liga solo si hay una única solicitud reciente", () => {
    const ahora = "2026-11-12T18:00:00.000Z";
    expect(solicitudUnicaReciente([{ id: "a", creada: "2026-11-12T17:00:00.000Z" }], ahora)?.id).toBe("a");
    expect(solicitudUnicaReciente([{ id: "a", creada: "2026-11-12T17:00:00.000Z" }, { id: "b", creada: "2026-11-12T16:00:00.000Z" }], ahora)).toBeNull();
    expect(solicitudUnicaReciente([{ id: "a", creada: "2026-11-11T08:00:00.000Z" }], ahora)).toBeNull();
  });
});
