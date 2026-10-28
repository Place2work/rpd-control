import { describe, expect, it } from "vitest";
import { estadoVisible, rutaDocumento, validarArchivo } from "./reglas";

describe("archivos del expediente", () => {
  it("acepta fotos y PDF dentro de los límites", () => {
    expect(validarArchivo("image/jpeg", 2_000_000)).toBeNull();
    expect(validarArchivo("application/pdf", 50_000)).toBeNull(); // el mínimo de 256 KB es solo para fotos
  });
  it("rechaza tipos raros, archivos enormes y fotos muy ligeras", () => {
    expect(validarArchivo("application/zip", 1000)).toMatch(/foto|PDF/);
    expect(validarArchivo("image/jpeg", 16 * 1024 * 1024)).toMatch(/15 MB/);
    expect(validarArchivo("image/png", 100 * 1024)).toMatch(/256 KB/);
  });
  it("la ruta no lleva datos personales", () => {
    expect(rutaDocumento("caso-1", "abc", "image/jpeg")).toBe("caso-1/abc.jpg");
  });
  it("un documento con vigencia vencida se muestra como vencido", () => {
    expect(estadoVisible("validado", "2026-10-01", "2026-10-27")).toBe("vencido");
    expect(estadoVisible("validado", "2026-12-01", "2026-10-27")).toBe("validado");
    expect(estadoVisible("rechazado", "2026-10-01", "2026-10-27")).toBe("rechazado");
  });
});
