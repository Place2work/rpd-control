"use server";

// Dinero del caso (secciones 2.2, 5.8 y 9): pagos de la Afore, cobros del honorario y canal
// (vendedor, referidor, socio). Lo registra el usuario con sus permisos (RLS); después el
// motor recalcula las comisiones del caso.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { recalcularComisiones } from "@/lib/dinero/motor";
import { parametrosDinero } from "@/lib/parametros";
import { desglosarTotal, honorarioDePago } from "@/lib/reglas/comisiones";
import { hoyCDMX } from "@/lib/tiempo";
import type { Resultado } from "./acciones";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const monto = z.string().trim().transform((v) => Number(v.replace(/[,$\s]/g, ""))).pipe(z.number({ message: "Escribe un monto" }).finite().min(0, "No puede ser negativo").max(10_000_000));
const fechaPasada = z.iso.date({ message: "Fecha no válida" }).refine((v) => v <= hoyCDMX(), "No puede ser futura");
const METODOS = ["transferencia", "efectivo", "tarjeta"] as const;
const CONCEPTOS = ["pago_inicial", "recuperado", "primera_mensualidad", "honorario"] as const;
const datosDe = (form: FormData) => Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
const errores = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [String(i.path[0]), i.message]));

async function despues(casoId: string) {
  // Si el motor falla, el pago o el cobro ya quedó guardado; la tarea diaria lo reintenta.
  try { await recalcularComisiones([casoId]); } catch (e) { console.error("[comisiones]", casoId, e); }
  revalidatePath(`/casos/${casoId}`);
}

// ───────────── Pagos de la Afore (retiro: hasta 6) ─────────────

const esquemaPago = z.object({ fecha_deposito: fechaPasada, monto_bruto: monto, isr_retenido: monto.optional() })
  .refine((d) => (d.isr_retenido ?? 0) <= d.monto_bruto, { message: "El ISR no puede ser mayor que el bruto", path: ["isr_retenido"] })
  .refine((d) => d.monto_bruto > 0, { message: "Escribe el monto", path: ["monto_bruto"] });

export async function registrarPagoAfore(casoId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol === "vendedor") return { error: "Tu rol no registra pagos." };
  const r = esquemaPago.safeParse({ ...datosDe(form), isr_retenido: datosDe(form).isr_retenido || "0" });
  if (!r.success) return { errores: errores(r.error) };
  const { fecha_deposito, monto_bruto } = r.data;
  const isr = r.data.isr_retenido ?? 0;
  const neto = Math.round((monto_bruto - isr) * 100) / 100;
  const p = await parametrosDinero();

  const res = await conUsuario(claims, async (tx): Promise<Resultado> => {
    const caso = await tx.caso.findUnique({ where: { id: casoId }, select: { tipo_servicio: true, etapa: true, pagos_afore: { where: { archivado_at: null }, select: { numero: true } } } });
    if (!caso) return { error: "No encontramos el caso." };
    if (caso.tipo_servicio !== "RETIRO_DESEMPLEO") return { error: "Los pagos de la Afore son del retiro por desempleo. Para otros servicios registra el cobro." };
    const numero = Math.max(0, ...caso.pagos_afore.map((x) => x.numero)) + 1;
    if (numero > 6) return { error: "Ya hay 6 pagos registrados (máximo de la modalidad B)." };
    const pago = await tx.pagoAfore.create({
      select: { id: true },
      data: { caso_id: casoId, numero, fecha_deposito: dia(fecha_deposito), monto_bruto, isr_retenido: isr, monto_neto: neto, created_by: usuario.id },
    });
    // El honorario se calcula sobre lo que pagó la Afore, no sobre el estimado (2.2).
    const h = honorarioDePago({ bruto: monto_bruto, neto }, p);
    await tx.cobro.create({
      data: { caso_id: casoId, pago_afore_id: pago.id, base_calculo: h.base, honorario_total: h.honorario, subtotal: h.subtotal, iva: h.iva, concepto: "honorario", created_by: usuario.id },
    });
    await tx.evento.create({ data: { caso_id: casoId, tipo: "pago", usuario_id: usuario.id,
      texto: `Pago ${numero} de la Afore: $${neto.toLocaleString("es-MX", { minimumFractionDigits: 2 })} neto. Honorario por cobrar $${h.honorario.toLocaleString("es-MX", { minimumFractionDigits: 2 })}.` } });
    return { ok: true };
  }, ip);
  if (res.ok) await despues(casoId);
  return res;
}

