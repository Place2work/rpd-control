// Formulario de precalificación del sitio (sección 6, integración con el sitio). Crea el
// prospecto con origen `web` en la bandeja general y avisa a los directores. Corre como
// proceso del sistema: no hay usuario, la autorización es la firma HMAC.
import { NextResponse, type NextRequest } from "next/server";
import type { Etapa } from "@/generated/prisma/client";
import { prismaSistema } from "@/lib/db/prisma";
import { esquemaLead } from "@/lib/leads/esquema";
import { verificarFirma } from "@/lib/leads/firma";
import { parametrosVigentes } from "@/lib/parametros";
import { hoyCDMX } from "@/lib/tiempo";

const MAX_BYTES = 16_384;
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const TERMINADAS: Etapa[] = ["PERDIDO", "CERRADO", "PAGADO", "PENSION_OTORGADA", "SEGUIMIENTO"];

export async function POST(req: NextRequest) {
  const cuerpo = await req.text();
  if (cuerpo.length > MAX_BYTES) return NextResponse.json({ error: "Demasiado grande" }, { status: 413 });

  const firma = verificarFirma(process.env.LEADS_HMAC_SECRETO, req.headers.get("x-rpd-timestamp"), req.headers.get("x-rpd-firma"), cuerpo, Math.floor(Date.now() / 1000));
  if (!firma.ok) {
    if (firma.motivo === "sin_secreto") console.error("[leads] falta LEADS_HMAC_SECRETO");
    return NextResponse.json({ error: "Firma no válida" }, { status: 401 });
  }

  let json: unknown;
  try { json = JSON.parse(cuerpo); } catch { return NextResponse.json({ error: "JSON no válido" }, { status: 400 }); }
  const r = esquemaLead.safeParse(json);
  if (!r.success) {
    return NextResponse.json({ error: "Datos no válidos", campos: r.error.issues.map((i) => ({ campo: i.path.join("."), mensaje: i.message })) }, { status: 422 });
  }
  const d = r.data;
  const hoy = hoyCDMX();
  const nombre = [d.nombre, d.apellido_paterno].filter(Boolean).join(" ");

  const directores = await prismaSistema.usuario.findMany({
    where: { rol: "director", activo: true, archivado_at: null }, select: { id: true }, orderBy: { created_at: "asc" },
  });
  if (directores.length === 0) return NextResponse.json({ error: "Sin director activo" }, { status: 503 });
  const { PRIVACIDAD_VERSION } = await parametrosVigentes(["PRIVACIDAD_VERSION"]);
  const datosEvento = { origen: "web", mensaje: d.mensaje, utm: d.utm, email: d.email };

  const resultado = await prismaSistema.$transaction(async (tx) => {
    // Si ya existe con el mismo WhatsApp y tiene un caso abierto del mismo servicio, no se
    // duplica: se anota en su caso y se avisa a quien lo lleva.
    const previa = await tx.persona.findFirst({
      where: { whatsapp: d.whatsapp, archivado_at: null },
      select: { id: true, casos: { where: { tipo_servicio: d.tipo_servicio, archivado_at: null, etapa: { notIn: TERMINADAS } }, select: { id: true, folio: true, asignado_a: true }, take: 1 } },
      orderBy: { created_at: "desc" },
    });
    const abierto = previa?.casos[0];
    if (abierto) {
      await tx.evento.create({ data: { caso_id: abierto.id, tipo: "sistema", texto: "Volvió a llenar el formulario del sitio", datos: datosEvento } });
      const para = abierto.asignado_a ? [abierto.asignado_a] : directores.map((u) => u.id);
      await tx.alerta.createMany({
        skipDuplicates: true,
        data: para.map((u) => ({ regla: "PROSPECTO_NUEVO", caso_id: abierto.id, severidad: "aviso" as const, asignado_a: u, fecha_disparo: dia(hoy),
          mensaje: `${nombre} (${abierto.folio}): volvió a llenar el formulario del sitio`, clave_dedup: `PROSPECTO_NUEVO:${abierto.id}:${hoy}` })),
      });
      return { folio: abierto.folio, repetido: true };
    }

    const owner = directores[0].id;
    const persona = previa ?? await tx.persona.create({
      select: { id: true },
      data: {
        nombre: d.nombre, apellido_paterno: d.apellido_paterno, apellido_materno: d.apellido_materno,
        telefono: d.whatsapp, whatsapp: d.whatsapp, email: d.email, origen: "web", owner_id: owner,
        privacidad_aceptada_at: new Date(), privacidad_version: PRIVACIDAD_VERSION, privacidad_ip: d.ip_cliente,
      },
    });
    const caso = await tx.caso.create({
      select: { id: true, folio: true },
      data: { persona_id: persona.id, tipo_servicio: d.tipo_servicio, owner_id: owner, fecha_primer_contacto: dia(hoy) },
    });
    if (d.fecha_baja && d.tipo_servicio === "RETIRO_DESEMPLEO") {
      await tx.datosImss.create({ data: { caso_id: caso.id, fecha_baja: dia(d.fecha_baja) } });
    }
    await tx.historialEtapa.create({ data: { caso_id: caso.id, etapa_nueva: "PROSPECTO" } });
    await tx.evento.create({ data: { caso_id: caso.id, tipo: "sistema", texto: "Alta desde el formulario del sitio", datos: datosEvento } });
    await tx.alerta.createMany({
      skipDuplicates: true,
      data: directores.map((u) => ({ regla: "PROSPECTO_NUEVO", caso_id: caso.id, severidad: "aviso" as const, asignado_a: u.id, fecha_disparo: dia(hoy),
        mensaje: `${nombre} (${caso.folio}): prospecto nuevo del sitio, sin asignar`, clave_dedup: `PROSPECTO_NUEVO:${caso.id}` })),
    });
    return { folio: caso.folio, repetido: false };
  });

  return NextResponse.json({ ok: true, ...resultado }, { status: resultado.repetido ? 200 : 201 });
}
