"use server";

// Pago de una comisión desde el expediente (Director): fecha de pago, método, referencia y comprobante de la
// transferencia. Queda como una liquidación de una sola comisión, igual que las del mes en Comisiones, para que el
// estado de cuenta y los reportes la cuenten igual. El comprobante va en la carpeta del caso (bucket expedientes).
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { prepararSubida, urlLectura, type Subida } from "@/lib/documentos/almacen";
import { rutaDocumento, validarComprobante } from "@/lib/documentos/reglas";
import { mxn } from "@/lib/formato";
import { hoyCDMX } from "@/lib/tiempo";
import type { Resultado } from "./acciones";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoDia = (d: Date) => d.toISOString().slice(0, 10);
const RUTA = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z]{3,4}$/;

const esquema = z.object({
  fecha_pago: z.iso.date({ message: "Fecha no válida" }).refine((v) => v <= hoyCDMX(), "No puede ser futura"),
  metodo: z.enum(["transferencia", "efectivo", "tarjeta"], { message: "Elige el método" }),
  referencia: z.string().trim().max(120).optional(),
  comprobante_ruta: z.string().optional(),
  comprobante_mime: z.string().optional(),
});

/** Liga firmada para subir el comprobante del pago de la comisión (antes o después de registrar el pago). */
export async function prepararComprobanteComision(casoId: string, comisionId: string, mime: string, bytes: number): Promise<{ subida?: Subida; error?: string }> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director") return { error: "Solo el Director registra pagos de comisiones." };
  const problema = validarComprobante(mime, bytes);
  if (problema) return { error: problema };
  const k = await conUsuario(claims, (tx) => tx.comision.findFirst({ where: { id: comisionId, caso_id: casoId, archivado_at: null, estado: { in: ["devengada", "pagada"] } }, select: { id: true } }), ip);
  if (!k) return { error: "No encontramos esa comisión." };
  try {
    return { subida: await prepararSubida(rutaDocumento(casoId, randomUUID(), mime)) };
  } catch {
    return { error: "No se pudo preparar la subida. Intenta de nuevo." };
  }
}

/** Marca la comisión como pagada con su fecha y, si se subió, el comprobante. */
export async function pagarComision(casoId: string, comisionId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director") return { error: "Solo el Director registra pagos de comisiones." };
  const datos = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const r = esquema.safeParse(datos);
  if (!r.success) return { errores: Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const d = r.data;
  const ruta = d.comprobante_ruta || null;
  if (ruta && (!ruta.startsWith(`${casoId}/`) || !RUTA.test(ruta) || validarComprobante(d.comprobante_mime ?? "", 1))) return { error: "El comprobante no es válido; vuelve a subirlo." };
  const res = await conUsuario(claims, async (tx): Promise<Resultado> => {
    const k = await tx.comision.findFirst({ where: { id: comisionId, caso_id: casoId, archivado_at: null }, select: { estado: true, monto: true, fecha_devengo: true, beneficiario_tipo: true, beneficiario_id: true } });
    if (!k) return { error: "No encontramos esa comisión." };
    if (k.estado !== "devengada") return { error: k.estado === "pagada" ? "Esa comisión ya está pagada." : "Solo se pagan comisiones devengadas (cuando ya se cobró el honorario)." };
    if (k.fecha_devengo && d.fecha_pago < isoDia(k.fecha_devengo)) return { errores: { fecha_pago: "No puede ser antes de que se devengara" } };
    const periodo = dia(`${isoDia(k.fecha_devengo ?? dia(d.fecha_pago)).slice(0, 7)}-01`);
    const liq = await tx.liquidacion.create({ select: { id: true }, data: {
      beneficiario_tipo: k.beneficiario_tipo, beneficiario_id: k.beneficiario_id, periodo, total: k.monto, fecha_pago: dia(d.fecha_pago), metodo: d.metodo,
      referencia: d.referencia || null, created_by: usuario.id,
    } });
    const n = await tx.comision.updateMany({ where: { id: comisionId, estado: "devengada" }, data: {
      estado: "pagada", fecha_pago: dia(d.fecha_pago), metodo_pago: d.metodo, referencia_pago: d.referencia || null, liquidacion_id: liq.id,
      ...(ruta ? { comprobante_path: ruta, comprobante_mime: d.comprobante_mime, comprobante_at: new Date(), comprobante_por: usuario.id } : {}),
    } });
    if (n.count !== 1) throw new Error("La comisión cambió mientras se pagaba. Intenta de nuevo.");
    await tx.evento.create({ data: { caso_id: casoId, tipo: "sistema", usuario_id: usuario.id,
      texto: `Se pagó la comisión de ${mxn(k.monto)} el ${d.fecha_pago.split("-").reverse().join("/")} (${d.metodo})${ruta ? " con comprobante" : ""}.` } });
    return { ok: true, mensaje: "Comisión pagada." };
  }, ip).catch((e: Error): Resultado => ({ error: e.message }));
  if (res.ok) { revalidatePath(`/casos/${casoId}`); revalidatePath("/comisiones"); }
  return res;
}

/** Sube o reemplaza el comprobante de una comisión ya pagada. */
export async function registrarComprobanteComision(casoId: string, comisionId: string, ruta: string, mime: string): Promise<{ ok?: boolean; error?: string }> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director") return { error: "Solo el Director sube comprobantes de comisiones." };
  if (!ruta.startsWith(`${casoId}/`) || !RUTA.test(ruta) || validarComprobante(mime, 1)) return { error: "Archivo no válido." };
  const res = await conUsuario(claims, async (tx) => {
    const n = await tx.comision.updateMany({ where: { id: comisionId, caso_id: casoId, estado: "pagada", archivado_at: null },
      data: { comprobante_path: ruta, comprobante_mime: mime, comprobante_at: new Date(), comprobante_por: usuario.id } });
    if (!n.count) return { error: "Primero registra el pago de la comisión." };
    await tx.evento.create({ data: { caso_id: casoId, tipo: "documento", usuario_id: usuario.id, texto: "Se subió el comprobante del pago de la comisión" } });
    return { ok: true };
  }, ip);
  if (res.ok) revalidatePath(`/casos/${casoId}`);
  return res;
}

/** Liga de 10 minutos para ver el comprobante: el Director y el beneficiario (RLS de la comisión y del bucket). */
export async function verComprobanteComision(casoId: string, comisionId: string): Promise<{ url?: string; error?: string }> {
  const { claims, ip } = await obtenerSesion();
  const k = await conUsuario(claims, (tx) => tx.comision.findFirst({ where: { id: comisionId, caso_id: casoId }, select: { comprobante_path: true } }), ip);
  if (!k?.comprobante_path) return { error: "Esta comisión no tiene comprobante." };
  try {
    return { url: await urlLectura(k.comprobante_path) };
  } catch {
    return { error: "No se pudo abrir el comprobante." };
  }
}
