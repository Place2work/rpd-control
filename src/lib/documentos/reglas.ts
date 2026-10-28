// Reglas de archivos del expediente (5.6). Puras: se usan en el navegador y en el servidor.
export const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"] as const;
export const MAX_BYTES = 15 * 1024 * 1024; // igual al límite del bucket "expedientes"
export const MIN_BYTES_FOTO = 256 * 1024; // "Fotos a color, mínimo 256 KB" (5.6)

export function validarArchivo(mime: string, bytes: number): string | null {
  if (!(TIPOS_PERMITIDOS as readonly string[]).includes(mime)) return "Sube una foto (JPG, PNG, WEBP, HEIC) o un PDF";
  if (bytes > MAX_BYTES) return "El archivo pesa más de 15 MB";
  if (mime.startsWith("image/") && bytes < MIN_BYTES_FOTO) {
    return "La foto pesa menos de 256 KB; la Afore la puede rechazar. Tómala de nuevo con más luz y sin recortar";
  }
  return null;
}

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "application/pdf": "pdf",
};

/** Ruta sin datos personales: {caso_id}/{uuid}.ext (sección 12). */
export function rutaDocumento(casoId: string, uuid: string, mime: string): string {
  return `${casoId}/${uuid}.${EXTENSION[mime] ?? "bin"}`;
}

export type EstadoVisible = "pendiente" | "recibido" | "validado" | "rechazado" | "vencido";

/** Estado que se muestra: un validado con vigencia vencida cuenta como vencido. */
export function estadoVisible(estado: EstadoVisible, fechaVencimiento: string | null, hoy: string): EstadoVisible {
  if (fechaVencimiento && fechaVencimiento < hoy && (estado === "validado" || estado === "recibido")) return "vencido";
  return estado;
}
