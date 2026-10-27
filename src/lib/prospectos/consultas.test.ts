import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
beforeAll(() => {
  process.env.HMAC_LLAVE = Buffer.alloc(32, 9).toString("base64");
});

describe("buscador de prospectos", async () => {
  const { filtroBusqueda } = await import("./consultas");

  it("CURP y NSS se buscan por índice ciego, nunca en claro", () => {
    const r = filtroBusqueda("12345678903");
    expect(JSON.stringify(r)).not.toContain("12345678903");
    expect(r).toMatchObject({ where: { persona: { nss_hash: expect.stringMatching(/^[0-9a-f]{64}$/) } } });
  });
  it("folio con o sin guion", () => {
    expect(filtroBusqueda("rp-12")).toEqual({ where: { folio: { endsWith: "0012" } } });
    expect(filtroBusqueda("RP0003")).toEqual({ where: { folio: { endsWith: "0003" } } });
  });
  it("teléfono por dígitos", () => {
    expect(filtroBusqueda("777 123")).toMatchObject({ where: { persona: { OR: [{ whatsapp: { contains: "777123" } }, expect.anything()] } } });
  });
  it("nombre sin acentos ni mayúsculas, palabra por palabra", () => {
    expect(filtroBusqueda("  Gómez   JUANA ")).toEqual({ palabras: ["gomez", "juana"] });
    expect(filtroBusqueda("")).toBeNull();
  });
});
