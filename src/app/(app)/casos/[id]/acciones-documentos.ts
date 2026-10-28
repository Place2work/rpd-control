"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { obtenerSesion, type Sesion } from "@/lib/auth/sesion";
import { documentosPendientes } from "@/lib/casos/foto";
import { conUsuario, type Tx } from "@/lib/db/prisma";
import { prepararSubida, urlLectura, type Subida } from "@/lib/documentos/almacen";
import { rutaDocumento, validarArchivo } from "@/lib/documentos/reglas";
import { parametrosFechas } from "@/lib/parametros";
import { formatoFechaLarga } from "@/lib/formato";
import { sumarDias, sumarDiasHabiles } from "@/lib/reglas/fechas";
import { hoyCDMX } from "@/lib/tiempo";

const fecha = (iso: string) => new Date(`${iso}T00:00:00Z`);

// El expediente es de quien opera el caso: el vendedor no sube ni ve documentos (sección 3).
function puedeOperar(s: Sesion) {
  return s.usuario.rol !== "vendedor";
}

export async function prepararDocumento(casoId: string, tipoId: string, mime: string, bytes: number): Promise<{ subida?: Subida; error?: string }> {
  const sesion = await obtenerSesion();
  if (!puedeOperar(sesion)) return { error: "Tu rol no sube documentos del expediente." };
  const problema = validarArchivo(mime, bytes);
  if (problema) return { error: problema };
  // El tipo debe aplicar al servicio del caso; RLS confirma que el caso es operable.
  const aplica = await conUsuario(sesion.claims, async (tx) => {
    const caso = await tx.caso.findUnique({ where: { id: casoId }, select: { tipo_servicio: true } });
    if (!caso) return false;
    return Boolean(await tx.tipoDocumentoServicio.findUnique({
      where: { tipo_documento_id_tipo_servicio: { tipo_documento_id: tipoId, tipo_servicio: caso.tipo_servicio } },
    }));
  }, sesion.ip);
  if (!aplica) return { error: "Ese documento no corresponde a este caso." };
  try {
    return { subida: await prepararSubida(rutaDocumento(casoId, randomUUID(), mime)) };
  } catch {
    return { error: "No se pudo preparar la subida. Intenta de nuevo." };
  }
}

export async function registrarDocumento(
  casoId: string, tipoId: string, ruta: string, mime: string, bytes: number, fechaEmision: string | null,
): Promise<{ ok?: boolean; error?: string }> {
  const sesion = await obtenerSesion();
  if (!puedeOperar(sesion)) return { error: "Tu rol no sube documentos del expediente." };
  if (!ruta.startsWith(`${casoId}/`)) return { error: "Ruta de archivo no válida." };
  if (fechaEmision && !/^\d{4}-\d{2}-\d{2}$/.test(fechaEmision)) return { error: "Fecha de emisión no válida." };

  const r = await conUsuario(sesion.claims, async (tx) => {
    const tipo = await tx.tipoDocumento.findUnique({ where: { id: tipoId }, select: { nombre: true, vigencia_dias: true } });
    if (!tipo) return { error: "Tipo de documento desconocido." };
    if (tipo.vigencia_dias && !fechaEmision) return { error: `Captura la fecha de emisión: este documento vale ${tipo.vigencia_dias} días.` };
    await tx.documento.create({
      data: {
        caso_id: casoId, tipo_id: tipoId, estado: "recibido", archivo_path: ruta, archivo_mime: mime, archivo_bytes: bytes,
        fecha_emision: fechaEmision ? fecha(fechaEmision) : null,
        fecha_vencimiento: fechaEmision && tipo.vigencia_dias ? fecha(sumarDias(fechaEmision, tipo.vigencia_dias)) : null,
      },
      select: { id: true },
    });
    await tx.evento.create({ data: { caso_id: casoId, tipo: "documento", texto: `Se recibió: ${tipo.nombre}`, usuario_id: sesion.usuario.id } });
    return { ok: true };
  }, sesion.ip);
  if (r.ok) revalidatePath(`/casos/${casoId}`);
  return r;
}

