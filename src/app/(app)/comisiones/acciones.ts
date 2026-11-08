"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesion } from "@/lib/auth/sesion";
import { leerBenef } from "@/lib/comisiones/consultas";
import { cifrar } from "@/lib/cripto";
import { conUsuario } from "@/lib/db/prisma";
import { recalcularComisiones } from "@/lib/dinero/motor";
import { finDeMes, sumar } from "@/lib/reglas/comisiones";
import { normalizarClabe, validarClabe } from "@/lib/reglas/identificadores";
import { hoyCDMX } from "@/lib/tiempo";

export type Resultado = { ok?: boolean; error?: string; errores?: Record<string, string>; faltantes?: string[] };
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const datosDe = (form: FormData) => Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
const errores = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [String(i.path[0]), i.message]));

// ───────────── 9.3 Marcar como pagada ─────────────

const esquemaPago = z.object({
  fecha_pago: z.iso.date({ message: "Fecha no válida" }).refine((v) => v <= hoyCDMX(), "No puede ser futura"),
  metodo: z.enum(["transferencia", "efectivo", "tarjeta"], { message: "Elige el método" }),
  referencia: z.string().trim().max(120).optional(),
});

/** Liquida todas las comisiones devengadas del beneficiario en el mes, en una sola liquidación. */
export async function liquidar(benefClave: string, mes: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director") return { error: "Solo el Director liquida comisiones." };
  const benef = leerBenef(benefClave);
  if (!benef || !/^\d{4}-\d{2}$/.test(mes)) return { error: "Beneficiario o mes no válido." };
  const r = esquemaPago.safeParse(datosDe(form));
  if (!r.success) return { errores: errores(r.error) };
  const d = r.data;
  const res = await conUsuario(claims, async (tx): Promise<Resultado> => {
    const lista = await tx.comision.findMany({
      where: { beneficiario_tipo: benef.tipo, beneficiario_id: benef.id, estado: "devengada", archivado_at: null, fecha_devengo: { gte: dia(`${mes}-01`), lte: dia(finDeMes(mes)) } },
      select: { id: true, monto: true },
    });
    if (!lista.length) return { error: "No hay comisiones devengadas por pagar en ese mes." };
    const total = sumar(lista.map((c) => Number(c.monto)));
    const liq = await tx.liquidacion.create({
      select: { id: true },
      data: { beneficiario_tipo: benef.tipo, beneficiario_id: benef.id, periodo: dia(`${mes}-01`), total, fecha_pago: dia(d.fecha_pago), metodo: d.metodo, referencia: d.referencia || null, created_by: usuario.id },
    });
    const n = await tx.comision.updateMany({
      where: { id: { in: lista.map((c) => c.id) }, estado: "devengada" },
      data: { estado: "pagada", fecha_pago: dia(d.fecha_pago), metodo_pago: d.metodo, referencia_pago: d.referencia || null, liquidacion_id: liq.id },
    });
    // Si otra persona liquidó al mismo tiempo, se revierte todo.
    if (n.count !== lista.length) throw new Error("Las comisiones cambiaron mientras se liquidaban. Intenta de nuevo.");
    return { ok: true };
  }, ip).catch((e: Error): Resultado => ({ error: e.message }));
  if (res.ok) revalidatePath("/comisiones");
  return res;
}

// ───────────── Alta de referidores y socios ─────────────

const opcional = z.string().trim().max(200).optional().transform((v) => (v ? v : undefined));
const clabe = opcional.superRefine((v, ctx) => {
  const r = v ? validarClabe(v) : null;
  if (r && !r.valido) ctx.addIssue({ code: "custom", message: r.error });
});
const contacto = { nombre: z.string().trim().min(2, "Escribe el nombre").max(120), telefono: opcional, email: z.email("Correo no válido").optional().or(z.literal("").transform(() => undefined)), banco: opcional, clabe };
const cuenta = (v?: string) => (v ? { clabe_cifrada: cifrar(normalizarClabe(v)), clabe_ultimos4: normalizarClabe(v).slice(-4) } : {});

export async function crearReferidor(_p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director" && usuario.rol !== "asesor") return { error: "Solo el Director o el asesor dan de alta referidores." };
  const r = z.object({ ...contacto, notas: opcional }).safeParse(datosDe(form));
  if (!r.success) return { errores: errores(r.error) };
  const { clabe: c, ...d } = r.data;
  const res = await conUsuario(claims, async (tx): Promise<Resultado> => {
    // Evita el doble alta (p. ej. dar dos veces «Dar de alta»): el mismo nombre ya registrado se avisa.
    if (await tx.referidor.findFirst({ where: { archivado_at: null, nombre: { equals: d.nombre.trim(), mode: "insensitive" } }, select: { id: true } })) {
      return { errores: { nombre: "Ya hay un referidor con ese nombre" } };
    }
    await tx.referidor.create({ select: { id: true }, data: { ...d, ...cuenta(c), created_by: usuario.id } });
    return { ok: true };
  }, ip);
  if (!res.ok) return res;
  revalidatePath("/comisiones/beneficiarios");
  return { ok: true };
}

const pct = z.string().trim().min(1, "Escribe el %").transform((v) => Math.round(Number(v.replace("%", "").replace(",", ".")) * 100) / 10000)
  .pipe(z.number({ message: "Escribe el %" }).min(0, "Entre 0 y 100").max(1, "Entre 0 y 100"));

/** % propio de un asesor de pensiones (el costo administrativo es el del alta de cada cliente). Sus comisiones no pagadas se recalculan; las pagadas no cambian. */
export async function actualizarReparto(socioId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director") return { error: "Solo el Director ajusta el reparto." };
  const r = z.object({ porcentaje_socio: pct }).safeParse(datosDe(form));
  if (!r.success) return { errores: errores(r.error) };
  const casos = await conUsuario(claims, async (tx) => {
    const n = await tx.socio.updateMany({ where: { id: socioId, archivado_at: null }, data: r.data });
    if (!n.count) return null;
    return tx.caso.findMany({ where: { socio_id: socioId }, select: { id: true } });
  }, ip);
  if (!casos) return { error: "No encontramos al asesor." };
  if (casos.length) {
    try { await recalcularComisiones(casos.map((c) => c.id)); } catch (e) { console.error("[comisiones]", socioId, e); }
  }
  revalidatePath("/comisiones/beneficiarios");
  revalidatePath("/comisiones");
  return { ok: true };
}

export async function crearSocio(_p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director") return { error: "Solo el Director da de alta asesores de pensiones." };
  const r = z.object({ ...contacto, razon_social: opcional, rfc: opcional, porcentaje_socio: pct }).safeParse(datosDe(form));
  if (!r.success) return { errores: errores(r.error) };
  const { clabe: c, ...d } = r.data;
  const res = await conUsuario(claims, async (tx): Promise<Resultado> => {
    if (await tx.socio.findFirst({ where: { archivado_at: null, nombre: { equals: d.nombre.trim(), mode: "insensitive" } }, select: { id: true } })) {
      return { errores: { nombre: "Ya hay un asesor de pensiones con ese nombre" } };
    }
    await tx.socio.create({ select: { id: true }, data: { ...d, rfc: d.rfc?.toUpperCase(), ...cuenta(c), created_by: usuario.id } });
    return { ok: true };
  }, ip);
  if (!res.ok) return res;
  revalidatePath("/comisiones/beneficiarios");
  return { ok: true };
}
