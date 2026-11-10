import { describe, expect, it } from "vitest";
import { avisoArchivo, estadoVisible, rutaDocumento, validarArchivo, validarComprobante } from "./reglas";

describe("archivos del expediente", () => {
  it("acepta fotos y PDF dentro de los límites", () => {
    expect(validarArchivo("image/jpeg", 2_000_000)).toBeNull();
    expect(validarArchivo("application/pdf", 50_000)).toBeNull(); // el mínimo de 256 KB es solo para fotos
  });
  it("rechaza tipos raros, archivos enormes y vacíos", () => {
    expect(validarArchivo("application/zip", 1000)).toMatch(/foto|PDF/);
    expect(validarArchivo("image/jpeg", 16 * 1024 * 1024)).toMatch(/15 MB/);
    expect(validarArchivo("image/png", 0)).toMatch(/vacío/);
  });
  it("una foto de menos de 256 KB se sube, pero con aviso para revisarla", () => {
    expect(validarArchivo("image/png", 100 * 1024)).toBeNull();
    expect(avisoArchivo("image/png", 100 * 1024)).toMatch(/100 KB.*256 KB/);
    expect(avisoArchivo("image/jpeg", 300 * 1024)).toBeNull();
    expect(avisoArchivo("application/pdf", 50_000)).toBeNull();
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

describe("comprobante de transferencia", () => {
  it("acepta una captura de pantalla chica (sin el mínimo de 256 KB de las fotos para la Afore)", () => {
    expect(validarComprobante("image/png", 80_000)).toBeNull();
    expect(validarComprobante("application/pdf", 40_000)).toBeNull();
  });
  it("rechaza otros formatos, vacíos y archivos de más de 15 MB", () => {
    expect(validarComprobante("text/plain", 1000)).toMatch(/foto|PDF/);
    expect(validarComprobante("image/jpeg", 0)).toMatch(/vacío/);
    expect(validarComprobante("image/jpeg", 16 * 1024 * 1024)).toMatch(/15 MB/);
  });
});
