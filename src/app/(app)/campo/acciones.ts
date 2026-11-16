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
import { centavos, semanaCerrada, whatsappMx } from "@/lib/reglas/campo";
import { cifrar, hashIdentificador } from "@/lib/cripto";
import { curpParcial, validarCurp } from "@/lib/reglas/identificadores";
import { hoyCDMX } from "@/lib/tiempo";
import type { Resultado } from "../casos/[id]/acciones";

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const UUID = /^[0-9a-f-]{36}$/i;
const fechaDb = (iso: string) => new Date(`${iso}T00:00:00Z`);
const revisores = new Set(["director", "asesor"]);
/** Monto del día escrito por el Director (varía por ubicación). Vacío = usar la tarifa vigente. */
function montoDia(form: FormData): { cent: number | null } | { error: string } {
  const v = txt(form, "monto");
  if (!v) return { cent: null };
  try { return { cent: centavos(v) }; } catch { return { error: "Escribe el monto en pesos, por ejemplo 250 o 300.50" }; }
}
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

// ───────────── Analista y Director: alta desde oficina y gerente asignado ─────────────

/**
 * Prospecto de campo capturado por el Director o el analista. Puede quedar con un gerente de campo desde ya o sin
 * gerente (se le asigna después). Sigue el mismo flujo: verificar, asignar y pago semanal al gerente.
 */