export async function revisarDocumento(casoId: string, documentoId: string, decision: "validado" | "rechazado", motivo: string | null): Promise<{ ok?: boolean; error?: string }> {
  const sesion = await obtenerSesion();
  if (!puedeOperar(sesion)) return { error: "Tu rol no valida documentos." };
  if (decision === "rechazado" && (!motivo || motivo.trim().length < 5)) return { error: "Escribe por qué se rechaza (mínimo 5 caracteres)." };
  const hoy = hoyCDMX();
  const p = await parametrosFechas(hoy);

  const r: { ok?: boolean; error?: string } = await conUsuario(sesion.claims, async (tx) => {
    const doc = await tx.documento.update({
      where: { id: documentoId, caso_id: casoId },
      data: decision === "validado"
        ? { estado: "validado", validado_por: sesion.usuario.id, validado_at: new Date(), motivo_rechazo: null }
        : { estado: "rechazado", motivo_rechazo: motivo!.trim(), validado_por: null, validado_at: null },
      select: { tipo: { select: { nombre: true } } },
    });
    await tx.evento.create({
      data: {
        caso_id: casoId, tipo: "documento", usuario_id: sesion.usuario.id,
        texto: decision === "validado" ? `Validado: ${doc.tipo.nombre}` : `Rechazado: ${doc.tipo.nombre} — ${motivo!.trim()}`,
      },
    });
    if (decision === "validado") await marcarSiCompleto(tx, casoId, hoy, p, sesion.usuario.id);
    return { ok: true };
  }, sesion.ip).catch(() => ({ error: "No se pudo guardar la revisión." }));
  if (r.ok) revalidatePath(`/casos/${casoId}`);
  return r;
}

// Expediente completo (6.1 etapa 4 → 5): arranca los 15 días hábiles para ingresar (2.4).
async function marcarSiCompleto(tx: Tx, casoId: string, hoy: string, p: Awaited<ReturnType<typeof parametrosFechas>>, usuarioId: string) {
  const caso = await tx.caso.findUnique({ where: { id: casoId }, select: { tipo_servicio: true, fecha_expediente_completo: true } });
  if (!caso || caso.fecha_expediente_completo) return;
  if ((await documentosPendientes(tx, casoId, caso.tipo_servicio, hoy)) > 0) return;
  const limite = sumarDiasHabiles(hoy, p.SLA_DIAS_HABILES, p.inhabiles);
  await tx.caso.update({ where: { id: casoId }, data: { fecha_expediente_completo: fecha(hoy), fecha_limite_ingreso: fecha(limite) }, select: { id: true } });
  await tx.evento.create({
    data: { caso_id: casoId, tipo: "sistema", usuario_id: usuarioId,
      texto: `Expediente completo. Límite para ingresar a la Afore: ${formatoFechaLarga(limite)} (${p.SLA_DIAS_HABILES} días hábiles)` },
  });
}

/** URL firmada de 10 minutos; la base deja renglón en la bitácora antes de entregarla. */
export async function verDocumento(documentoId: string): Promise<{ url?: string; error?: string }> {
  const sesion = await obtenerSesion();
  if (!puedeOperar(sesion)) return { error: "Tu rol no ve documentos del expediente." };
  try {
    const filas = await conUsuario(sesion.claims,
      (tx) => tx.$queryRaw<{ ruta: string | null }[]>`SELECT app.registrar_vista_documento(${documentoId}::uuid) AS ruta`, sesion.ip);
    const ruta = filas[0]?.ruta;
    if (!ruta) return { error: "El documento no tiene archivo." };
    return { url: await urlLectura(ruta) };
  } catch {
    return { error: "No tienes acceso a este documento." };
  }
}
