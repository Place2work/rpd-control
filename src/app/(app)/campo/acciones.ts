"use server";

// Gerente de campo: alta de prospectos en la calle y foto del día; el analista verifica (y convierte en prospecto
// normal) o rechaza; el Director registra el pago semanal. Todo con RLS (conUsuario).
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { obtenerSesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { permisoDeOtro } from "@/lib/academia/permisos";
import { prepararSubida, type Subida } from "@/lib/documentos/almacen";
import { liquidacionesDe, tarifasCampo } from "@/lib/campo/datos";
import { semanaCerrada, whatsappMx } from "@/lib/reglas/campo";
import { hoyCDMX } from "@/lib/tiempo";
import type { Resultado } from "../casos/[id]/acciones";

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const UUID = /^[0-9a-f-]{36}$/i;
const fechaDb = (iso: string) => new Date(`${iso}T00:00:00Z`);
const revisores = new Set(["director", "asesor"]);
const refrescar = () => { revalidatePath("/campo"); revalidatePath("/campo/revisar"); revalidatePath("/campo/pagos"); };

// ───────────── Gerente de campo ─────────────

export async function altaCampo(_p: Resultado, form: FormData): Promise<Resultado> {
  const s = await obtenerSesion();
  if (s.usuario.rol !== "campo") return { error: "Solo el gerente de campo registra prospectos aquí." };
  const nombre = txt(form, "nombre"), municipio = txt(form, "municipio"), lugar = txt(form, "lugar"), servicio = txt(form, "tipo_servicio");
  const whatsapp = whatsappMx(txt(form, "whatsapp")), fechaBaja = txt(form, "fecha_baja");
  const errores: Record<string, string> = {};
  if (nombre.length < 2) errores.nombre = "Escribe el nombre";
  if (!whatsapp) errores.whatsapp = "Escribe 10 dígitos";
  if (municipio.length < 2) errores.municipio = "Escribe el municipio";
  if (fechaBaja && (!/^\d{4}-\d{2}-\d{2}$/.test(fechaBaja) || fechaBaja > hoyCDMX())) errores.fecha_baja = "Fecha no válida";
  if (Object.keys(errores).length) return { errores };
  const r = await conUsuario(s.claims, async (tx) => {
    const [dup] = await tx.$queryRaw<{ r: boolean }[]>`SELECT app.telefono_registrado(${whatsapp}) AS r`;
    if (dup?.r) return "repetido";
    const valido = servicio ? await tx.tipoServicio.findFirst({ where: { clave: servicio, activo: true }, select: { clave: true } }) : null;
    await tx.campoProspecto.create({ select: { id: true }, data: {
      nombre, whatsapp: whatsapp!, municipio, lugar: lugar || null, tipo_servicio: valido?.clave ?? null, fecha_baja: fechaBaja ? fechaDb(fechaBaja) : null, notas: txt(form, "notas") || null,
    } });
    return "ok";
  }, s.ip);
  if (r === "repetido") return { errores: { whatsapp: "Ese WhatsApp ya está registrado: no cuenta como prospecto nuevo" } };
  refrescar();
  return { ok: true, mensaje: `Listo: ${nombre} quedó registrado. El analista lo verifica.` };
}

/** Liga firmada para subir la foto del módulo directo al almacén (carpeta del propio gerente). */
export async function prepararFotoCampo(mime: string, bytes: number): Promise<{ subida?: Subida; error?: string }> {
  const s = await obtenerSesion();
  if (s.usuario.rol !== "campo") return { error: "Solo el gerente de campo sube la foto del módulo." };
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" }[mime];
  if (!ext) return { error: "Sube una foto (JPG, PNG, WEBP o HEIC)" };
  if (bytes <= 0 || bytes > 15 * 1024 * 1024) return { error: "La foto pesa más de 15 MB" };
  return { subida: await prepararSubida(`${s.usuario.id}/${randomUUID()}.${ext}`, "campo") };
}

export async function registrarJornada(ruta: string, municipio: string, lugar: string): Promise<Resultado> {
  const s = await obtenerSesion();
  if (s.usuario.rol !== "campo") return { error: "Solo el gerente de campo registra su día." };
  if (municipio.trim().length < 2 || lugar.trim().length < 2) return { error: "Escribe el municipio y el lugar donde pusiste el módulo." };
  if (!new RegExp(`^${s.usuario.id}/[0-9a-f-]{36}\\.(jpg|png|webp|heic)$`).test(ruta)) return { error: "Foto no válida." };
  try {
    await conUsuario(s.claims, (tx) => tx.campoJornada.create({ select: { id: true }, data: { municipio: municipio.trim(), lugar: lugar.trim(), foto_path: ruta } }), s.ip);
  } catch {
    return { error: "Ya registraste tu día de hoy." };
  }
  refrescar();
  return { ok: true };
}

// ───────────── Analista y Director: verificación ─────────────

/** Verificado: se crea el prospecto normal (persona + caso, origen campo) y, si se elige, se asigna al asesor de pensiones. */
export async function verificarCampo(id: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await obtenerSesion();
  if (!revisores.has(s.usuario.rol)) return { error: "Solo el analista o el Director verifican." };
  if (!UUID.test(id)) return { error: "Prospecto no válido." };
  const servicio = txt(form, "tipo_servicio"), socioId = txt(form, "socio_id") || null;
  if (!servicio) return { errores: { tipo_servicio: "Elige el servicio" } };
  if (socioId && !UUID.test(socioId)) return { errores: { socio_id: "Asesor no válido" } };
  const previo = await conUsuario(s.claims, async (tx) => ({
    p: await tx.campoProspecto.findUnique({ where: { id }, select: { estado: true, nombre: true, whatsapp: true, municipio: true, fecha_baja: true, fecha_registro: true, gerente_id: true } }),
    servicio: await tx.tipoServicio.findFirst({ where: { clave: servicio, activo: true }, select: { clave: true, embudo: true } }),
    cuenta: socioId ? await tx.usuario.findFirst({ where: { socio_id: socioId, activo: true, archivado_at: null }, select: { id: true, nombre: true } }) : null,
  }), s.ip);
  if (!previo.p || previo.p.estado !== "pendiente") return { error: "Ese prospecto ya se revisó." };
  if (!previo.servicio) return { errores: { tipo_servicio: "Elige el servicio" } };
  if (socioId && previo.servicio.embudo === "pension" && previo.cuenta && (await permisoDeOtro(s, previo.cuenta.id, "prospecto.pension.recibir")) === false) {
    return { errores: { socio_id: `${previo.cuenta.nombre} todavía no tiene la certificación P1 para recibir casos de pensión` } };
  }
  const tarifa = await tarifasCampo(hoyCDMX(previo.p.fecha_registro));
  const p = previo.p;
  const r = await conUsuario(s.claims, async (tx) => {
    const [dup] = await tx.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM app.buscar_duplicados(${p.whatsapp}, NULL, NULL)`;
    if (dup?.n) return "repetido";
    const [nombre, ...resto] = p.nombre.split(/\s+/);
    const persona = await tx.persona.create({ select: { id: true }, data: {
      nombre, apellido_paterno: resto[0] ?? null, apellido_materno: resto.slice(1).join(" ") || null,
      telefono: p.whatsapp, whatsapp: p.whatsapp, municipio: p.municipio, origen: "campo", owner_id: s.usuario.id,
    } });
    const caso = await tx.caso.create({ select: { id: true }, data: {
      persona_id: persona.id, tipo_servicio: servicio, owner_id: s.usuario.id, socio_id: socioId,
      asignado_a: s.usuario.rol === "asesor" ? s.usuario.id : undefined, fecha_primer_contacto: fechaDb(hoyCDMX()),
    } });
    if (p.fecha_baja) await tx.datosImss.create({ data: { caso_id: caso.id, fecha_baja: p.fecha_baja } });
    await tx.historialEtapa.create({ data: { caso_id: caso.id, etapa_nueva: "PROSPECTO", usuario_id: s.usuario.id } });
    await tx.evento.create({ data: { caso_id: caso.id, tipo: "sistema", usuario_id: s.usuario.id, datos: { origen: "campo" },
      texto: `Alta desde campo (${p.municipio}), verificado por teléfono${previo.cuenta ? ` · asignado a ${previo.cuenta.nombre}` : ""}.` } });
    await tx.campoProspecto.update({ where: { id }, select: { id: true }, data: {
      estado: "verificado", verificado_por: s.usuario.id, verificado_at: new Date(), monto_cent: tarifa.prospectoCent, caso_id: caso.id,
    } });
    return caso.id;
  }, s.ip);
  if (r === "repetido") return { error: "Ese WhatsApp ya es de un cliente: recházalo como «Repetido»." };
  refrescar();
  revalidatePath("/prospectos");
  return { ok: true, mensaje: "Verificado: ya es prospecto en el sistema." };
}

export async function sinRespuestaCampo(id: string): Promise<Resultado> {
  const s = await obtenerSesion();
  if (!revisores.has(s.usuario.rol)) return { error: "Solo el analista o el Director." };
  await conUsuario(s.claims, (tx) => tx.campoProspecto.update({ where: { id }, select: { id: true }, data: { intentos: { increment: 1 }, ultimo_intento_at: new Date() } }), s.ip);
  refrescar();
  return { ok: true };
}

export async function rechazarCampo(id: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await obtenerSesion();
  if (!revisores.has(s.usuario.rol)) return { error: "Solo el analista o el Director." };
  const motivo = txt(form, "motivo");
  if (motivo.length < 3) return { errores: { motivo: "Elige el motivo" } };
  const n = await conUsuario(s.claims, (tx) => tx.campoProspecto.updateMany({ where: { id, estado: "pendiente" }, data: { estado: "rechazado", motivo_rechazo: motivo, verificado_por: s.usuario.id, verificado_at: new Date() } }), s.ip);
  refrescar();
  return n.count ? { ok: true } : { error: "Ese prospecto ya se revisó." };
}

export async function revisarJornada(id: string, aprobar: boolean, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await obtenerSesion();
  if (!revisores.has(s.usuario.rol)) return { error: "Solo el analista o el Director." };
  const motivo = txt(form, "motivo");
  if (!aprobar && motivo.length < 3) return { errores: { motivo: "Escribe el motivo" } };
  const j = await conUsuario(s.claims, (tx) => tx.campoJornada.findUnique({ where: { id }, select: { estado: true, fecha: true } }), s.ip);
  if (!j || j.estado !== "pendiente") return { error: "Ese día ya se revisó." };
  const tarifa = await tarifasCampo(j.fecha.toISOString().slice(0, 10));
  await conUsuario(s.claims, (tx) => tx.campoJornada.update({ where: { id }, select: { id: true }, data: aprobar
    ? { estado: "aprobada", revisada_por: s.usuario.id, revisada_at: new Date(), monto_cent: tarifa.diaCent }
    : { estado: "rechazada", motivo, revisada_por: s.usuario.id, revisada_at: new Date() } }), s.ip);
  refrescar();
  return { ok: true };
}

// ───────────── Director: pago semanal ─────────────

/** Registra el pago de una semana ya cerrada (lo verificado y aprobado de lunes a domingo) y lo liga a cada pieza. */
export async function pagarSemanaCampo(gerenteId: string, semanaFin: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await obtenerSesion();
  if (s.usuario.rol !== "director") return { error: "Solo el Director registra pagos." };
  if (!UUID.test(gerenteId) || !/^\d{4}-\d{2}-\d{2}$/.test(semanaFin)) return { error: "Datos no válidos." };
  const { diasParaPago } = await tarifasCampo();
  const r = await conUsuario(s.claims, async (tx) => {
    const l = (await liquidacionesDe(tx, gerenteId, diasParaPago)).find((x) => x.semanaFin === semanaFin);
    if (!l || !l.totalCent) return "nada";
    if (!semanaCerrada(l, hoyCDMX())) return "abierta";
    const pago = await tx.campoPago.create({ select: { id: true }, data: {
      gerente_id: gerenteId, semana_inicio: fechaDb(l.semanaInicio), semana_fin: fechaDb(l.semanaFin), fecha_pago: fechaDb(l.fechaPago),
      prospectos: l.prospectos.length, dias: l.dias.length, monto_prospectos_cent: BigInt(l.montoProspectosCent), monto_dias_cent: BigInt(l.montoDiasCent),
      total_cent: BigInt(l.totalCent), referencia: txt(form, "referencia") || null, pagado_por: s.usuario.id,
    } });
    if (l.prospectos.length) await tx.campoProspecto.updateMany({ where: { id: { in: l.prospectos } }, data: { pago_id: pago.id } });
    if (l.dias.length) await tx.campoJornada.updateMany({ where: { id: { in: l.dias } }, data: { pago_id: pago.id } });
    return "ok";
  }, s.ip);
  if (r === "nada") return { error: "No hay nada pendiente de esa semana." };
  if (r === "abierta") return { error: "La semana todavía no cierra (el corte es el domingo)." };
  refrescar();
  return { ok: true, mensaje: "Pago registrado." };
}
