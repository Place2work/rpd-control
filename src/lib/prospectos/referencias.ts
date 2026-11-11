// Referencias personales del cliente (11-nov-2026): dos por persona. Puras: se usan en el servidor y en pruebas.
import { z } from "zod";
import { normalizarWhatsapp } from "./validacion";

export const PARENTESCOS = [
  ["padre_madre", "Padre o madre"], ["hermano", "Hermano(a)"], ["hijo", "Hijo(a)"], ["conyuge", "Cónyuge o pareja"],
  ["otro_familiar", "Otro familiar"], ["amigo", "Amigo(a)"], ["companero", "Compañero(a) de trabajo"],
  ["vecino", "Vecino(a)"], ["otro", "Otro"],
] as const;
const CLAVES = PARENTESCOS.map(([k]) => k) as [string, ...string[]];
export const NOMBRE_PARENTESCO = Object.fromEntries(PARENTESCOS) as Record<string, string>;

const opcional = z.string().trim().max(300).transform((v) => (v.length ? v : null));

export const esquemaReferencia = z.object({
  nombre: z.string().trim().min(5, "Escribe el nombre completo (nombre y apellidos)").max(150)
    .refine((v) => v.split(/\s+/).length >= 2, "Escribe el nombre completo (nombre y apellidos)"),
  telefono: z.string().trim().min(1, "Escribe el teléfono").transform((v, ctx) => {
    const n = normalizarWhatsapp(v);
    if (!n) { ctx.addIssue({ code: "custom", message: "Escribe 10 dígitos" }); return z.NEVER; }
    return n;
  }),
  parentesco: z.enum(CLAVES, { message: "Elige el parentesco" }),
  domicilio: opcional,
  anios_conocerlo: z.string().trim().transform((v, ctx) => {
    if (!v) return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 100) { ctx.addIssue({ code: "custom", message: "Escribe los años (0 a 100)" }); return z.NEVER; }
    return n;
  }),
  notas: opcional,
});

export type DatosReferencia = z.output<typeof esquemaReferencia>;

/** El teléfono de una referencia no puede ser el del propio cliente (no sirve para localizarlo). */
export function telefonoDelCliente(ref: string, cliente: string | null): boolean {
  return Boolean(cliente) && ref === cliente;
}

const CAMPOS_REF = ["nombre", "telefono", "parentesco", "domicilio", "anios_conocerlo", "notas"] as const;

/**
 * Referencias en el alta del prospecto (opcionales): una referencia sin nada escrito se omite; si se empezó a
 * llenar, se valida completa. Los campos vienen como `ref1_nombre`, `ref2_telefono`, … y los errores regresan igual.
 */
export function leerReferenciasAlta(valores: Record<string, string | undefined>, telefonoCliente: string | null):
  { referencias: (DatosReferencia & { orden: 1 | 2 })[]; errores: Record<string, string> } {
  const referencias: (DatosReferencia & { orden: 1 | 2 })[] = [];
  const errores: Record<string, string> = {};
  for (const orden of [1, 2] as const) {
    const crudo = Object.fromEntries(CAMPOS_REF.map((c) => [c, (valores[`ref${orden}_${c}`] ?? "").trim()]));
    if (CAMPOS_REF.every((c) => !crudo[c])) continue;
    const r = esquemaReferencia.safeParse(crudo);
    if (!r.success) {
      for (const i of r.error.issues) errores[`ref${orden}_${String(i.path[0])}`] ??= i.message;
      continue;
    }
    if (telefonoDelCliente(r.data.telefono, telefonoCliente)) { errores[`ref${orden}_telefono`] = "Es el teléfono del cliente; pon el de la referencia"; continue; }
    referencias.push({ ...r.data, orden });
  }
  return { referencias, errores };
}