/** Corregir un pago mal capturado: se archiva con motivo (nadie borra) y su cobro pendiente se cancela. */
export async function archivarPagoAfore(casoId: string, pagoId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director") return { error: "Solo el Director corrige pagos registrados." };
  const motivo = String(form.get("motivo") ?? "").trim();
  if (motivo.length < 5) return { errores: { motivo: "Escribe por qué se corrige" } };
  const res = await conUsuario(claims, async (tx): Promise<Resultado> => {
    const pago = await tx.pagoAfore.findFirst({ where: { id: pagoId, caso_id: casoId, archivado_at: null }, include: { cobros: { where: { archivado_at: null } } } });
    if (!pago) return { error: "No encontramos el pago." };
    if (pago.cobros.some((c) => c.estado === "cobrado")) return { error: "Su honorario ya se cobró: cancela primero el cobro." };
    await tx.cobro.updateMany({ where: { pago_afore_id: pagoId, estado: "por_cobrar" }, data: { estado: "cancelado", motivo_cancelacion: `Pago corregido: ${motivo}` } });
    await tx.pagoAfore.update({ where: { id: pagoId }, data: { archivado_at: new Date() } });
    await tx.evento.create({ data: { caso_id: casoId, tipo: "pago", usuario_id: usuario.id, texto: `Pago ${pago.numero} de la Afore archivado: ${motivo}` } });
    return { ok: true };
  }, ip);
  if (res.ok) await despues(casoId);
  return res;
}

// ───────────── Cobros del honorario ─────────────

const esquemaCobrado = z.object({
  fecha_cobro: fechaPasada,
  metodo: z.enum(METODOS, { message: "Elige el método" }),
  referencia: z.string().trim().max(120).optional(),
  factura_folio: z.string().trim().max(60).optional(),
});

export async function marcarCobrado(casoId: string, cobroId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol === "vendedor") return { error: "Tu rol no registra cobros." };
  const r = esquemaCobrado.safeParse(datosDe(form));
  if (!r.success) return { errores: errores(r.error) };
  const d = r.data;
  const res = await conUsuario(claims, async (tx): Promise<Resultado> => {
    const n = await tx.cobro.updateMany({
      where: { id: cobroId, caso_id: casoId, estado: "por_cobrar", archivado_at: null },
      data: { estado: "cobrado", fecha_cobro: dia(d.fecha_cobro), metodo: d.metodo, referencia: d.referencia || null, factura_folio: d.factura_folio || null },
    });
    if (n.count === 0) return { error: "Ese cobro ya no está pendiente." };
    await tx.evento.create({ data: { caso_id: casoId, tipo: "pago", usuario_id: usuario.id, texto: `Honorario cobrado (${d.metodo}${d.factura_folio ? `, factura ${d.factura_folio}` : ""})` } });
    return { ok: true };
  }, ip);
  if (res.ok) await despues(casoId);
  return res;
}

const esquemaCobro = z.object({
  honorario_total: monto.refine((v) => v > 0, "Escribe el monto"),
  concepto: z.enum(CONCEPTOS).optional(),
  base_calculo: monto.optional(),
});

