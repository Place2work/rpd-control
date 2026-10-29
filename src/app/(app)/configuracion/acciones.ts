"use server";

// Configuración (10.9): solo el Director. Todo pasa por RLS (conUsuario) y queda en la bitácora.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { bloquearCuenta, invitarCuenta } from "@/lib/auth/admin";
import { obtenerSesion } from "@/lib/auth/sesion";
import { validarPlantilla } from "@/lib/contratos/plantilla";
import { planNuevaVigencia, validarValor, type TipoParametro } from "@/lib/configuracion/parametros";
import { conUsuario } from "@/lib/db/prisma";
import { sumarDias as sumar } from "@/lib/reglas/fechas";
import { hoyCDMX } from "@/lib/tiempo";

export type Resultado = { ok?: boolean; error?: string; errores?: Record<string, string> };
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const datosDe = (form: FormData) =>
  Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string").map(([k, v]) => [k, String(v).trim()])) as Record<string, string>;
const errores = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [String(i.path[0]), i.message]));

async function director() {
  const s = await obtenerSesion();
  return s.usuario.rol === "director" ? s : null;
}

// ───────────── Parámetros con vigencia ─────────────

export async function programarParametro(clave: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await director();
  if (!s) return { error: "Solo el Director cambia parámetros." };
  const d = datosDe(form);
  const hoy = hoyCDMX();
  const desde = d.vigente_desde || hoy;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) return { errores: { vigente_desde: "Fecha no válida" } };

  const res = await conUsuario(s.claims, async (tx): Promise<Resultado> => {
    const filas = await tx.parametro.findMany({ where: { clave }, orderBy: { vigente_desde: "desc" } });
    if (!filas.length) return { error: "Ese parámetro no existe." };
    const v = validarValor(clave, filas[0].tipo as TipoParametro, d.valor ?? "");
    if (!v.ok) return { errores: { valor: v.error } };
    if (filas.some((f) => iso(f.vigente_desde)! <= desde && (f.vigente_hasta === null || iso(f.vigente_hasta)! >= desde) && f.valor === v.valor)) {
      return { errores: { valor: "Es el mismo valor que ya está vigente en esa fecha" } };
    }
    const plan = planNuevaVigencia(filas.map((f) => ({ id: f.id, vigenteDesde: iso(f.vigente_desde)!, vigenteHasta: iso(f.vigente_hasta) })), desde, hoy);
    if (!plan.ok) return { errores: { vigente_desde: plan.error } };
    if (plan.accion === "reemplazar") {
      await tx.parametro.update({ where: { id: plan.id }, data: { valor: v.valor }, select: { id: true } });
    } else {
      for (const c of plan.cerrar) await tx.parametro.update({ where: { id: c.id }, data: { vigente_hasta: dia(c.hasta) }, select: { id: true } });
      await tx.parametro.create({
        data: { clave, valor: v.valor, tipo: filas[0].tipo, descripcion: filas[0].descripcion, vigente_desde: dia(desde), created_by: s.usuario.id },
        select: { id: true },
      });
    }
    return { ok: true };
  }, s.ip);
  if (res.ok) revalidatePath("/configuracion");
  return res;
}

// ───────────── Días inhábiles ─────────────

export async function agregarInhabil(_p: Resultado, form: FormData): Promise<Resultado> {
  const s = await director();
  if (!s) return { error: "Solo el Director cambia el calendario de días inhábiles." };
  const r = z.object({
    fecha: z.iso.date({ message: "Fecha no válida" }),
    descripcion: z.string().min(3, "Escribe el motivo").max(120),
    origen: z.enum(["oficial", "bancario", "afore"], { message: "Elige el origen" }),
  }).safeParse(datosDe(form));
  if (!r.success) return { errores: errores(r.error) };
  await conUsuario(s.claims, (tx) => tx.diaInhabil.upsert({
    where: { fecha: dia(r.data.fecha) },
    update: { descripcion: r.data.descripcion, origen: r.data.origen, activo: true },
    create: { fecha: dia(r.data.fecha), descripcion: r.data.descripcion, origen: r.data.origen },
    select: { fecha: true },
  }), s.ip);
  revalidatePath("/configuracion");
  return { ok: true };
}

export async function cambiarInhabil(fecha: string, activo: boolean): Promise<Resultado> {
  const s = await director();
  if (!s) return { error: "Solo el Director cambia el calendario de días inhábiles." };
  await conUsuario(s.claims, (tx) => tx.diaInhabil.update({ where: { fecha: dia(fecha) }, data: { activo }, select: { fecha: true } }), s.ip);
  revalidatePath("/configuracion");
  return { ok: true };
}

// ───────────── Usuarios ─────────────

