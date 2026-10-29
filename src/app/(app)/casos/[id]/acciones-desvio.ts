"use server";

// Desvío (6.1 y 6.3, resultado 2): cuando el retiro no procede pero otro servicio sí, se abre un
// caso nuevo del servicio sugerido para la misma persona, ligado al original, con los datos del
// IMSS ya capturados. El original pasa a «Perdido o desvío» con las mismas reglas del expediente.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { hoyCDMX } from "@/lib/tiempo";
import { cambiarEtapa } from "./acciones";

export type ResultadoDesvio = { ok?: boolean; error?: string; nuevoId?: string; folio?: string; aviso?: string };

const fecha = (iso: string) => new Date(`${iso}T00:00:00Z`);

export async function crearDesvio(casoId: string, _p: ResultadoDesvio, form: FormData): Promise<ResultadoDesvio> {
  const { claims, ip, usuario } = await obtenerSesion();
  if (usuario.rol === "vendedor") return { error: "El desvío lo decide el asesor o el Director." };
  const servicio = String(form.get("servicio") ?? "");

  const r = await conUsuario(claims, async (tx): Promise<ResultadoDesvio & { nombreServicio?: string }> => {
    const origen = await tx.caso.findUnique({
      where: { id: casoId },
      select: { id: true, folio: true, persona_id: true, tipo_servicio: true, vendedor_id: true, socio_id: true, asignado_a: true, referidor_id: true, archivado_at: true, datos_imss: true },
    });
    if (!origen || origen.archivado_at) return { error: "No encontramos el caso." };
    const destino = await tx.tipoServicio.findFirst({ where: { clave: servicio, activo: true }, select: { clave: true, nombre: true } });
    if (!destino || destino.clave === origen.tipo_servicio) return { error: "Elige otro servicio." };

    // Un solo desvío por servicio: si ya existe, se abre ese.
    const previo = await tx.caso.findFirst({ where: { caso_origen_id: origen.id, tipo_servicio: destino.clave, archivado_at: null }, select: { id: true, folio: true } });
    if (previo) return { ok: true, nuevoId: previo.id, folio: previo.folio, aviso: `Ya existía el caso ${previo.folio} de ${destino.nombre}.` };

    const nuevo = await tx.caso.create({
      select: { id: true, folio: true },
      data: {
        persona_id: origen.persona_id, tipo_servicio: destino.clave, caso_origen_id: origen.id, owner_id: usuario.id,
        vendedor_id: origen.vendedor_id, socio_id: origen.socio_id, asignado_a: origen.asignado_a ?? (usuario.rol === "asesor" ? usuario.id : null),
        referidor_id: origen.referidor_id, fecha_primer_contacto: fecha(hoyCDMX()),
      },
    });
    const i = origen.datos_imss;
    if (i) {
      await tx.datosImss.create({
        data: {
          caso_id: nuevo.id, regimen: i.regimen, regimen_justificacion: i.regimen_justificacion, fecha_primera_alta: i.fecha_primera_alta,
          fecha_constancia: i.fecha_constancia, semanas_cotizadas: i.semanas_cotizadas, semanas_descontadas: i.semanas_descontadas,
          semanas_reintegradas: i.semanas_reintegradas, semanas_totales: i.semanas_totales, bimestres_cotizados: i.bimestres_cotizados,
          semanas_ultimos_5_anios: i.semanas_ultimos_5_anios, fecha_baja: i.fecha_baja, sbc_ultimo: i.sbc_ultimo, sbc_promedio_250: i.sbc_promedio_250,
          ultimo_patron: i.ultimo_patron, cotiza_actualmente: i.cotiza_actualmente, created_by: usuario.id,
        },
      });
    }
    await tx.historialEtapa.create({ data: { caso_id: nuevo.id, etapa_nueva: "PROSPECTO", usuario_id: usuario.id } });
    await tx.evento.create({ data: { caso_id: nuevo.id, tipo: "sistema", texto: `Desvío desde el caso ${origen.folio}`, usuario_id: usuario.id, datos: { caso_origen: origen.folio } } });
    await tx.evento.create({ data: { caso_id: origen.id, tipo: "sistema", texto: `Se abrió el caso ${nuevo.folio} de ${destino.nombre}`, usuario_id: usuario.id, datos: { desvio: nuevo.folio } } });
    return { ok: true, nuevoId: nuevo.id, folio: nuevo.folio, nombreServicio: destino.nombre };
  }, ip);
  if (!r.ok || !r.nombreServicio) return r;

  // El original se cierra como desvío; si su etapa no lo permite, se avisa y queda abierto.
  const f = new FormData();
  f.set("destino", "PERDIDO");
  f.set("motivo_perdida", "no_elegible");
  f.set("motivo", `Desvío a ${r.nombreServicio} (caso ${r.folio})`);
  const movido = await cambiarEtapa(casoId, {}, f);
  revalidatePath("/casos");
  revalidatePath(`/casos/${casoId}`);
  if (movido.ok) redirect(`/casos/${r.nuevoId}`);
  return {
    ok: true, nuevoId: r.nuevoId, folio: r.folio,
    aviso: `El caso original no pasó a «Perdido o desvío»: ${(movido.faltantes ?? [movido.error]).join("; ")}. Muévelo desde el Resumen.`,
  };
}
