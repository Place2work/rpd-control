// Procesa un correo del buzón de constancias (12-nov-2026). Lo llama /api/correo/entrante (proceso del sistema,
// sin usuario: prismaSistema, como /api/leads) y la bandeja «Correos del IMSS» al asignar uno a mano (con RLS).
// - PDF de constancia → se adjunta al caso del cliente (por NSS/CURP) como «Por revisar» y se avisa.
// - Liga de confirmación del IMSS → queda en el caso como botón «Confirmar en el IMSS» y se avisa.
// - Lo que no se pueda ligar → bandeja para asignarlo.
import "server-only";
import { randomUUID } from "node:crypto";
import { renglonesDePdf } from "@/lib/constancia/extraer";
import { hashIdentificador } from "@/lib/cripto";
import { prismaSistema, type Tx } from "@/lib/db/prisma";
import { guardarComoSistema } from "@/lib/documentos/almacen";
import { rutaDocumento } from "@/lib/documentos/reglas";
import { esConstanciaSemanas, leerConstancia, type LecturaConstancia } from "@/lib/reglas/constancia";
import { autenticado, esRemitenteImss, identificadoresEnTexto, ligaDeConfirmacion, ligasImss, solicitudUnicaReciente } from "@/lib/reglas/correo-imss";
import { hoyCDMX } from "@/lib/tiempo";
import { descargarPdf, listarAdjuntos, obtenerCorreoRecibido } from "./resend";

export const TIPO_CONSTANCIA = "Constancia de semanas cotizadas";
const VIVAS = ["pendiente", "confirmar"];
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);

type Destino = { casoId: string; personaId: string; solicitudId: string | null; avisar: string[]; folio: string; nombre: string };

/** PDF adjunto que sea constancia de semanas: bytes y lectura. */
export async function constanciaDelCorreo(emailId: string): Promise<{ bytes: Uint8Array; lectura: LecturaConstancia } | null> {
  for (const a of await listarAdjuntos(emailId)) {
    const bytes = await descargarPdf(a);
    if (!bytes) continue;
    try {
      const renglones = await renglonesDePdf(bytes);
      if (esConstanciaSemanas(renglones)) return { bytes, lectura: leerConstancia(renglones) };
    } catch (e) { console.error("[correo] PDF ilegible", e); }
  }
  return null;
}

async function directores(tx: Tx) {
  return (await tx.usuario.findMany({ where: { rol: "director", activo: true, archivado_at: null }, select: { id: true } })).map((u) => u.id);
}

/** Caso al que pertenece: la solicitud viva más reciente de esas personas o, si no hay, su caso vivo más reciente que pida constancia. */
async function destinoPorPersonas(tx: Tx, personas: string[]): Promise<Destino | null> {
  if (!personas.length) return null;
  const sol = await tx.solicitudConstancia.findFirst({
    where: { persona_id: { in: personas }, estado: { in: VIVAS }, archivado_at: null }, orderBy: { created_at: "desc" },
    select: { id: true, created_by: true, caso: { select: { id: true, persona_id: true, folio: true, asignado_a: true, persona: { select: { nombre: true, apellido_paterno: true } } } } },
  });
  const caso = sol?.caso ?? await tx.caso.findFirst({
    where: { persona_id: { in: personas }, archivado_at: null, etapa: { not: "PERDIDO" },
      servicio: { tipos_documento: { some: { tipo_documento: { nombre: TIPO_CONSTANCIA } } } } },
    orderBy: { created_at: "desc" },
    select: { id: true, persona_id: true, folio: true, asignado_a: true, persona: { select: { nombre: true, apellido_paterno: true } } },
  });
  if (!caso) return null;
  const avisar = [sol?.created_by, caso.asignado_a].filter((x): x is string => Boolean(x));
  return { casoId: caso.id, personaId: caso.persona_id, solicitudId: sol?.id ?? null, avisar: [...new Set(avisar)], folio: caso.folio,
    nombre: [caso.persona.nombre, caso.persona.apellido_paterno].filter(Boolean).join(" ") };
}

async function personasPorIdentificadores(tx: Tx, curps: string[], nsss: string[]) {
  const hashes = [...curps.map((c) => ({ curp_hash: hashIdentificador("curp", c) })), ...nsss.map((n) => ({ nss_hash: hashIdentificador("nss", n) }))];
  if (!hashes.length) return [];
  return (await tx.persona.findMany({ where: { OR: hashes, archivado_at: null }, select: { id: true } })).map((p) => p.id);
}

