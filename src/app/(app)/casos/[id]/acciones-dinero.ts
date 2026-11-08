"use server";

// Dinero del caso (secciones 2.2, 5.8 y 9): pagos de la Afore, cobros del honorario y canal
// (vendedor, referidor, socio). Lo registra el usuario con sus permisos (RLS); después el
// motor recalcula las comisiones del caso.
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesion } from "@/lib/auth/sesion";
import { conUsuario, type Tx } from "@/lib/db/prisma";
import { prepararSubida, urlLectura, type Subida } from "@/lib/documentos/almacen";
import { rutaDocumento, validarComprobante } from "@/lib/documentos/reglas";
import { etapaPorDinero, NOMBRE_ETAPA } from "@/lib/reglas/etapas";
import { recalcularComisiones } from "@/lib/dinero/motor";
import { parametrosDinero, parametrosFechas, parametrosVigentes } from "@/lib/parametros";
import { fechaProximoRetiro } from "@/lib/reglas/alertas";
import { desglosarTotal, honorarioDePago, leerPctPactado, pagoRepetido, pagosAforePermitidos, pctHonorarioRetiro } from "@/lib/reglas/comisiones";
import { leerCostoAlta } from "@/lib/reglas/costo-alta";
import { mxn } from "@/lib/formato";
import { hoyCDMX } from "@/lib/tiempo";
import type { Resultado } from "./acciones";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fechaLarga = (iso: string) => new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "UTC" }).format(dia(iso));
const monto = z.string().trim().transform((v) => Number(v.replace(/[,$\s]/g, ""))).pipe(z.number({ message: "Escribe un monto" }).finite().min(0, "No puede ser negativo").max(10_000_000));
// Fechas reales de dinero: ni futuras ni absurdas (un «01/01/0001» puesto para salir del paso no pasa).
const FECHA_MINIMA = "2000-01-01";
const fechaPasada = z.string().min(1, "Escribe la fecha").pipe(z.iso.date({ message: "Fecha no válida" }))
  .refine((v) => v <= hoyCDMX(), "No puede ser futura").refine((v) => v >= FECHA_MINIMA, "Revisa el año: la fecha no es válida");
const METODOS = ["transferencia", "efectivo", "tarjeta"] as const;
const CONCEPTOS = ["pago_inicial", "recuperado", "primera_mensualidad", "honorario"] as const;
const datosDe = (form: FormData) => Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
const errores = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [String(i.path[0]), i.message]));

async function despues(casoId: string) {
  // Si el motor falla, el pago o el cobro ya quedó guardado; la tarea diaria lo reintenta.
  try { await recalcularComisiones([casoId]); } catch (e) { console.error("[comisiones]", casoId, e); }
  revalidatePath(`/casos/${casoId}`);
}

/** Retiro: el dinero registrado mueve la etapa (pago de la Afore → Pagado; honorario cobrado → cerrado). */
async function moverPorDinero(tx: Tx, casoId: string, usuarioId: string) {
  const caso = await tx.caso.findUnique({ where: { id: casoId }, select: {
    etapa: true, tipo_servicio: true,
    pagos_afore: { where: { archivado_at: null }, select: { id: true } },
    cobros: { where: { archivado_at: null }, select: { estado: true } },
  } });
  if (!caso || caso.tipo_servicio !== "RETIRO_DESEMPLEO") return;
  const destino = etapaPorDinero(caso.etapa, { pagosAfore: caso.pagos_afore.length, cobros: caso.cobros.map((c) => c.estado) });
  if (!destino) return;
  const motivo = destino === "CERRADO" ? "Honorario cobrado" : "Se registró el pago de la Afore";
  await tx.caso.update({ where: { id: casoId }, data: { etapa: destino, etapa_desde: new Date() }, select: { id: true } });
  await tx.historialEtapa.create({ data: { caso_id: casoId, etapa_antes: caso.etapa, etapa_nueva: destino, motivo, usuario_id: usuarioId } });
  await tx.evento.create({ data: { caso_id: casoId, tipo: "cambio_etapa", usuario_id: usuarioId,
    texto: `Avanzó a «${NOMBRE_ETAPA[destino]}» (antes «${NOMBRE_ETAPA[caso.etapa]}») porque ${motivo === "Honorario cobrado" ? "se cobró el honorario" : "se registró el pago de la Afore"}.` } });
}

