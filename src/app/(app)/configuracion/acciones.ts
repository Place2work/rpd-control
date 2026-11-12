"use server";

// Configuración (10.9): solo el Director. Todo pasa por RLS (conUsuario) y queda en la bitácora.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { bloquearCuenta, crearCuentaConClave, enviarLigaContrasena, invitarCuenta, restablecerConClave, restablecerVerificacion } from "@/lib/auth/admin";
import { obtenerSesion } from "@/lib/auth/sesion";
import { validarPlantilla } from "@/lib/contratos/plantilla";
import { planNuevaVigencia, validarValor, type TipoParametro } from "@/lib/configuracion/parametros";
import { conUsuario, type Tx } from "@/lib/db/prisma";
import { sumarDias as sumar } from "@/lib/reglas/fechas";
import { hoyCDMX } from "@/lib/tiempo";
import { dominioApp } from "@/lib/url";
import { procesarCambiosParametro } from "@/lib/academia/vigencia";

// `unaVez`: dato que se muestra una sola vez y no se guarda (la contraseña temporal).
export type Resultado = { ok?: boolean; error?: string; errores?: Record<string, string>; unaVez?: { titulo: string; valor: string; nota?: string } };
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
  if (res.ok) {
    revalidatePath("/configuracion");
    // Academia (9.6): las preguntas que dependen del parámetro pasan a revisión y se prepara la microlección.
    await procesarCambiosParametro().catch((e) => console.error("[configuracion] academia", e));
    revalidatePath("/academia/contenido");
  }
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

// Tres esquemas: Analista de expedientes (asesor), Asesor de pensiones (socio, con su ficha de reparto) y referidor (sin cuenta).
const ROLES = ["director", "asesor", "socio"] as const;
const esquemaUsuario = z.object({
  nombre: z.string().min(3, "Escribe el nombre completo").max(120),
  rol: z.enum(ROLES, { message: "Elige el rol" }),
  telefono: z.string().max(20).optional().transform((v) => (v ? v : null)),
  // Asesor de pensiones: su ficha (% y costo del reparto). Vacío = se crea una nueva con su nombre.
  socio_id: z.string().optional().transform((v) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : null)),
});

/** La ficha elegida existe y no la usa otra cuenta activa. */
async function fichaLibre(tx: Tx, socioId: string | null, usuarioId?: string): Promise<string | null> {
  if (!socioId) return null;
  if (!(await tx.socio.findFirst({ where: { id: socioId, archivado_at: null }, select: { id: true } }))) return "Elige un asesor de la lista";
  const otro = await tx.usuario.findFirst({ where: { socio_id: socioId, activo: true, ...(usuarioId ? { NOT: { id: usuarioId } } : {}) }, select: { nombre: true } });
  return otro ? `Esa ficha ya es la cuenta de ${otro.nombre}` : null;
}

/**
 * Antes de crear una ficha nueva: si ya hay una ficha viva sin cuenta con el mismo teléfono (o el mismo nombre),
 * se pide elegirla para no partir sus casos y comisiones en dos fichas.
 */
