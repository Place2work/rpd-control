"use server";

// Bandeja «Correos del IMSS»: asignar a un caso lo que no se pudo ligar solo, o descartarlo. Con RLS.
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { obtenerSesion } from "@/lib/auth/sesion";
import { hashIdentificador } from "@/lib/cripto";
import { adjuntarConstancia, constanciaDelCorreo } from "@/lib/correo/procesar";
import { conUsuario } from "@/lib/db/prisma";
import { guardarComoSistema } from "@/lib/documentos/almacen";
import { rutaDocumento } from "@/lib/documentos/reglas";

export type Resultado = { ok?: boolean; error?: string; errores?: Record<string, string> };

export async function asignarCorreo(correoId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director" && usuario.rol !== "asesor") return { error: "Solo el Director o el analista asignan correos." };
  const folio = String(form.get("folio") ?? "").trim().toUpperCase();
  if (!/^RP-\d{4,}$/.test(folio)) return { errores: { folio: "Escribe el folio del caso, como RP-0012" } };

  const datos = await conUsuario(claims, async (tx) => ({
    correo: await tx.correoEntrante.findUnique({ where: { id: correoId }, select: { id: true, resend_id: true, tipo: true, estado: true, liga: true } }),
    caso: await tx.caso.findFirst({ where: { folio, archivado_at: null }, select: { id: true, folio: true, persona_id: true,
      persona: { select: { nombre: true, apellido_paterno: true, nss_hash: true, curp_hash: true } } } }),
  }), ip);
  if (!datos.correo || datos.correo.estado !== "sin_caso") return { error: "Ese correo ya se asignó o no existe." };
  if (!datos.caso) return { errores: { folio: "No encontramos ese folio (o no tienes acceso a él)" } };
  const { correo, caso } = datos;
  const destino = { casoId: caso.id, personaId: caso.persona_id, solicitudId: null, avisar: [], folio: caso.folio,
    nombre: [caso.persona.nombre, caso.persona.apellido_paterno].filter(Boolean).join(" ") };

  if (correo.tipo === "constancia") {
    const pdf = await constanciaDelCorreo(correo.resend_id).catch(() => null);
    if (!pdf) return { error: "No se pudo volver a descargar la constancia del buzón. Intenta más tarde." };
    const l = pdf.lectura;
    const distinto = (l.nss && caso.persona.nss_hash && hashIdentificador("nss", l.nss) !== caso.persona.nss_hash)
      || (l.curp && caso.persona.curp_hash && hashIdentificador("curp", l.curp) !== caso.persona.curp_hash);
    if (distinto) return { errores: { folio: "La constancia es de otra persona (NSS o CURP distintos a los de ese caso)" } };
    const ruta = rutaDocumento(caso.id, randomUUID(), "application/pdf");
    await guardarComoSistema(ruta, pdf.bytes, "application/pdf");
    await conUsuario(claims, async (tx) => {
      const sol = await tx.solicitudConstancia.findFirst({ where: { caso_id: caso.id, estado: { in: ["pendiente", "confirmar"] }, archivado_at: null }, select: { id: true } });
      const docId = await adjuntarConstancia(tx, { ...destino, solicitudId: sol?.id ?? null }, ruta, pdf.bytes.length, l, correo.id, usuario.id);
      await tx.correoEntrante.update({ where: { id: correo.id }, data: { estado: "ligado", caso_id: caso.id, documento_id: docId, solicitud_id: sol?.id ?? null, asignado_por: usuario.id }, select: { id: true } });
    }, ip);
  } else if (correo.tipo === "confirmacion" && correo.liga) {
    await conUsuario(claims, async (tx) => {
      const viva = await tx.solicitudConstancia.findFirst({ where: { caso_id: caso.id, estado: { in: ["pendiente", "confirmar"] }, archivado_at: null }, select: { id: true } });
      const id = viva?.id ?? (await tx.solicitudConstancia.create({ data: { caso_id: caso.id, persona_id: caso.persona_id, created_by: usuario.id }, select: { id: true } })).id;
      await tx.solicitudConstancia.update({ where: { id }, data: { estado: "confirmar", liga_confirmacion: correo.liga }, select: { id: true } });
      await tx.correoEntrante.update({ where: { id: correo.id }, data: { estado: "ligado", caso_id: caso.id, solicitud_id: id, asignado_por: usuario.id }, select: { id: true } });
      await tx.evento.create({ data: { caso_id: caso.id, tipo: "sistema", usuario_id: usuario.id, datos: { campo: "constancia_imss" },
        texto: "Se asignó a este caso la liga del IMSS para confirmar la solicitud de la constancia (Documentos)." } });
    }, ip);
  } else {
    return { error: "Este correo no trae constancia ni liga; descártalo." };
  }
  revalidatePath("/correos-imss");
  revalidatePath(`/casos/${caso.id}`);
  return { ok: true };
}

export async function descartarCorreo(correoId: string): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director" && usuario.rol !== "asesor") return { error: "Solo el Director o el analista." };
  await conUsuario(claims, (tx) => tx.correoEntrante.updateMany({ where: { id: correoId, estado: "sin_caso" }, data: { estado: "descartado", asignado_por: usuario.id } }), ip);
  revalidatePath("/correos-imss");
  return { ok: true };
}