// ───────────── Honorario pactado (retiro) ─────────────

/** El Director fija el % negociado con el cliente. Vacío = vuelve al parámetro vigente. Aplica a los pagos que se registren después. */
export async function guardarHonorarioPactado(casoId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director") return { error: "Solo el Director cambia el honorario pactado." };
  const leido = leerPctPactado(String(form.get("pct_pactado") ?? ""));
  if ("error" in leido) return { errores: { pct_pactado: leido.error } };
  const p = await parametrosDinero();
  const txt = (x: number) => `${+(x * 100).toFixed(2)}%`;
  const res = await conUsuario(claims, async (tx): Promise<Resultado> => {
    const caso = await tx.caso.findUnique({ where: { id: casoId }, select: { tipo_servicio: true, contrato_pct: true } });
    if (!caso) return { error: "No encontramos el caso." };
    if (caso.tipo_servicio !== "RETIRO_DESEMPLEO") return { error: "El porcentaje pactado es del retiro por desempleo." };
    const antes = pctHonorarioRetiro(caso.contrato_pct === null ? null : Number(caso.contrato_pct), p);
    const despues = pctHonorarioRetiro(leido.pct, p);
    await tx.caso.update({ where: { id: casoId }, data: { contrato_pct: leido.pct }, select: { id: true } });
    await tx.evento.create({ data: { caso_id: casoId, tipo: "sistema", usuario_id: usuario.id,
      texto: leido.pct === null ? `Honorario: vuelve al ${txt(despues)} general (antes ${txt(antes)}).` : `Honorario pactado con el cliente: ${txt(despues)} (antes ${txt(antes)}).`,
      datos: { contrato_pct_antes: antes, contrato_pct: despues } } });
    return { ok: true };
  }, ip);
  if (res.ok) revalidatePath(`/casos/${casoId}`);
  return res;
}

// ───────────── Costo administrativo propio del alta ─────────────

/** Costo administrativo del alta de esta persona: 0 o más; vacío = el general. Se guarda en todos sus casos vivos. */
export async function guardarCostoAlta(casoId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director") return { error: "Solo el Director cambia el costo administrativo." };
  const leido = leerCostoAlta(String(form.get("costo_admin_alta") ?? ""));
  if ("error" in leido) return { errores: { costo_admin_alta: leido.error } };
  const res = await conUsuario(claims, async (tx): Promise<Resultado> => {
    const caso = await tx.caso.findUnique({ where: { id: casoId }, select: { persona_id: true, costo_admin_alta: true } });
    if (!caso) return { error: "No encontramos el caso." };
    const antes = caso.costo_admin_alta === null ? "el general" : mxn(Number(caso.costo_admin_alta));
    await tx.caso.updateMany({ where: { persona_id: caso.persona_id, archivado_at: null }, data: { costo_admin_alta: leido.costo } });
    await tx.evento.create({ data: { caso_id: casoId, tipo: "sistema", usuario_id: usuario.id,
      texto: `Costo administrativo del alta: ${leido.costo === null ? "vuelve al general" : mxn(leido.costo)} (antes ${antes}).`,
      datos: { costo_admin_alta: leido.costo } } });
    return { ok: true };
  }, ip);
  if (res.ok) { revalidatePath(`/casos/${casoId}`); revalidatePath("/hoy"); revalidatePath("/prospectos"); }
  return res;
}

// ───────────── Pago esperado de la Afore (proyección) ─────────────

const esquemaEsperado = z.object({
  monto_esperado: z.string().trim().transform((v) => (v ? Number(v.replace(/[,$\s]/g, "")) : null))
    .pipe(z.number({ message: "Escribe un monto" }).finite().positive("Debe ser mayor que 0").max(10_000_000).nullable()),
  fecha_estimada: z.string().trim().transform((v) => v || null).pipe(z.iso.date({ message: "Fecha no válida" }).nullable()),
});

