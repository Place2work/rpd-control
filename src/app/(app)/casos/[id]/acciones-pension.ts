"use server";

// Plan y pagos de Modalidad 40 (7.6). Con RLS: los opera quien opera el caso (no el vendedor).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { parametrosPension } from "@/lib/parametros";
import { limitePagoM40, mesesPlanM40 } from "@/lib/reglas/pension";
import { hoyCDMX } from "@/lib/tiempo";
import type { Resultado } from "./acciones";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const datosDe = (form: FormData) =>
  Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string").map(([k, v]) => [k, String(v).trim()])) as Record<string, string>;
const errores = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [String(i.path[0]), i.message]));
const numero = (max: number) => z.string().optional().transform((v) => (v ? Number(v.replace(/[,$\s]/g, "")) : null)).pipe(z.number({ message: "Número no válido" }).min(0, "No puede ser negativo").max(max).nullable());
const mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Elige el mes");

const esquemaPlan = z.object({
  m40_desde: mes, m40_hasta: mes,
  m40_salario: numero(100_000), m40_monto: numero(1_000_000).refine((v) => v !== null && v > 0, "Escribe el pago mensual"),
  semanas_ultimos_5_anios: numero(300),
}).refine((d) => d.m40_hasta >= d.m40_desde, { message: "El último mes no puede ser antes del primero", path: ["m40_hasta"] })
  .refine((d) => mesesPlanM40(`${d.m40_desde}-01`, `${d.m40_hasta}-01`).length <= 120, { message: "Máximo 10 años de pagos", path: ["m40_hasta"] });

/** Guarda el plan y programa un pago pendiente por mes. Meses que salen del plan y no se pagaron se archivan. */
export async function guardarPlanM40(casoId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await obtenerSesion();
  if (s.usuario.rol === "vendedor") return { error: "El plan de M40 lo lleva el asesor." };
  const r = esquemaPlan.safeParse(datosDe(form));
  if (!r.success) return { errores: errores(r.error) };
  const d = r.data;
  const p = await parametrosPension();
  const meses = mesesPlanM40(`${d.m40_desde}-01`, `${d.m40_hasta}-01`);
  const res = await conUsuario(s.claims, async (tx): Promise<Resultado> => {
    const n = await tx.caso.updateMany({
      where: { id: casoId },
      data: { m40_desde: dia(meses[0]), m40_hasta: dia(meses[meses.length - 1]), m40_salario: d.m40_salario, m40_monto: d.m40_monto },
    });
    if (!n.count) return { error: "No encontramos el caso." };
    if (d.semanas_ultimos_5_anios !== null) {
      await tx.datosImss.upsert({ where: { caso_id: casoId }, update: { semanas_ultimos_5_anios: d.semanas_ultimos_5_anios }, create: { caso_id: casoId, semanas_ultimos_5_anios: d.semanas_ultimos_5_anios } });
    }
    const existentes = await tx.pagoM40.findMany({ where: { caso_id: casoId }, select: { id: true, mes: true, fecha_pago: true, archivado_at: true } });
    const ya = new Map(existentes.map((x) => [x.mes.toISOString().slice(0, 10), x]));
    const nuevos = meses.filter((m) => !ya.has(m));
    if (nuevos.length) {
      await tx.pagoM40.createMany({ data: nuevos.map((m) => ({ caso_id: casoId, mes: dia(m), monto: d.m40_monto!, fecha_limite: dia(limitePagoM40(m, p)), created_by: s.usuario.id })) });
    }
    // Pendientes del plan: monto actualizado y reactivados si se habían archivado.
    await tx.pagoM40.updateMany({ where: { caso_id: casoId, fecha_pago: null, mes: { in: meses.map(dia) } }, data: { monto: d.m40_monto!, archivado_at: null } });
    // Fuera del plan y sin pagar: se archivan (nadie borra).
    await tx.pagoM40.updateMany({ where: { caso_id: casoId, fecha_pago: null, archivado_at: null, mes: { notIn: meses.map(dia) } }, data: { archivado_at: new Date() } });
    await tx.evento.create({ data: { caso_id: casoId, tipo: "sistema", usuario_id: s.usuario.id, texto: `Plan de Modalidad 40: ${meses.length} meses (${d.m40_desde} a ${d.m40_hasta}), $${d.m40_monto!.toLocaleString("es-MX", { minimumFractionDigits: 2 })} al mes` } });
    return { ok: true };
  }, s.ip);
  if (res.ok) revalidatePath(`/casos/${casoId}`);
  return res;
}

export async function registrarPagoM40(casoId: string, pagoId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await obtenerSesion();
  if (s.usuario.rol === "vendedor") return { error: "Los pagos de M40 los registra el asesor." };
  const r = z.object({ fecha_pago: z.iso.date({ message: "Fecha no válida" }).refine((v) => v <= hoyCDMX(), "No puede ser futura") }).safeParse(datosDe(form));
  if (!r.success) return { errores: errores(r.error) };
  const res = await conUsuario(s.claims, async (tx): Promise<Resultado> => {
    const pago = await tx.pagoM40.findFirst({ where: { id: pagoId, caso_id: casoId, archivado_at: null }, select: { mes: true, fecha_pago: true } });
    if (!pago) return { error: "No encontramos el pago." };
    if (pago.fecha_pago) return { error: "Ese mes ya está pagado." };
    await tx.pagoM40.update({ where: { id: pagoId }, data: { fecha_pago: dia(r.data.fecha_pago) }, select: { id: true } });
    await tx.evento.create({ data: { caso_id: casoId, tipo: "pago", usuario_id: s.usuario.id, texto: `Pago de Modalidad 40 de ${pago.mes.toISOString().slice(0, 7)} registrado (${r.data.fecha_pago})` } });
    // La alerta del mes pagado ya no aplica.
    await tx.alerta.updateMany({ where: { caso_id: casoId, estado: "activa", clave_dedup: { contains: pagoId } }, data: { estado: "atendida", atendida_por: s.usuario.id, atendida_at: new Date() } });
    return { ok: true };
  }, s.ip);
  if (res.ok) revalidatePath(`/casos/${casoId}`);
  return res;
}
