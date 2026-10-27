// Validación del alta rápida (10.2). Compartida por el formulario y la acción del servidor.
import { z } from "zod";
import { normalizarCurp, normalizarNss, validarCurp, validarNss } from "@/lib/reglas/identificadores";

export const ORIGENES = [
  ["whatsapp", "WhatsApp"],
  ["llamada", "Llamada"],
  ["web", "Sitio web"],
  ["referido", "Referido"],
  ["vendedor", "Vendedor en campo"],
  ["facebook", "Facebook"],
  ["google", "Google"],
  ["otro", "Otro"],
] as const;

export const SERVICIOS_RAPIDOS = [
  ["RETIRO_DESEMPLEO", "Retiro por desempleo"],
  ["PENSION_L73", "Pensión Ley 73"],
] as const;

/** WhatsApp en E.164. 10 dígitos se toman como México (+52). */
export function normalizarWhatsapp(entrada: string): string | null {
  const digitos = entrada.replace(/\D/g, "");
  if (entrada.trim().startsWith("+")) return digitos.length >= 8 && digitos.length <= 15 ? `+${digitos}` : null;
  if (digitos.length === 10) return `+52${digitos}`;
  if (digitos.length === 12 && digitos.startsWith("52")) return `+${digitos}`;
  return null;
}

const opcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

// Cada campo valida por su cuenta para que el formulario muestre todos los errores a la vez.
export const esquemaAlta = z
  .object({
    nombre: z.string().trim().min(2, "Escribe el nombre"),
    apellido_paterno: opcional,
    apellido_materno: opcional,
    whatsapp: z
      .string()
      .trim()
      .refine((v) => normalizarWhatsapp(v) !== null, "Escribe 10 dígitos, por ejemplo 777 123 4567"),
    tipo_servicio: z.string().min(1, "Elige el servicio de interés"),
    fecha_baja: opcional.refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha no válida"),
    origen: z.enum(ORIGENES.map(([v]) => v) as [string, ...string[]], { message: "Elige el origen" }),
    referidor_id: opcional,
    curp: opcional.superRefine((v, ctx) => {
      const r = v ? validarCurp(v) : null;
      if (r && !r.valido) ctx.addIssue({ code: "custom", message: r.error });
    }),
    nss: opcional.superRefine((v, ctx) => {
      const r = v ? validarNss(v) : null;
      if (r && !r.valido) ctx.addIssue({ code: "custom", message: r.error });
    }),
    privacidad: z.literal("si").optional(),
    confirmar_duplicado: z.literal("si").optional(),
  })
  .transform((d) => ({
    ...d,
    whatsapp: normalizarWhatsapp(d.whatsapp)!,
    curp: d.curp ? normalizarCurp(d.curp) : undefined,
    nss: d.nss ? normalizarNss(d.nss) : undefined,
  }));

export type DatosAlta = z.output<typeof esquemaAlta>;