/** Lo que pagará la Afore, antes del depósito: proyecta el honorario. Vacío = quitar la proyección. */
export async function guardarPagoEsperado(casoId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol === "vendedor") return { error: "Tu rol no registra montos de la Afore." };
  const r = esquemaEsperado.safeParse(datosDe(form));
  if (!r.success) return { errores: errores(r.error) };
  const { monto_esperado, fecha_estimada } = r.data;
  const res = await conUsuario(claims, async (tx): Promise<Resultado> => {
    const caso = await tx.caso.findUnique({ where: { id: casoId }, select: { tipo_servicio: true } });
    if (!caso) return { error: "No encontramos el caso." };
    if (caso.tipo_servicio !== "RETIRO_DESEMPLEO") return { error: "El pago esperado de la Afore es del retiro por desempleo." };
    await tx.caso.update({ where: { id: casoId }, select: { id: true },
      data: { monto_afore_esperado: monto_esperado, fecha_afore_estimada: monto_esperado && fecha_estimada ? dia(fecha_estimada) : null } });
    await tx.evento.create({ data: { caso_id: casoId, tipo: "pago", usuario_id: usuario.id,
      texto: monto_esperado
        ? `Pago esperado de la Afore: $${monto_esperado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}${fecha_estimada ? ` (estimado para el ${fechaLarga(fecha_estimada)})` : ""}.`
        : "Se quitó el pago esperado de la Afore." } });
    return { ok: true };
  }, ip);
  if (res.ok) revalidatePath(`/casos/${casoId}`);
  return res;
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
  const [p, { MODALIDAD_B_MENSUALIDADES_MAX }, pf] = await Promise.all([parametrosDinero(), parametrosVigentes(["MODALIDAD_B_MENSUALIDADES_MAX"]), parametrosFechas(hoyCDMX())]);

  const res = await conUsuario(claims, async (tx): Promise<Resultado> => {
    const caso = await tx.caso.findUnique({ where: { id: casoId }, select: {
      tipo_servicio: true, etapa: true, contrato_pct: true,
      pagos_afore: { where: { archivado_at: null }, select: { numero: true, fecha_deposito: true, monto_bruto: true } },
      calculos: { orderBy: { created_at: "desc" }, take: 1, select: { modalidad_elegida: true } },
    } });
    if (!caso) return { error: "No encontramos el caso." };
    if (caso.tipo_servicio !== "RETIRO_DESEMPLEO") return { error: "Los pagos de la Afore son del retiro por desempleo. Para otros servicios registra el cobro." };
    // Un retiro se paga una sola vez; solo la modalidad B admite mensualidades.
    const modalidad = caso.calculos[0]?.modalidad_elegida ?? null;
    const permitidos = pagosAforePermitidos(modalidad, Number(MODALIDAD_B_MENSUALIDADES_MAX) || 1);
    if (caso.pagos_afore.length >= permitidos) {
      return { error: modalidad === "B"
        ? `Ya están registradas las ${permitidos} mensualidades de la modalidad B.`
        : "Este retiro ya tiene su pago de la Afore. La modalidad A se paga una sola vez; si el pago está mal, corrígelo en lugar de registrar otro." };
    }
    const repetido = pagoRepetido({ fecha: fecha_deposito, bruto: monto_bruto },
      caso.pagos_afore.map((x) => ({ numero: x.numero, fecha: x.fecha_deposito.toISOString().slice(0, 10), bruto: Number(x.monto_bruto) })));
    if (repetido) return { error: `Ya registraste ese pago (pago ${repetido.numero}: misma fecha y mismo monto).` };
    // El número no se reutiliza: un pago archivado (corregido) conserva el suyo.
    const ultimo = await tx.pagoAfore.aggregate({ where: { caso_id: casoId }, _max: { numero: true } });
    const numero = (ultimo._max.numero ?? 0) + 1;
    const pago = await tx.pagoAfore.create({
      select: { id: true },
      data: { caso_id: casoId, numero, fecha_deposito: dia(fecha_deposito), monto_bruto, isr_retenido: isr, monto_neto: neto, created_by: usuario.id },
    });
    // El honorario se calcula sobre lo que pagó la Afore, no sobre el estimado (2.2), con el % pactado.
    const pct = pctHonorarioRetiro(caso.contrato_pct === null ? null : Number(caso.contrato_pct), p);
    const h = honorarioDePago({ bruto: monto_bruto, neto }, { ...p, HONORARIO_RETIRO_PCT: pct });
    await tx.cobro.create({
      data: { caso_id: casoId, pago_afore_id: pago.id, base_calculo: h.base, honorario_total: h.honorario, subtotal: h.subtotal, iva: h.iva, concepto: "honorario", created_by: usuario.id },
    });
    await tx.evento.create({ data: { caso_id: casoId, tipo: "pago", usuario_id: usuario.id,
      texto: `Pago ${numero} de la Afore: $${neto.toLocaleString("es-MX", { minimumFractionDigits: 2 })} neto. Honorario por cobrar $${h.honorario.toLocaleString("es-MX", { minimumFractionDigits: 2 })}.`
        + (caso.pagos_afore.length === 0 ? ` Próximo retiro por desempleo del cliente: a partir del ${fechaLarga(fechaProximoRetiro(fecha_deposito, pf))}.` : "") } });
    await moverPorDinero(tx, casoId, usuario.id);
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
    await moverPorDinero(tx, casoId, usuario.id);
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
    await moverPorDinero(tx, casoId, usuario.id);
    return { ok: true };
  }, ip);
  if (res.ok) await despues(casoId);
  return res;
}