async function avisar(tx: Tx, usuarios: string[], regla: string, casoId: string | null, mensaje: string, clave: string) {
  const para = usuarios.length ? usuarios : await directores(tx);
  await tx.alerta.createMany({ skipDuplicates: true, data: para.map((u) => ({
    regla, caso_id: casoId, severidad: "aviso" as const, asignado_a: u, fecha_disparo: dia(hoyCDMX()), mensaje, clave_dedup: `${clave}:${u}`,
  })) });
}

/** Adjunta la constancia al caso (documento «Por revisar»), cierra la solicitud y avisa. El archivo ya debe estar guardado. */
export async function adjuntarConstancia(tx: Tx, d: Destino, ruta: string, bytes: number, lectura: LecturaConstancia, correoId: string | null, usuarioId: string | null) {
  const tipo = await tx.tipoDocumento.findUnique({ where: { nombre: TIPO_CONSTANCIA }, select: { id: true } });
  if (!tipo) throw new Error("Falta el tipo de documento de la constancia");
  const doc = await tx.documento.create({ select: { id: true }, data: {
    caso_id: d.casoId, tipo_id: tipo.id, estado: "recibido", archivo_path: ruta, archivo_mime: "application/pdf", archivo_bytes: bytes,
    fecha_emision: lectura.fechaEmision ? dia(lectura.fechaEmision) : null, created_by: usuarioId,
  } });
  if (d.solicitudId) await tx.solicitudConstancia.update({ where: { id: d.solicitudId }, data: { estado: "recibida", documento_id: doc.id }, select: { id: true } });
  await tx.evento.create({ data: { caso_id: d.casoId, tipo: "documento", usuario_id: usuarioId, datos: { campo: "constancia_imss", correo_id: correoId, folio: lectura.folio },
    texto: `Llegó la constancia de semanas del IMSS${lectura.fechaEmision ? ` (emitida el ${lectura.fechaEmision.split("-").reverse().join("/")})` : ""} al buzón de constancias y se adjuntó a Documentos. Falta revisarla y «Leer constancia».` } });
  if (!usuarioId) await avisar(tx, d.avisar, "CONSTANCIA_RECIBIDA", d.casoId, `${d.nombre} (${d.folio}): llegó la constancia de semanas del IMSS; revísala en Documentos`, `CONSTANCIA_RECIBIDA:${doc.id}`);
  return doc.id;
}

export type ResultadoCorreo = { estado: "ligado" | "sin_caso" | "descartado" | "repetido"; tipo?: string; casoId?: string | null };

