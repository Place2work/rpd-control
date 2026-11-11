"use server";

// Referencias personales del cliente (dos por persona). Con RLS (persona visible); cada cambio queda en Seguimiento.
import { revalidatePath } from "next/cache";
import { obtenerSesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { esquemaReferencia, NOMBRE_PARENTESCO, telefonoDelCliente } from "@/lib/prospectos/referencias";
import type { Resultado } from "./acciones";

const valor = (form: FormData, k: string) => String(form.get(k) ?? "");

export async function guardarReferencia(casoId: string, personaId: string, orden: 1 | 2, _p: Resultado, form: FormData): Promise<Resultado> {
  if (orden !== 1 && orden !== 2) return { error: "Referencia no válida." };
  const { claims, ip, usuario } = await obtenerSesion();
  const r = esquemaReferencia.safeParse({
    nombre: valor(form, "nombre"), telefono: valor(form, "telefono"), parentesco: valor(form, "parentesco"),
    domicilio: valor(form, "domicilio"), anios_conocerlo: valor(form, "anios_conocerlo"), notas: valor(form, "notas"),
  });
  if (!r.success) return { errores: Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const d = r.data;
  const confirmar = form.get("confirmada") === "si";

  const res = await conUsuario(claims, async (tx): Promise<Resultado> => {
    const persona = await tx.persona.findUnique({ where: { id: personaId }, select: { whatsapp: true } });
    if (!persona) return { error: "No encontramos al cliente." };
    if (telefonoDelCliente(d.telefono, persona.whatsapp)) return { errores: { telefono: "Es el teléfono del cliente; pon el de la referencia" } };
    const previa = await tx.referenciaPersonal.findFirst({ where: { persona_id: personaId, orden, archivado_at: null }, select: { id: true, confirmada_at: true } });
    const confirmacion = confirmar
      ? (previa?.confirmada_at ? {} : { confirmada_at: new Date(), confirmada_por: usuario.id })
      : { confirmada_at: null, confirmada_por: null };
    const data = { ...d, ...confirmacion };
    if (previa) await tx.referenciaPersonal.update({ where: { id: previa.id }, data, select: { id: true } });
    else await tx.referenciaPersonal.create({ data: { persona_id: personaId, orden, created_by: usuario.id, ...data }, select: { id: true } });
    await tx.evento.create({ data: { caso_id: casoId, tipo: "sistema", usuario_id: usuario.id, datos: { campo: "referencia", orden },
      texto: `Referencia ${orden} ${previa ? "actualizada" : "agregada"}: ${d.nombre} (${NOMBRE_PARENTESCO[d.parentesco] ?? d.parentesco})${confirmar && !previa?.confirmada_at ? ", confirmada por llamada" : ""}.` } });
    return { ok: true };
  }, ip);
  if (res.ok) { revalidatePath(`/casos/${casoId}`); revalidatePath("/asesores"); }
  return res;
}

/** Nadie borra: la referencia se archiva (queda en la bitácora) y el lugar queda libre para otra. */
export async function quitarReferencia(casoId: string, personaId: string, orden: 1 | 2, ...[]: [Resultado?, FormData?]): Promise<Resultado> {
  const { claims, ip, usuario } = await obtenerSesion();
  const res = await conUsuario(claims, async (tx): Promise<Resultado> => {
    const previa = await tx.referenciaPersonal.findFirst({ where: { persona_id: personaId, orden, archivado_at: null }, select: { id: true, nombre: true } });
    if (!previa) return { ok: true };
    await tx.referenciaPersonal.update({ where: { id: previa.id }, data: { archivado_at: new Date() }, select: { id: true } });
    await tx.evento.create({ data: { caso_id: casoId, tipo: "sistema", usuario_id: usuario.id, datos: { campo: "referencia", orden },
      texto: `Se quitó la referencia ${orden}: ${previa.nombre}.` } });
    return { ok: true };
  }, ip);
  if (res.ok) { revalidatePath(`/casos/${casoId}`); revalidatePath("/asesores"); }
  return res;
}