const ROLES = ["director", "asesor", "vendedor", "socio"] as const;
const esquemaUsuario = z.object({
  nombre: z.string().min(3, "Escribe el nombre completo").max(120),
  rol: z.enum(ROLES, { message: "Elige el rol" }),
  socio_id: z.string().optional().transform((v) => (v ? v : null)),
  telefono: z.string().max(20).optional().transform((v) => (v ? v : null)),
}).refine((d) => d.rol !== "socio" || d.socio_id, { message: "Un usuario socio debe pertenecer a un socio licenciatario", path: ["socio_id"] });

export async function invitarUsuario(_p: Resultado, form: FormData): Promise<Resultado> {
  const s = await director();
  if (!s) return { error: "Solo el Director da de alta usuarios." };
  const d = datosDe(form);
  const r = esquemaUsuario.and(z.object({ email: z.email("Correo no válido").transform((v) => v.toLowerCase()) })).safeParse(d);
  if (!r.success) return { errores: errores(r.error) };
  const ya = await conUsuario(s.claims, (tx) => tx.usuario.findUnique({ where: { email: r.data.email }, select: { id: true } }), s.ip);
  if (ya) return { errores: { email: "Ese correo ya es usuario del sistema" } };
  const cuenta = await invitarCuenta(r.data.email);
  if (!cuenta.id) return { error: cuenta.error };
  await conUsuario(s.claims, (tx) => tx.usuario.create({
    data: { id: cuenta.id!, email: r.data.email, nombre: r.data.nombre, rol: r.data.rol, socio_id: r.data.rol === "socio" ? r.data.socio_id : null, telefono: r.data.telefono, created_by: s.usuario.id },
    select: { id: true },
  }), s.ip);
  revalidatePath("/configuracion");
  return { ok: true };
}

export async function actualizarUsuario(id: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await director();
  if (!s) return { error: "Solo el Director cambia usuarios." };
  const r = esquemaUsuario.safeParse(datosDe(form));
  if (!r.success) return { errores: errores(r.error) };
  // El Director no puede quitarse a sí mismo el rol: se quedaría fuera de Configuración.
  if (id === s.usuario.id && r.data.rol !== "director") return { errores: { rol: "No puedes quitarte el rol de Director a ti mismo" } };
  await conUsuario(s.claims, (tx) => tx.usuario.update({
    where: { id }, select: { id: true },
    data: { nombre: r.data.nombre, rol: r.data.rol, socio_id: r.data.rol === "socio" ? r.data.socio_id : null, telefono: r.data.telefono },
  }), s.ip);
  revalidatePath("/configuracion");
  return { ok: true };
}

/** Desactivar corta el acceso al instante (RLS) y bloquea el inicio de sesión en Supabase. No borra nada. */
export async function cambiarAcceso(id: string, activo: boolean): Promise<Resultado> {
  const s = await director();
  if (!s) return { error: "Solo el Director cambia el acceso." };
  if (id === s.usuario.id && !activo) return { error: "No puedes desactivar tu propia cuenta." };
  if (!activo) {
    const otros = await conUsuario(s.claims, (tx) => tx.usuario.count({ where: { rol: "director", activo: true, archivado_at: null, id: { not: id } } }), s.ip);
    if (!otros) return { error: "Debe quedar al menos un Director activo." };
  }
  await conUsuario(s.claims, (tx) => tx.usuario.update({ where: { id }, data: { activo }, select: { id: true } }), s.ip);
  try {
    await bloquearCuenta(id, !activo);
  } catch (e) {
    // El acceso ya está cortado por RLS; se avisa para reintentar el bloqueo en Supabase.
    revalidatePath("/configuracion");
    return { error: `${(e as Error).message}. El usuario ya no ve datos (está inactivo); intenta de nuevo para bloquear también el inicio de sesión.` };
  }
  revalidatePath("/configuracion");
  return { ok: true };
}

// ───────────── Plantillas de contrato y aviso ─────────────

/** Nueva versión: la anterior queda vigente hasta el día previo; los contratos ya firmados no cambian. */
export async function nuevaVersionPlantilla(clase: string, tipoServicio: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await director();
  if (!s) return { error: "Solo el Director cambia plantillas." };
  const cuerpo = String(form.get("cuerpo") ?? "").replace(/\r\n/g, "\n");
  const desde = String(form.get("vigente_desde") ?? "") || hoyCDMX();
  const problemas = validarPlantilla(cuerpo);
  if (problemas.length) return { errores: { cuerpo: problemas.join(" · ") } };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || desde < hoyCDMX()) return { errores: { vigente_desde: "Desde hoy o una fecha futura" } };
  const res = await conUsuario(s.claims, async (tx): Promise<Resultado> => {
    const versiones = await tx.plantillaContrato.findMany({ where: { clase, tipo_servicio: tipoServicio }, orderBy: { version: "desc" } });
    if (!versiones.length) return { error: "No hay plantilla de ese documento." };
    if (versiones[0].cuerpo === cuerpo) return { errores: { cuerpo: "No hay cambios respecto a la versión vigente" } };
    if (versiones.some((v) => iso(v.vigente_desde)! >= desde)) return { errores: { vigente_desde: "Ya hay una versión que empieza en esa fecha o después" } };
    for (const v of versiones.filter((x) => x.vigente_hasta === null || iso(x.vigente_hasta)! >= desde)) {
      await tx.plantillaContrato.update({ where: { id: v.id }, data: { vigente_hasta: dia(sumar(desde, -1)) }, select: { id: true } });
    }
    await tx.plantillaContrato.create({
      data: { clase, tipo_servicio: tipoServicio, version: versiones[0].version + 1, nombre: versiones[0].nombre, cuerpo, vigente_desde: dia(desde) },
      select: { id: true },
    });
    return { ok: true };
  }, s.ip);
  if (res.ok) revalidatePath("/configuracion");
  return res;
}

