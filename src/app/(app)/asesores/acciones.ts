"use server";

// Edición rápida desde el panel de asesores y referidores: nombre y WhatsApp del cliente, y a quién
// pertenece el caso (asesor de pensiones o referidor). Con RLS; cada cambio queda en Seguimiento.
import { revalidatePath } from "next/cache";
import { obtenerSesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { recalcularComisiones } from "@/lib/dinero/motor";
import { normalizarWhatsapp } from "@/lib/prospectos/validacion";
import { limpiarNombre } from "@/lib/reglas/nombres";
import type { Resultado } from "../casos/[id]/acciones";

const txt = (form: FormData, k: string) => {
  const v = String(form.get(k) ?? "").trim();
  return v.length ? v : null;
};
const uuid = (form: FormData, k: string) => {
  const v = String(form.get(k) ?? "");
  return /^[0-9a-f-]{36}$/i.test(v) ? v : null;
};
const nombreCompleto = (p: { nombre: string; apellido_paterno: string | null; apellido_materno: string | null }) =>
  [p.nombre, p.apellido_paterno, p.apellido_materno].filter(Boolean).join(" ");

export async function editarProspecto(casoId: string, _p: Resultado, form: FormData): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol !== "director" && usuario.rol !== "asesor") return { error: "Solo el Director o el analista editan desde este panel." };

  const nombre = txt(form, "nombre");
  if (!nombre || nombre.length < 2) return { errores: { nombre: "Escribe el nombre" } };
  const waTexto = txt(form, "whatsapp");
  const whatsapp = waTexto ? normalizarWhatsapp(waTexto) : null;
  if (waTexto && !whatsapp) return { errores: { whatsapp: "Escribe 10 dígitos" } };
  const nom = limpiarNombre({ nombre, apellido_paterno: txt(form, "apellido_paterno"), apellido_materno: txt(form, "apellido_materno") });
  const socio_id = uuid(form, "socio_id");
  const referidor_id = uuid(form, "referidor_id");

  let res: Resultado & { canal?: boolean };
  try { res = await conUsuario(claims, async (tx): Promise<Resultado & { canal?: boolean }> => {
    const caso = await tx.caso.findUnique({ where: { id: casoId }, select: {
      persona_id: true, socio_id: true, referidor_id: true,
      socio: { select: { nombre: true } }, referidor: { select: { nombre: true } },
      persona: { select: { nombre: true, apellido_paterno: true, apellido_materno: true, whatsapp: true } },
    } });
    if (!caso) return { error: "No encontramos el caso." };
    const [socio, referidor] = await Promise.all([
      socio_id ? tx.socio.findFirst({ where: { id: socio_id, archivado_at: null }, select: { nombre: true } }) : null,
      referidor_id ? tx.referidor.findFirst({ where: { id: referidor_id, archivado_at: null }, select: { nombre: true } }) : null,
    ]);
    if (socio_id && !socio) return { errores: { socio_id: "Ese asesor ya no está activo" } };
    if (referidor_id && !referidor) return { errores: { referidor_id: "Ese referidor ya no está activo" } };

    const cambios: string[] = [];
    const antes = nombreCompleto(caso.persona);
    const despues = nombreCompleto(nom);
    if (antes !== despues) cambios.push(`nombre «${antes}» → «${despues}»`);
    if ((caso.persona.whatsapp ?? null) !== whatsapp) cambios.push(`WhatsApp ${caso.persona.whatsapp ?? "sin capturar"} → ${whatsapp ?? "sin capturar"}`);
    if (caso.socio_id !== socio_id) cambios.push(`asesor de pensiones ${caso.socio?.nombre ?? "ninguno"} → ${socio?.nombre ?? "ninguno"}`);
    if (caso.referidor_id !== referidor_id) cambios.push(`referidor ${caso.referidor?.nombre ?? "ninguno"} → ${referidor?.nombre ?? "ninguno"}`);
    if (!cambios.length) return { ok: true };

    await tx.persona.update({ where: { id: caso.persona_id }, data: { ...nom, whatsapp, telefono: whatsapp }, select: { id: true } });
    const canal = caso.socio_id !== socio_id || caso.referidor_id !== referidor_id;
    if (canal) await tx.caso.update({ where: { id: casoId }, data: { socio_id, referidor_id }, select: { id: true } });
    await tx.evento.create({ data: { caso_id: casoId, tipo: "sistema", usuario_id: usuario.id,
      datos: { campo: "panel_asesores", cambios }, texto: `Editado desde el panel de asesores: ${cambios.join("; ")}.` } });
    return { ok: true, canal };
  }, ip); } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { errores: { whatsapp: "Ese WhatsApp ya pertenece a otra persona" } };
    return { error: "No se pudo guardar." };
  }

  if (res.canal) {
    try { await recalcularComisiones([casoId]); } catch (e) { console.error("[comisiones]", casoId, e); }
  }
  if (res.ok) { revalidatePath("/asesores"); revalidatePath(`/casos/${casoId}`); }
  return { ok: res.ok, error: res.error, errores: res.errores };
}