// ───────────── Canal: vendedor, referidor y socio ─────────────

export async function guardarCanal(casoId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director" && usuario.rol !== "asesor") return { error: "Solo el Director o el analista cambian el canal." };
  const uuid = (k: string) => {
    const v = String(form.get(k) ?? "");
    return /^[0-9a-f-]{36}$/i.test(v) ? v : null;
  };
  // Esquemas vigentes: referidor y asesor de pensiones (ya no hay vendedor).
  const referidor_id = uuid("referidor_id");
  const socio_id = uuid("socio_id");
  const res = await conUsuario(claims, async (tx): Promise<Resultado> => {
    const n = await tx.caso.updateMany({ where: { id: casoId }, data: { referidor_id, socio_id } });
    if (!n.count) return { error: "No encontramos el caso." };
    await tx.evento.create({ data: { caso_id: casoId, tipo: "sistema", usuario_id: usuario.id, texto: "Se actualizó el canal (referidor o asesor de pensiones)" } });
    return { ok: true };
  }, ip);
  if (res.ok) await despues(casoId);
  return res;
}

// ───────────── Comprobante de la transferencia del cliente ─────────────

/** Liga firmada para subir el comprobante directo al almacén (misma carpeta y políticas que el expediente). */
export async function prepararComprobante(casoId: string, cobroId: string, mime: string, bytes: number): Promise<{ subida?: Subida; error?: string }> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol === "vendedor") return { error: "Tu rol no sube comprobantes." };
  const problema = validarComprobante(mime, bytes);
  if (problema) return { error: problema };
  const cobro = await conUsuario(claims, (tx) => tx.cobro.findFirst({ where: { id: cobroId, caso_id: casoId, archivado_at: null, estado: { not: "cancelado" } }, select: { id: true } }), ip);
  if (!cobro) return { error: "No encontramos ese cobro." };
  try {
    return { subida: await prepararSubida(rutaDocumento(casoId, randomUUID(), mime)) };
  } catch {
    return { error: "No se pudo preparar la subida. Intenta de nuevo." };
  }
}

export async function registrarComprobante(casoId: string, cobroId: string, ruta: string, mime: string): Promise<{ ok?: boolean; error?: string }> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol === "vendedor") return { error: "Tu rol no sube comprobantes." };
  if (!ruta.startsWith(`${casoId}/`) || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z]{3,4}$/.test(ruta)) return { error: "Ruta de archivo no válida." };
  if (validarComprobante(mime, 1)) return { error: "Formato no válido." };
  const res = await conUsuario(claims, async (tx) => {
    const n = await tx.cobro.updateMany({
      where: { id: cobroId, caso_id: casoId, archivado_at: null, estado: { not: "cancelado" } },
      data: { comprobante_path: ruta, comprobante_mime: mime, comprobante_at: new Date(), comprobante_por: usuario.id },
    });
    if (!n.count) return { error: "No encontramos ese cobro." };
    await tx.evento.create({ data: { caso_id: casoId, tipo: "documento", usuario_id: usuario.id, texto: "Se subió el comprobante de pago del honorario" } });
    return { ok: true };
  }, ip);
  if (res.ok) revalidatePath(`/casos/${casoId}`);
  return res;
}

/** Liga de 10 minutos para ver el comprobante (RLS del cobro y políticas del bucket). */
export async function verComprobante(casoId: string, cobroId: string): Promise<{ url?: string; error?: string }> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol === "vendedor") return { error: "Tu rol no ve comprobantes." };
  const cobro = await conUsuario(claims, (tx) => tx.cobro.findFirst({ where: { id: cobroId, caso_id: casoId }, select: { comprobante_path: true } }), ip);
  if (!cobro?.comprobante_path) return { error: "Este cobro no tiene comprobante." };
  try {
    return { url: await urlLectura(cobro.comprobante_path) };
  } catch {
    return { error: "No se pudo abrir el comprobante." };
  }
}

