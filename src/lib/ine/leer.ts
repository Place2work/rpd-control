// Lectura de la INE con IA (servidor), 20-nov-2026: la foto o el PDF del expediente se manda a la API de Anthropic
// para que lea los datos de la credencial; luego la regla pura revisarIne los limpia y revisa (CURP, fechas, CP).
// No se guarda la clave de elector ni el OCR; nada de esto se registra en bitácoras con el dato completo.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { leerArchivo } from "@/lib/documentos/almacen";
import { revisarIne, type LecturaIne } from "@/lib/reglas/ine";

const texto = z.string().nullable();
const esquema = z.object({
  es_ine: z.boolean().describe("true solo si es una credencial para votar del INE/IFE de México"),
  nombre: texto.describe("Nombre(s) de pila"), apellido_paterno: texto, apellido_materno: texto,
  curp: texto.describe("CURP de 18 caracteres tal como aparece"),
  fecha_nacimiento: texto.describe("AAAA-MM-DD"), sexo: texto.describe("H o M"),
  calle: texto.describe("Calle o avenida, sin número"), numero_exterior: texto, numero_interior: texto,
  colonia: texto.describe("Colonia, fraccionamiento o barrio"), codigo_postal: texto.describe("5 dígitos"),
  municipio: texto.describe("Municipio o alcaldía"), estado: texto.describe("Entidad federativa con nombre completo"),
  vigencia: texto.describe("Año o rango de vigencia, p. ej. 2031 o 2021 - 2031"),
});

const INSTRUCCIONES = `Lee la credencial para votar mexicana (INE o IFE) de las imágenes y devuelve sus datos.
- Copia los datos tal como aparecen; si un dato no se ve o no es legible, devuélvelo como null. No inventes ni completes datos.
- El domicilio suele venir en 2 o 3 renglones: calle y número; colonia y código postal; municipio y estado. Sepáralo en sus partes.
- El estado puede venir abreviado (QRO., MEX., CDMX): escribe el nombre completo de la entidad.
- La fecha de nacimiento viene como DD/MM/AAAA: devuélvela como AAAA-MM-DD.
- Si el archivo trae frente y reverso, usa ambos. Ignora la clave de elector, el OCR y el CIC: no los devuelvas.`;

export const MIME_INE = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

export async function leerIneGuardada(ruta: string, mime: string, hoy: string): Promise<{ lectura?: LecturaIne; error?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { error: "La lectura automática de la INE no está configurada (falta la clave de Anthropic en Vercel). Captura los datos a mano." };
  if (!(MIME_INE as readonly string[]).includes(mime)) return { error: "Solo se leen INE en JPG, PNG, WEBP o PDF. Si es HEIC, conviértela a JPG o captura los datos a mano." };
  let datos: string;
  try {
    datos = Buffer.from(await leerArchivo(ruta)).toString("base64");
  } catch (e) {
    console.error("[ine] archivo", (e as Error).message);
    return { error: "No se pudo abrir el archivo de la INE." };
  }
  const archivo = mime === "application/pdf"
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: datos } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: mime as "image/jpeg" | "image/png" | "image/webp", data: datos } };
  try {
    const cliente = new Anthropic();
    const r = await cliente.beta.messages.parse({
      model: "claude-opus-5-5", max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(esquema) },
      messages: [{ role: "user", content: [archivo, { type: "text", text: INSTRUCCIONES }] }],
    });
    if (r.stop_reason === "refusal") return { error: "No se pudo leer esta imagen automáticamente. Captura los datos a mano." };
    if (!r.parsed_output) return { error: "No se pudieron leer los datos de la INE. Prueba con una foto más clara o captúralos a mano." };
    return revisarIne(r.parsed_output, hoy);
  } catch (e) {
    // Solo el tipo y el estado del error: nunca el contenido de la credencial.
    const err = e as { status?: number; name?: string };
    console.error("[ine] api", err.name, err.status);
    return { error: err.status === 401 ? "La clave de Anthropic en Vercel no es válida." : "El servicio de lectura no respondió. Intenta de nuevo en un momento o captura los datos a mano." };
  }
}