async function fichaParecida(tx: Tx, nombre: string, telefono: string | null): Promise<string | null> {
  const digitos = (v: string | null) => (v ?? "").replace(/\D/g, "").slice(-10);
  const tel = digitos(telefono);
  const libres = await tx.socio.findMany({ where: { archivado_at: null, usuarios: { none: { activo: true } } }, select: { nombre: true, telefono: true } });
  const igual = libres.find((f) => (tel.length === 10 && digitos(f.telefono) === tel) || f.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
  return igual ? `Ya existe la ficha «${igual.nombre}»${tel && digitos(igual.telefono) === tel ? " con ese teléfono" : ""}: elígela en «Ficha del asesor de pensiones» para que conserve sus casos y comisiones.` : null;
}

/** Ficha del asesor de pensiones: la elegida o una nueva con su nombre (% y costo por omisión, ajustables después). */
async function ligarFicha(tx: Tx, d: { rol: string; socio_id: string | null; nombre: string; telefono: string | null }, email: string | null, creador: string): Promise<string | null> {
  if (d.rol !== "socio") return null;
  if (d.socio_id) return d.socio_id;
  const nueva = await tx.socio.create({ data: { nombre: d.nombre, telefono: d.telefono, email, created_by: creador }, select: { id: true } });
  return nueva.id;
}

export async function invitarUsuario(_p: Resultado, form: FormData): Promise<Resultado> {
  const s = await director();
  if (!s) return { error: "Solo el Director da de alta usuarios." };
  const d = datosDe(form);
  const r = esquemaUsuario.and(z.object({ email: z.email("Correo no válido").transform((v) => v.toLowerCase()) })).safeParse(d);
  if (!r.success) return { errores: errores(r.error) };
  const ya = await conUsuario(s.claims, (tx) => tx.usuario.findUnique({ where: { email: r.data.email }, select: { id: true } }), s.ip);
  if (ya) return { errores: { email: "Ese correo ya es usuario del sistema" } };
  const ocupada = r.data.rol === "socio" ? await conUsuario(s.claims, (tx) => r.data.socio_id ? fichaLibre(tx, r.data.socio_id) : fichaParecida(tx, r.data.nombre, r.data.telefono), s.ip) : null;
  if (ocupada) return { errores: { socio_id: ocupada } };
  const cuenta = await invitarCuenta(r.data.email);
  if (!cuenta.id) return { error: cuenta.error };
  await conUsuario(s.claims, async (tx) => tx.usuario.create({
    data: { id: cuenta.id!, email: r.data.email, nombre: r.data.nombre, rol: r.data.rol, telefono: r.data.telefono, created_by: s.usuario.id,
      socio_id: await ligarFicha(tx, r.data, r.data.email, s.usuario.id) },
    select: { id: true },
  }), s.ip);
  await registrarCuenta(s, cuenta.id, "INVITACION_CORREO");
  revalidatePath("/configuracion");
  return { ok: true, unaVez: { titulo: `Invitación enviada a ${r.data.nombre}`, valor: r.data.email,
    nota: "Le llegó un correo para activar su cuenta: pone su contraseña y activa la verificación en dos pasos en su celular. Si no lo ve, que revise Spam; puedes reenviarlo con «Enviar acceso por correo»." } };
}

/** Bitácora de lo que pasa en Supabase Auth (no hay tabla con trigger que lo registre). */
async function registrarCuenta(s: NonNullable<Awaited<ReturnType<typeof director>>>, id: string, accion: "CLAVE_TEMPORAL" | "RESTABLECER_2FA" | "INVITACION_CORREO" | "ACCESO_CORREO") {
  await conUsuario(s.claims, (tx) => tx.$executeRaw`SELECT app.registrar_accion_cuenta(${id}::uuid, ${accion})`, s.ip);
}

/** Alta sin correo: cuenta con contraseña temporal que el Director entrega en persona. */
export async function crearUsuarioConClave(_p: Resultado, form: FormData): Promise<Resultado> {
  const s = await director();
  if (!s) return { error: "Solo el Director da de alta usuarios." };
  // Con correo y «Enviarle invitación por correo»: le llega un correo para activar su cuenta (sin contraseña temporal).
  if (String(form.get("acceso") ?? "") === "correo" && String(form.get("email") ?? "").trim()) return invitarUsuario(_p, form);
  // Asesor de pensiones sin correo todavía: solo su ficha (cobra comisiones); la cuenta se crea cuando haya correo.
  const datos = datosDe(form);
  if (datos.rol === "socio" && !String(datos.email ?? "").trim()) {
    const f = esquemaUsuario.safeParse(datos);
    if (!f.success) return { errores: errores(f.error) };
    if (f.data.socio_id) return { errores: { email: "Esa ficha ya existe: escribe su correo para crearle la cuenta" } };
    const res = await conUsuario(s.claims, async (tx): Promise<Resultado> => {
      if (await tx.socio.findFirst({ where: { archivado_at: null, nombre: { equals: f.data.nombre.trim(), mode: "insensitive" } }, select: { id: true } })) {
        return { errores: { nombre: "Ya hay un asesor de pensiones con ese nombre" } };
      }
      const parecida = await fichaParecida(tx, f.data.nombre, f.data.telefono);
      if (parecida) return { errores: { telefono: parecida.replace("elígela en «Ficha del asesor de pensiones» para que conserve sus casos y comisiones.", "ya está registrado; edítalo en «Asesores de pensiones sin cuenta».") } };
      await ligarFicha(tx, { ...f.data, socio_id: null }, null, s.usuario.id);
      return { ok: true };
    }, s.ip);
    if (res.ok) { revalidatePath("/configuracion"); revalidatePath("/comisiones/beneficiarios"); }
    return res;
  }
  const r = esquemaUsuario.and(z.object({ email: z.email("Correo no válido").transform((v) => v.toLowerCase()) })).safeParse(datosDe(form));
  if (!r.success) return { errores: errores(r.error) };
  const ya = await conUsuario(s.claims, (tx) => tx.usuario.findUnique({ where: { email: r.data.email }, select: { id: true } }), s.ip);
  if (ya) return { errores: { email: "Ese correo ya es usuario del sistema" } };
  const ocupada = r.data.rol === "socio" ? await conUsuario(s.claims, (tx) => r.data.socio_id ? fichaLibre(tx, r.data.socio_id) : fichaParecida(tx, r.data.nombre, r.data.telefono), s.ip) : null;
  if (ocupada) return { errores: { socio_id: ocupada } };
  const cuenta = await crearCuentaConClave(r.data.email);
  if (!cuenta.id || !cuenta.clave) return { error: cuenta.error };
  await conUsuario(s.claims, async (tx) => tx.usuario.create({
    data: { id: cuenta.id!, email: r.data.email, nombre: r.data.nombre, rol: r.data.rol, telefono: r.data.telefono, created_by: s.usuario.id,
      socio_id: await ligarFicha(tx, r.data, r.data.email, s.usuario.id) },
    select: { id: true },
  }), s.ip);
  await registrarCuenta(s, cuenta.id, "CLAVE_TEMPORAL");
  revalidatePath("/configuracion");
  return { ok: true, unaVez: { titulo: `Contraseña temporal de ${r.data.nombre}`, valor: cuenta.clave,
    nota: `Entra en ${dominioApp()} con ${r.data.email} y esta contraseña. Al entrar activará la verificación en dos pasos y pondrá su propia contraseña. No se vuelve a mostrar.` } };
}

/** Contraseña temporal nueva para quien olvidó la suya. */
export async function claveTemporalUsuario(id: string): Promise<Resultado> {
  const s = await director();
  if (!s) return { error: "Solo el Director cambia contraseñas." };
  if (id === s.usuario.id) return { error: "Tu propia contraseña la cambias tú al entrar." };
  const u = await conUsuario(s.claims, (tx) => tx.usuario.findUnique({ where: { id }, select: { nombre: true, email: true, activo: true } }), s.ip);
  if (!u) return { error: "No encontramos al usuario." };
  if (!u.activo) return { error: "Primero dale acceso de nuevo." };
  const r = await restablecerConClave(id);
  if (!r.clave) return { error: r.error };
  await registrarCuenta(s, id, "CLAVE_TEMPORAL");
  return { ok: true, unaVez: { titulo: `Contraseña temporal de ${u.nombre}`, valor: r.clave,
    nota: `La anterior ya no funciona. Al entrar con ${u.email} pondrá una nueva. Su verificación en dos pasos no cambia. No se vuelve a mostrar.` } };
}

/** Perdió o cambió de celular: se quita su 2FA y recibe una contraseña temporal. */
export async function restablecerDosPasos(id: string): Promise<Resultado> {
  const s = await director();
  if (!s) return { error: "Solo el Director restablece la verificación." };
  if (id === s.usuario.id) return { error: "La tuya no se restablece desde aquí: pídeselo al administrador técnico." };
  const u = await conUsuario(s.claims, (tx) => tx.usuario.findUnique({ where: { id }, select: { nombre: true, email: true, activo: true } }), s.ip);
  if (!u) return { error: "No encontramos al usuario." };
  if (!u.activo) return { error: "Primero dale acceso de nuevo." };
  const r = await restablecerVerificacion(id);
  if (!r.clave) return { error: r.error };
  await registrarCuenta(s, id, "RESTABLECER_2FA");
  return { ok: true, unaVez: { titulo: `Verificación restablecida · contraseña temporal de ${u.nombre}`, valor: r.clave,
    nota: `Su celular anterior ya no sirve para entrar. Al entrar con ${u.email} escaneará un código nuevo con la app autenticadora de su celular nuevo y pondrá su propia contraseña. No se vuelve a mostrar.` } };
}

export async function actualizarUsuario(id: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await director();
  if (!s) return { error: "Solo el Director cambia usuarios." };
  const r = esquemaUsuario.safeParse(datosDe(form));
  if (!r.success) return { errores: errores(r.error) };
  // El Director no puede quitarse a sí mismo el rol: se quedaría fuera de Configuración.
  if (id === s.usuario.id && r.data.rol !== "director") return { errores: { rol: "No puedes quitarte el rol de Director a ti mismo" } };
  const res = await conUsuario(s.claims, async (tx) => {
    const ocupada = r.data.rol === "socio" ? await fichaLibre(tx, r.data.socio_id, id) : null;
    if (ocupada) return { errores: { socio_id: ocupada } };
    const actual = await tx.usuario.findUnique({ where: { id }, select: { email: true, socio_id: true } });
    // Si ya era asesor de pensiones y no se elige otra ficha, conserva la suya.
    const socio_id = r.data.rol === "socio" ? await ligarFicha(tx, { ...r.data, socio_id: r.data.socio_id ?? actual?.socio_id ?? null }, actual?.email ?? null, s.usuario.id) : null;
    await tx.usuario.update({ where: { id }, select: { id: true }, data: { nombre: r.data.nombre, rol: r.data.rol, socio_id, telefono: r.data.telefono } });
    if (socio_id) await tx.socio.update({ where: { id: socio_id }, data: { nombre: r.data.nombre }, select: { id: true } });
    return null;
  }, s.ip);
  if (res) return res;
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
      return { error: "Este esquema se ajusta en Parámetros (fallecimiento) o en cada asesor de pensiones (reparto)." };
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

/** Cuenta para un asesor de pensiones que ya tenía ficha (dado de alta sin correo): contraseña temporal. */
export async function crearCuentaAsesor(socioId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await director();
  if (!s) return { error: "Solo el Director da de alta usuarios." };
  const r = z.object({ email: z.email("Correo no válido").transform((v) => v.toLowerCase()) }).safeParse(datosDe(form));
  if (!r.success) return { errores: errores(r.error) };
  const pre = await conUsuario(s.claims, async (tx) => {
    const ficha = await tx.socio.findFirst({ where: { id: socioId, archivado_at: null }, select: { nombre: true, telefono: true } });
    if (!ficha) return { error: "No encontramos al asesor." } as const;
    const ocupada = await fichaLibre(tx, socioId);
    if (ocupada) return { error: ocupada } as const;
    if (await tx.usuario.findUnique({ where: { email: r.data.email }, select: { id: true } })) return { errores: { email: "Ese correo ya es usuario del sistema" } } as const;
    return { ficha } as const;
  }, s.ip);
  const ficha = "ficha" in pre ? pre.ficha : null;
  if (!ficha) return pre as Resultado;
  const porCorreo = String(form.get("acceso") ?? "") === "correo";
  const cuenta: { id?: string; clave?: string; error?: string } = porCorreo ? await invitarCuenta(r.data.email) : await crearCuentaConClave(r.data.email);
  if (!cuenta.id || (!porCorreo && !cuenta.clave)) return { error: cuenta.error };
  await conUsuario(s.claims, async (tx) => {
    await tx.usuario.create({ data: { id: cuenta.id!, email: r.data.email, nombre: ficha.nombre, rol: "socio", socio_id: socioId, telefono: ficha.telefono, created_by: s.usuario.id }, select: { id: true } });
    await tx.socio.update({ where: { id: socioId }, data: { email: r.data.email }, select: { id: true } });
  }, s.ip);
  if (porCorreo) {
    await registrarCuenta(s, cuenta.id, "INVITACION_CORREO");
    revalidatePath("/configuracion");
    return { ok: true, unaVez: { titulo: `Invitación enviada a ${ficha.nombre}`, valor: r.data.email,
      nota: "Le llegó un correo para activar su cuenta. Si no lo ve, que revise Spam; puedes reenviarlo con «Enviar acceso por correo» en Equipo." } };
  }
  await registrarCuenta(s, cuenta.id, "CLAVE_TEMPORAL");
  revalidatePath("/configuracion");
  return { ok: true, unaVez: { titulo: `Contraseña temporal de ${ficha.nombre}`, valor: cuenta.clave!,
    nota: `Entra en ${dominioApp()} con ${r.data.email} y esta contraseña. Al entrar activará la verificación en dos pasos y pondrá su propia contraseña. No se vuelve a mostrar.` } };
}

/** Editar la ficha de un asesor de pensiones (nombre y teléfono). Si tiene cuenta, su nombre se iguala. */
export async function actualizarFicha(socioId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await director();
  if (!s) return { error: "Solo el Director edita asesores." };
  const r = z.object({
    nombre: z.string().trim().min(2, "Escribe el nombre").max(120),
    telefono: z.string().trim().max(20).optional().transform((v) => (v ? v : null)),
  }).safeParse(datosDe(form));
  if (!r.success) return { errores: errores(r.error) };
  const res = await conUsuario(s.claims, async (tx): Promise<Resultado> => {
    if (await tx.socio.findFirst({ where: { archivado_at: null, id: { not: socioId }, nombre: { equals: r.data.nombre, mode: "insensitive" } }, select: { id: true } })) {
      return { errores: { nombre: "Ya hay un asesor de pensiones con ese nombre" } };
    }
    const n = await tx.socio.updateMany({ where: { id: socioId, archivado_at: null }, data: { nombre: r.data.nombre, telefono: r.data.telefono } });
    if (!n.count) return { error: "No encontramos al asesor." };
    await tx.usuario.updateMany({ where: { socio_id: socioId, rol: "socio" }, data: { nombre: r.data.nombre } });
    return { ok: true };
  }, s.ip);
  if (res.ok) { revalidatePath("/configuracion"); revalidatePath("/comisiones/beneficiarios"); revalidatePath("/hoy"); }
  return res;
}

/** Reenviar acceso por correo a una cuenta existente: le llega una liga para poner su contraseña (no se borra nada). */
export async function enviarAccesoPorCorreo(id: string): Promise<Resultado> {
  const s = await director();
  if (!s) return { error: "Solo el Director envía accesos." };
  if (id === s.usuario.id) return { error: "Tu propio acceso lo recuperas con «¿Olvidaste tu contraseña?»." };
  const u = await conUsuario(s.claims, (tx) => tx.usuario.findUnique({ where: { id }, select: { nombre: true, email: true, activo: true } }), s.ip);
  if (!u) return { error: "No encontramos al usuario." };
  if (!u.activo) return { error: "Primero dale acceso de nuevo." };
  const r = await enviarLigaContrasena(u.email);
  if (r.error) return { error: r.error };
  await registrarCuenta(s, id, "ACCESO_CORREO");
  return { ok: true, unaVez: { titulo: `Acceso enviado a ${u.nombre}`, valor: u.email,
    nota: "Le llegó un correo con una liga para poner su contraseña. Al entrar activa la verificación en dos pasos en su celular. La liga sirve una sola vez." } };
}