/** Servicios de cuota fija (pensión, M40, fallecimiento...): el honorario se captura con IVA incluido. */
export async function registrarCobro(casoId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol === "vendedor") return { error: "Tu rol no registra cobros." };
  const datos = datosDe(form);
  const r = esquemaCobro.safeParse({ ...datos, base_calculo: datos.base_calculo || undefined, concepto: datos.concepto || undefined });
  if (!r.success) return { errores: errores(r.error) };
  const d = r.data;
  if (d.concepto === "recuperado" && !d.base_calculo) return { errores: { base_calculo: "Captura el monto recuperado" } };
  const { IVA } = await parametrosDinero();
  const h = desglosarTotal(d.honorario_total, IVA);
  const res = await conUsuario(claims, async (tx): Promise<Resultado> => {
    const caso = await tx.caso.findUnique({ where: { id: casoId }, select: { tipo_servicio: true } });
    if (!caso) return { error: "No encontramos el caso." };
    if (caso.tipo_servicio === "RETIRO_DESEMPLEO") return { error: "En el retiro, el cobro nace al registrar el pago de la Afore." };
    await tx.cobro.create({ data: { caso_id: casoId, honorario_total: h.honorario, subtotal: h.subtotal, iva: h.iva, concepto: d.concepto ?? "honorario", base_calculo: d.base_calculo ?? null, created_by: usuario.id } });
    return { ok: true };
  }, ip);
  if (res.ok) await despues(casoId);
  return res;
}

export async function cancelarCobro(casoId: string, cobroId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director") return { error: "Solo el Director cancela cobros." };
  const motivo = String(form.get("motivo") ?? "").trim();
  if (motivo.length < 5) return { errores: { motivo: "Escribe el motivo" } };
  const res = await conUsuario(claims, async (tx): Promise<Resultado> => {
    const pagadas = await tx.comision.count({ where: { cobro_id: cobroId, estado: "pagada" } });
    if (pagadas) return { error: "Ese cobro ya tiene comisiones pagadas; no se puede cancelar." };
    const n = await tx.cobro.updateMany({ where: { id: cobroId, caso_id: casoId, estado: { not: "cancelado" } }, data: { estado: "cancelado", motivo_cancelacion: motivo } });
    if (!n.count) return { error: "Ese cobro ya estaba cancelado." };
    await tx.evento.create({ data: { caso_id: casoId, tipo: "pago", usuario_id: usuario.id, texto: `Cobro cancelado: ${motivo}` } });
    return { ok: true };
  }, ip);
  if (res.ok) await despues(casoId);
  return res;
}

// ───────────── Canal: vendedor, referidor y socio ─────────────

export async function guardarCanal(casoId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director" && usuario.rol !== "asesor") return { error: "Solo el Director o el asesor cambian el canal." };
  const uuid = (k: string) => {
    const v = String(form.get(k) ?? "");
    return /^[0-9a-f-]{36}$/i.test(v) ? v : null;
  };
  const vendedor_id = uuid("vendedor_id");
  const referidor_id = uuid("referidor_id");
  const socio_id = uuid("socio_id");
  // Vendedor y referidor a la vez: lo confirma Irving (9.1).
  if (vendedor_id && referidor_id && (usuario.rol !== "director" || form.get("confirmo_doble") !== "si")) {
    return { error: usuario.rol === "director"
      ? "El caso tendría vendedor y referidor: marca la casilla para confirmar que ambos cobran comisión."
      : "Un caso con vendedor y referidor a la vez lo confirma el Director." };
  }
  const res = await conUsuario(claims, async (tx): Promise<Resultado> => {
    if (vendedor_id && !(await tx.usuario.findFirst({ where: { id: vendedor_id, rol: "vendedor", activo: true }, select: { id: true } }))) return { errores: { vendedor_id: "No es un vendedor activo" } };
    const n = await tx.caso.updateMany({ where: { id: casoId }, data: { vendedor_id, referidor_id, socio_id } });
    if (!n.count) return { error: "No encontramos el caso." };
    await tx.evento.create({ data: { caso_id: casoId, tipo: "sistema", usuario_id: usuario.id, texto: "Se actualizó el canal (vendedor, referidor o socio)" } });
    return { ok: true };
  }, ip);
  if (res.ok) await despues(casoId);
  return res;
}
