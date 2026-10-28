// Lo que manda el formulario de precalificación del sitio. Solo lo mínimo para contactar;
// CURP y NSS se piden después, por WhatsApp, ya con el asesor.
import { z } from "zod";
import { normalizarWhatsapp } from "@/lib/prospectos/validacion";

const SERVICIO = { retiro: "RETIRO_DESEMPLEO", pension_l73: "PENSION_L73" } as const;
const texto = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

export const esquemaLead = z
  .object({
    nombre: z.string().trim().min(2).max(80),
    apellido_paterno: texto(80),
    apellido_materno: texto(80),
    whatsapp: z.string().trim().refine((v) => normalizarWhatsapp(v) !== null, "WhatsApp no válido"),
    email: z.email().max(120).optional(),
    servicio: z.enum(["retiro", "pension_l73"]),
    fecha_baja: z.iso.date().optional(),
    mensaje: texto(1000),
    // El aviso de privacidad es obligatorio en el formulario: sin casilla no se guarda nada.
    privacidad_aceptada: z.literal(true, { message: "Falta aceptar el aviso de privacidad" }),
    ip_cliente: z.union([z.ipv4(), z.ipv6()]).optional(),
    utm: z.record(z.string().max(40), z.string().max(200)).optional(),
  })
  .transform((d) => ({ ...d, whatsapp: normalizarWhatsapp(d.whatsapp)!, tipo_servicio: SERVICIO[d.servicio] }));

export type Lead = z.output<typeof esquemaLead>;