// ───────────── Corregir un pago de la Afore ─────────────

/** El Director corrige solo la fecha del depósito (el monto y el honorario no cambian). */
export async function cambiarFechaPagoAfore(casoId: string, pagoId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director") return { error: "Solo el Director corrige pagos registrados." };
  const r = z.object({ fecha_deposito: fechaPasada }).safeParse(datosDe(form));
  if (!r.success) return { errores: errores(r.error) };
  const res = await conUsuario(claims, async (tx): Promise<Resultado> => {
    const pago = await tx.pagoAfore.findFirst({ where: { id: pagoId, caso_id: casoId, archivado_at: null }, select: { numero: true, fecha_deposito: true } });
    if (!pago) return { error: "No encontramos el pago." };
    await tx.pagoAfore.update({ where: { id: pagoId }, data: { fecha_deposito: dia(r.data.fecha_deposito) }, select: { id: true } });
    await tx.evento.create({ data: { caso_id: casoId, tipo: "pago", usuario_id: usuario.id,
      texto: `Fecha del depósito de la Afore corregida: ${fechaLarga(r.data.fecha_deposito)} (antes ${pago.fecha_deposito.toISOString().slice(0, 10)}).` } });
    return { ok: true };
  }, ip);
  if (res.ok) await despues(casoId);
  return res;
}

/**
 * La Afore todavía no deposita: el pago vuelve a ser «pago esperado» (proyección), su cobro pendiente se cancela
 * y el caso regresa a la etapa que tenía antes de que el pago lo moviera. Solo si el honorario no se cobró.
 */
export async function regresarAPagoEsperado(casoId: string, pagoId: string): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director") return { error: "Solo el Director corrige pagos registrados." };
  const res = await conUsuario(claims, async (tx): Promise<Resultado> => {
    const pago = await tx.pagoAfore.findFirst({ where: { id: pagoId, caso_id: casoId, archivado_at: null }, include: { cobros: { where: { archivado_at: null } } } });
    if (!pago) return { error: "No encontramos el pago." };
    if (pago.cobros.some((c) => c.estado === "cobrado")) return { error: "Su honorario ya se cobró: no puede volver a ser proyección." };
    const otros = await tx.pagoAfore.count({ where: { caso_id: casoId, archivado_at: null, id: { not: pagoId } } });
    await tx.cobro.updateMany({ where: { pago_afore_id: pagoId, estado: "por_cobrar" }, data: { estado: "cancelado", motivo_cancelacion: "El pago de la Afore volvió a ser proyección" } });
    await tx.pagoAfore.update({ where: { id: pagoId }, data: { archivado_at: new Date() }, select: { id: true } });
    const caso = await tx.caso.findUnique({ where: { id: casoId }, select: { etapa: true } });
    await tx.caso.update({ where: { id: casoId }, select: { id: true }, data: { monto_afore_esperado: pago.monto_bruto, fecha_afore_estimada: null } });
    // Si ya no queda pago y el caso avanzó solo por este, regresa a la etapa anterior.
    if (otros === 0 && caso?.etapa === "PAGADO") {
      const salto = await tx.historialEtapa.findFirst({ where: { caso_id: casoId, etapa_nueva: "PAGADO" }, orderBy: { fecha: "desc" }, select: { etapa_antes: true } });
      const antes = salto?.etapa_antes ?? "PROSPECTO";
      await tx.caso.update({ where: { id: casoId }, data: { etapa: antes, etapa_desde: new Date() }, select: { id: true } });
      await tx.historialEtapa.create({ data: { caso_id: casoId, etapa_antes: "PAGADO", etapa_nueva: antes, motivo: "El pago de la Afore volvió a ser proyección", usuario_id: usuario.id } });
    }
    await tx.evento.create({ data: { caso_id: casoId, tipo: "pago", usuario_id: usuario.id,
      texto: `El pago ${pago.numero} de la Afore volvió a ser pago esperado ($${Number(pago.monto_bruto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}); falta la fecha del depósito.` } });
    return { ok: true };
  }, ip);
  if (res.ok) await despues(casoId);
  return res;
}