// ───────────── Mensajes de WhatsApp (8.3) ─────────────

export async function guardarMensaje(clave: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await director();
  if (!s) return { error: "Solo el Director cambia los mensajes." };
  const r = z.object({
    nombre: z.string().min(3).max(80),
    cuerpo: z.string().min(10, "Escribe el mensaje").max(1000, "Máximo 1,000 caracteres"),
  }).safeParse(datosDe(form));
  if (!r.success) return { errores: errores(r.error) };
  const desconocidas = [...r.data.cuerpo.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((v) => !["nombre", "folio", "fecha", "mes", "monto", "dias", "documentos", "liga_privacidad"].includes(v));
  if (desconocidas.length) return { errores: { cuerpo: `Variables que el sistema no llena: ${[...new Set(desconocidas)].map((v) => `{${v}}`).join(", ")}` } };
  await conUsuario(s.claims, (tx) => tx.plantillaMensaje.update({
    where: { clave }, data: { nombre: r.data.nombre, cuerpo: r.data.cuerpo, activo: form.get("activo") === "si" }, select: { clave: true },
  }), s.ip);
  revalidatePath("/configuracion");
  return { ok: true };
}

// ───────────── Esquemas de comisión (9.1) ─────────────

/** Nueva versión del esquema del vendedor (porcentaje) o del referidor (escalones). */
export async function nuevaVersionEsquema(id: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await director();
  if (!s) return { error: "Solo el Director cambia los esquemas de comisión." };
  const d = datosDe(form);
  const desde = d.vigente_desde || hoyCDMX();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || desde < hoyCDMX()) return { errores: { vigente_desde: "Desde hoy o una fecha futura" } };
  const num = (v: string | undefined) => Number((v ?? "").replace(/[,$\s%]/g, ""));
  const res = await conUsuario(s.claims, async (tx): Promise<Resultado> => {
    const base = await tx.esquemaComision.findUnique({ where: { id } });
    if (!base) return { error: "No encontramos el esquema." };
    const reglas = base.reglas as Record<string, unknown>;
    let nuevas: Record<string, unknown>;
    if (reglas.tipo === "porcentaje") {
      const pct = num(d.pct);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) return { errores: { pct: "Entre 0 y 100" } };
      nuevas = { ...reglas, pct: Math.round(pct * 1e4) / 1e6 };
    } else if (reglas.tipo === "escalonado_mensual") {
      const [h1, h2, m1, m2, m3] = [num(d.hasta1), num(d.hasta2), num(d.monto1), num(d.monto2), num(d.monto3)];
      if (![h1, h2].every((x) => Number.isInteger(x) && x >= 1) || h2 <= h1) return { errores: { hasta2: "Los límites deben ser enteros y crecientes" } };
      if (![m1, m2, m3].every((x) => Number.isFinite(x) && x >= 0)) return { errores: { monto1: "Montos no válidos" } };
      nuevas = { ...reglas, escalones: [{ desde: 1, hasta: h1, monto: m1 }, { desde: h1 + 1, hasta: h2, monto: m2 }, { desde: h2 + 1, hasta: null, monto: m3 }] };
    } else {
      return { error: "Este esquema se ajusta en Parámetros (fallecimiento) o en cada socio (reparto)." };
    }
    const hermanas = await tx.esquemaComision.findMany({ where: { nombre: base.nombre, tipo_servicio: base.tipo_servicio }, orderBy: { version: "desc" } });
    if (hermanas.some((v) => iso(v.vigente_desde)! >= desde)) return { errores: { vigente_desde: "Ya hay una versión que empieza en esa fecha o después" } };
    for (const v of hermanas.filter((x) => x.vigente_hasta === null || iso(x.vigente_hasta)! >= desde)) {
      await tx.esquemaComision.update({ where: { id: v.id }, data: { vigente_hasta: dia(sumar(desde, -1)) }, select: { id: true } });
    }
    await tx.esquemaComision.create({
      data: { nombre: base.nombre, tipo: base.tipo, tipo_servicio: base.tipo_servicio, version: hermanas[0].version + 1, reglas: nuevas as object, vigente_desde: dia(desde), created_by: s.usuario.id },
      select: { id: true },
    });
    return { ok: true };
  }, s.ip);
  if (res.ok) revalidatePath("/configuracion");
  return res;
}
