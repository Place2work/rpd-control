"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesion } from "@/lib/auth/sesion";
import { leerBenef } from "@/lib/comisiones/consultas";
import { cifrar } from "@/lib/cripto";
import { conUsuario } from "@/lib/db/prisma";
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
  await conUsuario(claims, (tx) => tx.referidor.create({ select: { id: true }, data: { ...d, ...cuenta(c), created_by: usuario.id } }), ip);
  revalidatePath("/comisiones/beneficiarios");
  return { ok: true };
}

export async function crearSocio(_p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director") return { error: "Solo el Director da de alta socios." };
  const pct = z.string().trim().transform((v) => Number(v.replace("%", "")) / 100).pipe(z.number().min(0, "Entre 0 y 100").max(1, "Entre 0 y 100"));
  const pesos = z.string().trim().transform((v) => Number(v.replace(/[,$\s]/g, ""))).pipe(z.number().min(0, "No puede ser negativo"));
  const r = z.object({ ...contacto, razon_social: opcional, rfc: opcional, porcentaje_socio: pct, costo_administrativo: pesos }).safeParse(datosDe(form));
  if (!r.success) return { errores: errores(r.error) };
  const { clabe: c, ...d } = r.data;
  await conUsuario(claims, (tx) => tx.socio.create({ select: { id: true }, data: { ...d, rfc: d.rfc?.toUpperCase(), ...cuenta(c), created_by: usuario.id } }), ip);
  revalidatePath("/comisiones/beneficiarios");
  return { ok: true };
}