/** Procesa un correo recibido (idempotente por id de Resend). */
export async function procesarCorreoEntrante(emailId: string, buzon: string): Promise<ResultadoCorreo> {
  if (await prismaSistema.correoEntrante.findUnique({ where: { resend_id: emailId }, select: { id: true } })) return { estado: "repetido" };
  const correo = await obtenerCorreoRecibido(emailId);
  const remitente = correo.headers?.from ?? correo.from;
  const base = { resend_id: emailId, remitente: remitente.slice(0, 300), asunto: correo.subject?.slice(0, 300) ?? null };
  const paraBuzon = (correo.to ?? []).some((t) => t.toLowerCase().includes(buzon.toLowerCase()));

  if (!paraBuzon || !esRemitenteImss(remitente) || !autenticado(correo.authentication)) {
    const motivo = !paraBuzon ? "no es para el buzón de constancias" : !esRemitenteImss(remitente) ? "no viene del IMSS" : "el servidor no pudo comprobar que viene del IMSS (DKIM/SPF)";
    await prismaSistema.correoEntrante.create({ data: { ...base, tipo: "otro", estado: "descartado", detalle: `Descartado: ${motivo}.` } });
    return { estado: "descartado" };
  }

  // 1) ¿Trae la constancia en PDF?
  const pdf = await constanciaDelCorreo(emailId);
  if (pdf) {
    const destino = await prismaSistema.$transaction(async (tx) => destinoPorPersonas(tx,
      await personasPorIdentificadores(tx, pdf.lectura.curp ? [pdf.lectura.curp] : [], pdf.lectura.nss ? [pdf.lectura.nss] : [])));
    if (!destino) {
      await prismaSistema.$transaction(async (tx) => {
        await tx.correoEntrante.create({ data: { ...base, tipo: "constancia", estado: "sin_caso",
          detalle: `Constancia de ${pdf.lectura.nombre ?? "una persona"} (NSS ···${pdf.lectura.nss?.slice(-4) ?? "—"}) que no coincide con ningún cliente.` } });
        await avisar(tx, [], "CORREO_IMSS_SIN_CASO", null, "Llegó una constancia del IMSS que no coincide con ningún cliente; asígnala en Correos del IMSS", `CORREO_IMSS_SIN_CASO:${emailId}`);
      });
      return { estado: "sin_caso", tipo: "constancia" };
    }
    const ruta = rutaDocumento(destino.casoId, randomUUID(), "application/pdf");
    await guardarComoSistema(ruta, pdf.bytes, "application/pdf");
    await prismaSistema.$transaction(async (tx) => {
      const correoRow = await tx.correoEntrante.create({ select: { id: true }, data: { ...base, tipo: "constancia", estado: "ligado", caso_id: destino.casoId, solicitud_id: destino.solicitudId } });
      const docId = await adjuntarConstancia(tx, destino, ruta, pdf.bytes.length, pdf.lectura, correoRow.id, null);
      await tx.correoEntrante.update({ where: { id: correoRow.id }, data: { documento_id: docId }, select: { id: true } });
    });
    return { estado: "ligado", tipo: "constancia", casoId: destino.casoId };
  }

  // 2) ¿Trae la liga para confirmar la solicitud?
  const liga = ligaDeConfirmacion(ligasImss(correo.html, correo.text));
  return prismaSistema.$transaction(async (tx): Promise<ResultadoCorreo> => {
    const ids = identificadoresEnTexto(`${correo.text ?? ""} ${correo.html ?? ""}`);
    let destino = await destinoPorPersonas(tx, await personasPorIdentificadores(tx, ids.curps, ids.nsss));
    if (!destino) {
      const vivas = await tx.solicitudConstancia.findMany({ where: { estado: { in: VIVAS }, archivado_at: null }, select: { persona_id: true, created_at: true } });
      const unica = solicitudUnicaReciente(vivas.map((v) => ({ ...v, creada: v.created_at.toISOString() })), new Date().toISOString());
      if (unica) destino = await destinoPorPersonas(tx, [unica.persona_id]);
    }
    if (!liga || !destino) {
      await tx.correoEntrante.create({ data: { ...base, tipo: liga ? "confirmacion" : "otro", estado: "sin_caso", liga,
        detalle: liga ? "Liga de confirmación del IMSS que no se pudo ligar a una solicitud." : "Correo del IMSS sin constancia ni liga de confirmación." } });
      await avisar(tx, [], "CORREO_IMSS_SIN_CASO", null, "Llegó un correo del IMSS que no se pudo ligar a un cliente; revísalo en Correos del IMSS", `CORREO_IMSS_SIN_CASO:${emailId}`);
      return { estado: "sin_caso", tipo: liga ? "confirmacion" : "otro" };
    }
    const solicitudId = destino.solicitudId ?? (await tx.solicitudConstancia.create({ select: { id: true },
      data: { caso_id: destino.casoId, persona_id: destino.personaId, estado: "confirmar" } })).id;
    await tx.solicitudConstancia.update({ where: { id: solicitudId }, data: { estado: "confirmar", liga_confirmacion: liga }, select: { id: true } });
    await tx.correoEntrante.create({ data: { ...base, tipo: "confirmacion", estado: "ligado", liga, caso_id: destino.casoId, solicitud_id: solicitudId } });
    await tx.evento.create({ data: { caso_id: destino.casoId, tipo: "sistema", datos: { campo: "constancia_imss", correo: emailId },
      texto: "El IMSS mandó la liga para confirmar la solicitud de la constancia. Dale «Confirmar en el IMSS» en Documentos." } });
    await avisar(tx, destino.avisar, "CONFIRMAR_CONSTANCIA", destino.casoId, `${destino.nombre} (${destino.folio}): confirma en el IMSS la solicitud de la constancia (Documentos)`, `CONFIRMAR_CONSTANCIA:${emailId}`);
    return { estado: "ligado", tipo: "confirmacion", casoId: destino.casoId };
  });
}
