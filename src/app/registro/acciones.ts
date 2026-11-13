"use server";

// Registro desde el QR del gerente de campo (formulario público, sin sesión). Corre como proceso del sistema, como
// /api/leads: la persona no tiene cuenta. Solo crea un prospecto de campo pendiente a nombre del gerente dueño del
// código; el analista lo verifica y entonces se vuelve cliente.
import { headers } from "next/headers";
import { prismaSistema } from "@/lib/db/prisma";
import { cifrar, hashIdentificador, hashToken } from "@/lib/cripto";
import { selloValido } from "@/lib/campo/formulario";
import { parametrosVigentes } from "@/lib/parametros";
import { whatsappMx } from "@/lib/reglas/campo";
import { curpParcial, validarCurp } from "@/lib/reglas/identificadores";
import { hoyCDMX } from "@/lib/tiempo";

export type EstadoRegistro = { ok?: boolean; errores?: Record<string, string>; error?: string };
const txt = (f: FormData, k: string, max = 120) => String(f.get(k) ?? "").trim().slice(0, max);
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);

export async function registrarDesdeQr(codigo: string, _p: EstadoRegistro, form: FormData): Promise<EstadoRegistro> {
  // Robots: campo trampa lleno o sello de tiempo inválido. Se responde «listo» sin guardar nada.
  if (txt(form, "sitio") || !selloValido(txt(form, "t", 80))) return { ok: true };
  if (!/^[a-z0-9]{8}$/.test(codigo)) return { error: "Esta liga no es válida. Pide al promotor que te muestre su QR." };

  const nombre = txt(form, "nombre"), municipio = txt(form, "municipio", 80), servicio = txt(form, "tipo_servicio", 40);
  const whatsapp = whatsappMx(txt(form, "whatsapp", 30));
  const errores: Record<string, string> = {};
  if (nombre.length < 2) errores.nombre = "Escribe tu nombre";
  if (!whatsapp) errores.whatsapp = "Escribe tu WhatsApp a 10 dígitos";
  if (municipio.length < 2) errores.municipio = "Escribe tu municipio";
  // CURP opcional; si la escribe, tiene que ser válida (formato y dígito verificador).
  const curpTexto = txt(form, "curp", 30);
  const curp = curpTexto ? validarCurp(curpTexto) : null;
  if (curp && !curp.valido) errores.curp = `${curp.error}. Revísala o déjala en blanco`;
  if (form.get("acepto") !== "si") errores.acepto = "Para registrarte necesitas aceptar el aviso de privacidad";
  if (Object.keys(errores).length) return { errores };

  const db = prismaSistema;
  const gerente = await db.usuario.findFirst({ where: { campo_codigo: codigo, rol: "campo", activo: true, archivado_at: null }, select: { id: true, nombre: true } });
  if (!gerente) return { error: "Esta liga ya no está activa. Pide al promotor que te muestre su QR." };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "sin-ip";
  const ipHash = hashToken(`ip:${ip}`);
  const { CAMPO_FORMULARIO_MAX_HORA, PRIVACIDAD_VERSION } = await parametrosVigentes(["CAMPO_FORMULARIO_MAX_HORA", "PRIVACIDAD_VERSION"]);
  const recientes = await db.campoProspecto.count({ where: { ip_hash: ipHash, created_at: { gte: new Date(Date.now() - 3600_000) } } });
  if (recientes >= Number(CAMPO_FORMULARIO_MAX_HORA ?? 5)) return { error: "Ya recibimos varios registros desde este teléfono. Intenta más tarde o pide ayuda al promotor." };

  // Si ya está registrado (cliente o prospecto de campo vivo) no se duplica ni se le dice: se le confirma igual.
  const curpHash = curp?.valido ? hashIdentificador("curp", curp.valor) : null;
  const repetido = await db.persona.findFirst({ where: { OR: [{ telefono: whatsapp! }, { whatsapp: whatsapp! }, ...(curpHash ? [{ curp_hash: curpHash }] : [])] }, select: { id: true } })
    ?? await db.campoProspecto.findFirst({ where: { OR: [{ whatsapp: whatsapp! }, ...(curpHash ? [{ curp_hash: curpHash }] : [])], estado: { not: "rechazado" }, archivado_at: null }, select: { id: true } });
  if (repetido) return { ok: true };

  const hoy = hoyCDMX();
  const jornada = await db.campoJornada.findFirst({ where: { gerente_id: gerente.id, fecha: dia(hoy), estado: { not: "rechazada" } }, select: { lugar: true } });
  const valido = servicio ? await db.tipoServicio.findFirst({ where: { clave: servicio, activo: true }, select: { clave: true } }) : null;
  const nuevo = await db.campoProspecto.create({ select: { id: true }, data: {
    gerente_id: gerente.id, nombre, whatsapp: whatsapp!, municipio, lugar: jornada?.lugar ?? null, tipo_servicio: valido?.clave ?? null,
    origen: "formulario", privacidad_aceptada_at: new Date(), privacidad_version: PRIVACIDAD_VERSION ?? null, ip_hash: ipHash,
    ...(curp?.valido ? { curp_cifrada: cifrar(curp.valor), curp_hash: curpHash, curp_parcial: curpParcial(curp.valor) } : {}),
  } });

  // Aviso al analista (y al Director) para que lo llame pronto.
  const para = await db.usuario.findMany({ where: { rol: { in: ["asesor", "director"] }, activo: true, archivado_at: null }, select: { id: true } });
  await db.alerta.createMany({ skipDuplicates: true, data: para.map((u) => ({
    regla: "CAMPO_QR_NUEVO", caso_id: null, severidad: "aviso" as const, asignado_a: u.id, fecha_disparo: dia(hoy), clave_dedup: `CAMPO_QR_NUEVO:${nuevo.id}`,
    mensaje: `${nombre} se registró con el QR de ${gerente.nombre} (${municipio}). Llámale para verificarlo.`,
  })) });
  return { ok: true };
}
