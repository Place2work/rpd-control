import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

beforeAll(() => {
  process.env.CIFRADO_LLAVE = Buffer.alloc(32, 7).toString("base64");
  process.env.HMAC_LLAVE = Buffer.alloc(32, 9).toString("base64");
});

describe("cifrado a nivel campo", async () => {
  const { cifrar, descifrar, hashIdentificador } = await import("./index");

  it("cifra y descifra, con IV distinto cada vez", () => {
    const a = cifrar("12345678903");
    const b = cifrar("12345678903");
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
    expect(descifrar(a)).toBe("12345678903");
  });

  it("detecta alteraciones (GCM)", () => {
    const a = cifrar("dato");
    a[a.length - 1] ^= 1;
    expect(() => descifrar(a)).toThrow();
  });

  it("el hash es estable, normaliza el formato y separa CURP de NSS", () => {
    expect(hashIdentificador("nss", "12-34 5678903")).toBe(hashIdentificador("nss", "12345678903"));
    expect(hashIdentificador("curp", "gomj800215hmsrrn09")).toBe(hashIdentificador("curp", "GOMJ800215HMSRRN09"));
    expect(hashIdentificador("nss", "12345678903")).not.toBe(hashIdentificador("curp", "12345678903"));
  });
});
