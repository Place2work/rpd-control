"use server";

// Datos que pide el contrato y que no viven en otra pestaña: domicilio e identificación del
// cliente, la beneficiaria y el finado (fallecimiento) y las condiciones del caso.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesion } from "@/lib/auth/sesion";
import { cifrar } from "@/lib/cripto";
import { conUsuario } from "@/lib/db/prisma";
import { curpParcial, validarCurp, validarNss } from "@/lib/reglas/identificadores";
import type { Resultado } from "./acciones";

const datosDe = (form: FormData) =>
  Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string").map(([k, v]) => [k, String(v).trim()])) as Record<string, string>;
const opcional = (max = 300) => z.string().max(max, `Máximo ${max} caracteres`).optional().transform((v) => (v ? v : null));
const errores = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [String(i.path[0]), i.message]));
const curp = z.string().optional().superRefine((v, ctx) => { if (v) { const r = validarCurp(v); if (!r.valido) ctx.addIssue({ code: "custom", message: r.error }); } });
const nss = z.string().optional().superRefine((v, ctx) => { if (v) { const r = validarNss(v); if (!r.valido) ctx.addIssue({ code: "custom", message: r.error }); } });

async function puede() {
  const s = await obtenerSesion();
  return s.usuario.rol === "vendedor" ? null : s;
}

export async function guardarClienteContrato(casoId: string, personaId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await puede();
  if (!s) return { error: "El contrato lo prepara el asesor." };
  const r = z.object({ domicilio: opcional(), identificacion: opcional(120), email: z.email("Correo no válido").optional().or(z.literal("")) }).safeParse(datosDe(form));
  if (!r.success) return { errores: errores(r.error) };
  await conUsuario(s.claims, (tx) => tx.persona.update({
    where: { id: personaId }, select: { id: true },
    data: { domicilio: r.data.domicilio, identificacion: r.data.identificacion, email: r.data.email || null },
  }), s.ip);
  revalidatePath(`/casos/${casoId}`);
  return { ok: true };
}

const esquemaParte = z.object({
  nombre: z.string().min(3, "Escribe el nombre completo").max(160),
  curp, nss,
  domicilio: opcional(), identificacion: opcional(120), relacion: opcional(), parentesco_cliente: opcional(60),
  fecha_defuncion: z.union([z.iso.date({ message: "Fecha no válida" }), z.literal("")]).optional(),
  regimen: opcional(120), afore: opcional(60),
});

/** Beneficiaria o finado. CURP y NSS solo se reemplazan si se escribe uno nuevo (el actual no viaja al navegador). */
export async function guardarParte(casoId: string, rol: "beneficiaria" | "finado", _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await puede();
  if (!s) return { error: "El contrato lo prepara el asesor." };
  const r = esquemaParte.safeParse(datosDe(form));
  if (!r.success) return { errores: errores(r.error) };
  const d = r.data;
  const data = {
    nombre: d.nombre, domicilio: d.domicilio, identificacion: d.identificacion, relacion: d.relacion, parentesco_cliente: d.parentesco_cliente,
    fecha_defuncion: d.fecha_defuncion ? new Date(`${d.fecha_defuncion}T00:00:00Z`) : null, regimen: d.regimen, afore: d.afore,
    ...(d.curp ? (() => { const v = validarCurp(d.curp!).valor; return { curp_cifrada: cifrar(v), curp_parcial: curpParcial(v) }; })() : {}),
    ...(d.nss ? (() => { const v = validarNss(d.nss!).valor; return { nss_cifrado: cifrar(v), nss_ultimos4: v.slice(-4) }; })() : {}),
  };
  const res = await conUsuario(s.claims, async (tx): Promise<Resultado> => {
    const caso = await tx.caso.findUnique({ where: { id: casoId }, select: { id: true } });
    if (!caso) return { error: "No encontramos el caso." };
    const actual = await tx.parteCaso.findFirst({ where: { caso_id: casoId, rol, archivado_at: null }, select: { id: true } });
    if (actual) await tx.parteCaso.update({ where: { id: actual.id }, data, select: { id: true } });
    else await tx.parteCaso.create({ data: { ...data, caso_id: casoId, rol, created_by: s.usuario.id }, select: { id: true } });
    return { ok: true };
  }, s.ip);
  if (res.ok) revalidatePath(`/casos/${casoId}`);
  return res;
}

export async function guardarCondiciones(casoId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await puede();
  if (!s) return { error: "El contrato lo prepara el asesor." };
  const pesos = z.string().optional().transform((v) => (v ? Number(v.replace(/[,$\s]/g, "")) : null)).pipe(z.number().min(0, "No puede ser negativo").max(10_000_000).nullable());
  const pct = z.string().optional().transform((v) => (v ? Number(v.replace("%", "")) / 100 : null)).pipe(z.number().min(0, "Entre 0 y 100").max(1, "Entre 0 y 100").nullable());
  const r = z.object({ honorario_fijo: pesos, contrato_pct: pct, contrato_advertencias: opcional(4000), contrato_regularizacion: opcional(300) }).safeParse(datosDe(form));
  if (!r.success) return { errores: errores(r.error) };
  const n = await conUsuario(s.claims, (tx) => tx.caso.updateMany({ where: { id: casoId }, data: r.data }), s.ip);
  if (!n.count) return { error: "No encontramos el caso." };
  revalidatePath(`/casos/${casoId}`);
  return { ok: true };
}