export async function altaOficinaCampo(_p: Resultado, form: FormData): Promise<Resultado> {
  const s = await obtenerSesion();
  if (!revisores.has(s.usuario.rol)) return { error: "Solo el analista o el Director." };
  const nombre = txt(form, "nombre"), municipio = txt(form, "municipio"), lugar = txt(form, "lugar"), servicio = txt(form, "tipo_servicio");
  const whatsapp = whatsappMx(txt(form, "whatsapp")), gerenteId = txt(form, "gerente_id") || null;
  const curpTexto = txt(form, "curp"), curp = curpTexto ? validarCurp(curpTexto) : null;
  const errores: Record<string, string> = {};
  if (nombre.length < 2) errores.nombre = "Escribe el nombre";
  if (!whatsapp) errores.whatsapp = "Escribe 10 dígitos";
  if (!curp) errores.curp = "Escribe la CURP (18 caracteres)";
  else if (!curp.valido) errores.curp = curp.error;
  if (municipio.length < 2) errores.municipio = "Escribe el municipio";
  if (gerenteId && !UUID.test(gerenteId)) errores.gerente_id = "Gerente no válido";
  if (Object.keys(errores).length || !curp?.valido) return { errores };
  const curpHash = hashIdentificador("curp", curp.valor);
  const r = await conUsuario(s.claims, async (tx) => {
    const [dup] = await tx.$queryRaw<{ r: boolean }[]>`SELECT app.telefono_registrado(${whatsapp}) AS r`;
    if (dup?.r) return "repetido";
    const [dupCurp] = await tx.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM app.buscar_duplicados(NULL, ${curpHash}, NULL)`;
    const curpCampo = await tx.campoProspecto.findFirst({ where: { curp_hash: curpHash, estado: { not: "rechazado" }, archivado_at: null }, select: { id: true } });
    if (dupCurp?.n || curpCampo) return "repetido";
    const valido = servicio ? await tx.tipoServicio.findFirst({ where: { clave: servicio, activo: true }, select: { clave: true } }) : null;
    await tx.campoProspecto.create({ select: { id: true }, data: {
      gerente_id: gerenteId, nombre, whatsapp: whatsapp!, municipio, lugar: lugar || null, tipo_servicio: valido?.clave ?? null, notas: txt(form, "notas") || null,
      curp_cifrada: cifrar(curp.valor), curp_hash: curpHash, curp_parcial: curpParcial(curp.valor),
    } });
    return "ok";
  }, s.ip);
  if (r === "repetido") return { errores: { whatsapp: "Ese WhatsApp o esa CURP ya están registrados" } };
  refrescar();
  return { ok: true, mensaje: `Listo: ${nombre} quedó por verificar${gerenteId ? "" : ", sin gerente por ahora"}.` };
}

/** Asigna (o cambia) el gerente de campo de un prospecto mientras no se le haya pagado. Vacío = sin gerente. */
export async function asignarGerenteCampo(id: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await obtenerSesion();
  if (!revisores.has(s.usuario.rol)) return { error: "Solo el analista o el Director." };
  const gerenteId = txt(form, "gerente_id") || null;
  if (!UUID.test(id) || (gerenteId && !UUID.test(gerenteId))) return { error: "Datos no válidos." };
  const n = await conUsuario(s.claims, (tx) => tx.campoProspecto.updateMany({ where: { id, pago_id: null, estado: { not: "rechazado" } }, data: { gerente_id: gerenteId } }), s.ip);
  if (!n.count) return { error: "Ya se pagó o no cuenta: no se puede cambiar de gerente." };
  refrescar();
  return { ok: true, mensaje: gerenteId ? "Gerente asignado." : "Quedó sin gerente." };
}

/**
 * Director: quita un prospecto de campo (una prueba o un error). No se borra: se archiva con motivo y deja de contar
 * para el pago del gerente. Si ya se verificó, también puede archivar el caso que se creó. Lo pagado no se toca.
 */
export async function quitarCampo(id: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await obtenerSesion();
  if (s.usuario.rol !== "director") return { error: "Solo el Director quita prospectos de campo." };
  const motivo = txt(form, "motivo");
  if (!UUID.test(id)) return { error: "Prospecto no válido." };
  if (motivo.length < 3) return { errores: { motivo: "Escribe el motivo" } };
  const conCaso = form.get("archivar_caso") === "si";
  const r = await conUsuario(s.claims, async (tx) => {
    const p = await tx.campoProspecto.findUnique({ where: { id }, select: { pago_id: true, caso_id: true, archivado_at: true, nombre: true } });
    if (!p || p.archivado_at) return "no";
    if (p.pago_id) return "pagado";
    await tx.campoProspecto.update({ where: { id }, select: { id: true }, data: { archivado_at: new Date(), archivo_motivo: motivo } });
    if (conCaso && p.caso_id) {
      await tx.caso.update({ where: { id: p.caso_id }, select: { id: true }, data: { archivado_at: new Date(), motivo_archivo: `Prospecto de campo quitado: ${motivo}` } });
      await tx.evento.create({ data: { caso_id: p.caso_id, tipo: "sistema", usuario_id: s.usuario.id, texto: `Caso archivado al quitar el prospecto de campo: ${motivo}` } });
    }
    return "ok";
  }, s.ip);
  if (r === "no") return { error: "Ese prospecto ya no está." };
  if (r === "pagado") return { error: "Ya se le pagó al gerente: no se puede quitar." };
  refrescar();
  revalidatePath("/casos");
  revalidatePath("/prospectos");
  return { ok: true, mensaje: "Listo: se quitó y ya no cuenta para el pago." };
}

// ───────────── Analista y Director: verificación ─────────────

/** Verificado: se crea el prospecto normal (persona + caso, origen campo) y, si se elige, se asigna al asesor de pensiones y/o a un vendedor. */
export async function verificarCampo(id: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await obtenerSesion();
  if (!revisores.has(s.usuario.rol)) return { error: "Solo el analista o el Director verifican." };
  if (!UUID.test(id)) return { error: "Prospecto no válido." };
  const servicio = txt(form, "tipo_servicio"), socioId = txt(form, "socio_id") || null, vendedorId = txt(form, "vendedor_id") || null;
  if (!servicio) return { errores: { tipo_servicio: "Elige el servicio" } };
  if (socioId && !UUID.test(socioId)) return { errores: { socio_id: "Asesor no válido" } };
  if (vendedorId && !UUID.test(vendedorId)) return { errores: { vendedor_id: "Vendedor no válido" } };
  const previo = await conUsuario(s.claims, async (tx) => ({
    p: await tx.campoProspecto.findUnique({ where: { id }, select: { estado: true, nombre: true, whatsapp: true, municipio: true, fecha_baja: true, fecha_registro: true, gerente_id: true, curp_cifrada: true, curp_hash: true, curp_parcial: true } }),
    servicio: await tx.tipoServicio.findFirst({ where: { clave: servicio, activo: true }, select: { clave: true, embudo: true } }),
    cuenta: socioId ? await tx.usuario.findFirst({ where: { socio_id: socioId, activo: true, archivado_at: null }, select: { id: true, nombre: true } }) : null,
    vendedor: vendedorId ? await tx.usuario.findFirst({ where: { id: vendedorId, rol: "vendedor", activo: true, archivado_at: null }, select: { id: true, nombre: true } }) : null,
  }), s.ip);
  if (vendedorId && !previo.vendedor) return { errores: { vendedor_id: "Ese vendedor ya no está activo" } };
  if (!previo.p || previo.p.estado !== "pendiente") return { error: "Ese prospecto ya se revisó." };
  if (!previo.servicio) return { errores: { tipo_servicio: "Elige el servicio" } };
  if (socioId && previo.servicio.embudo === "pension" && previo.cuenta && (await permisoDeOtro(s, previo.cuenta.id, "prospecto.pension.recibir")) === false) {
    return { errores: { socio_id: `${previo.cuenta.nombre} todavía no tiene la certificación P1 para recibir casos de pensión` } };
  }
  // fecha_registro es DATE (medianoche UTC): se lee tal cual, sin pasarla a hora de México (eso la recorría un día).
  const tarifa = await tarifasCampo(previo.p.fecha_registro.toISOString().slice(0, 10));
  const p = previo.p;
  const r = await conUsuario(s.claims, async (tx) => {
    const [dup] = await tx.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM app.buscar_duplicados(${p.whatsapp}, ${p.curp_hash}, NULL)`;
    if (dup?.n) return "repetido";
    const [nombre, ...resto] = p.nombre.split(/\s+/);
    const persona = await tx.persona.create({ select: { id: true }, data: {
      nombre, apellido_paterno: resto[0] ?? null, apellido_materno: resto.slice(1).join(" ") || null,
      telefono: p.whatsapp, whatsapp: p.whatsapp, municipio: p.municipio, origen: "campo", owner_id: s.usuario.id,
      // La CURP que dejó en el formulario pasa cifrada tal cual (no se descifra aquí).
      ...(p.curp_hash ? { curp_cifrada: p.curp_cifrada, curp_hash: p.curp_hash, curp_parcial: p.curp_parcial } : {}),
    } });
    const caso = await tx.caso.create({ select: { id: true }, data: {
      persona_id: persona.id, tipo_servicio: servicio, owner_id: s.usuario.id, socio_id: socioId, vendedor_id: previo.vendedor?.id ?? null,
      asignado_a: s.usuario.rol === "asesor" ? s.usuario.id : undefined, fecha_primer_contacto: fechaDb(hoyCDMX()),
    } });
    if (p.fecha_baja) await tx.datosImss.create({ data: { caso_id: caso.id, fecha_baja: p.fecha_baja } });
    await tx.historialEtapa.create({ data: { caso_id: caso.id, etapa_nueva: "PROSPECTO", usuario_id: s.usuario.id } });
    await tx.evento.create({ data: { caso_id: caso.id, tipo: "sistema", usuario_id: s.usuario.id, datos: { origen: "campo" },
      texto: `Alta desde campo (${p.municipio}), verificado por teléfono${previo.cuenta ? ` · asesor de pensiones: ${previo.cuenta.nombre}` : ""}${previo.vendedor ? ` · vendedor: ${previo.vendedor.nombre}` : ""}.` } });
    await tx.campoProspecto.update({ where: { id }, select: { id: true }, data: {
      estado: "verificado", verificado_por: s.usuario.id, verificado_at: new Date(), monto_cent: tarifa.prospectoCent, caso_id: caso.id,
    } });
    return caso.id;
  }, s.ip);
  if (r === "repetido") return { error: "Ese WhatsApp o esa CURP ya son de un cliente: recházalo como «Repetido»." };
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
  // El Director puede poner otro monto para ese día (depende de la ubicación); el analista aprueba con la tarifa vigente.
  const m = aprobar && s.usuario.rol === "director" ? montoDia(form) : { cent: null };
  if ("error" in m) return { errores: { monto: m.error } };
  await conUsuario(s.claims, (tx) => tx.campoJornada.update({ where: { id }, select: { id: true }, data: aprobar
    ? { estado: "aprobada", revisada_por: s.usuario.id, revisada_at: new Date(), monto_cent: m.cent ?? tarifa.diaCent }
    : { estado: "rechazada", motivo, revisada_por: s.usuario.id, revisada_at: new Date() } }), s.ip);
  refrescar();
  return { ok: true };
}

/** El Director corrige el pago de un día ya aprobado mientras no se haya pagado (la bitácora guarda el cambio). */
export async function ajustarPagoDia(id: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const s = await obtenerSesion();
  if (s.usuario.rol !== "director") return { error: "Solo el Director cambia el pago de un día." };
  if (!UUID.test(id)) return { error: "Datos no válidos." };
  const m = montoDia(form);
  if ("error" in m) return { errores: { monto: m.error } };
  if (m.cent === null) return { errores: { monto: "Escribe el monto" } };
  const n = await conUsuario(s.claims, (tx) => tx.campoJornada.updateMany({ where: { id, estado: "aprobada", pago_id: null }, data: { monto_cent: m.cent } }), s.ip);
  if (!n.count) return { error: "Ese día ya se pagó o no está aprobado." };
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
