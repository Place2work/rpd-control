"use server";

import { revalidatePath } from "next/cache";
import { obtenerSesion } from "@/lib/auth/sesion";
import { entradaDesdeCaso, faltantesParaCalcular, VERSION_REGLAS } from "@/lib/calculo/entrada";
import { conUsuario, prismaSistema } from "@/lib/db/prisma";
import { parametrosRetiro } from "@/lib/parametros";
import { precalificar, type Resultado } from "@/lib/reglas/retiro";
import { hoyCDMX } from "@/lib/tiempo";

const ETIQUETA: Record<Resultado, string> = {
  APTO: "Apto", APTO_BLOQUEADO: "Apto con pendientes", NO_TODAVIA: "Todavía no", CALIFICA_NO_CONVIENE: "Califica pero no conviene",
  NO_ELEGIBLE_DESVIO: "Otro servicio le conviene", NO_ELEGIBLE_DEFINITIVO: "No elegible",
};

export async function calcularPrecalificacion(casoId: string, modalidad: "A" | "B" | null): Promise<{ ok?: boolean; error?: string; faltantes?: string[] }> {
  const { claims, ip, usuario } = await obtenerSesion();
  const hoy = hoyCDMX();
  const p = await parametrosRetiro(hoy);

  const r = await conUsuario(claims, async (tx) => {
    const caso = await tx.caso.findUnique({
      where: { id: casoId },
      select: {
        folio: true, tipo_servicio: true, dictamen_manual: true, asignado_a: true,
        persona: { select: { fecha_nacimiento: true, nombre: true, apellido_paterno: true } },
        datos_imss: true, datos_afore: true,
      },
    });
    if (!caso) return { error: "No encontramos el caso." };
    if (caso.tipo_servicio !== "RETIRO_DESEMPLEO") return { error: "La calculadora es para el retiro por desempleo." };
    const faltantes = faltantesParaCalcular(caso);
    if (faltantes.length) return { faltantes };

    const entrada = entradaDesdeCaso(caso, hoy, modalidad);
    const s = precalificar(entrada, p);
    // El dictamen manual prevalece sobre el resultado automático (decisión 27-oct).
    const final: Resultado = caso.dictamen_manual === "APTO" ? "APTO" : caso.dictamen_manual === "NO_APTO" ? "NO_ELEGIBLE_DEFINITIVO" : s.resultado;
    const a = s.modalidades.opciones.find((o) => o.modalidad === "A");
    const b = s.modalidades.opciones.find((o) => o.modalidad === "B");
    const o = s.elegida;

    await tx.calculo.create({
      data: {
        caso_id: casoId, version_reglas: VERSION_REGLAS, fecha_calculo: new Date(`${hoy}T00:00:00Z`),
        entradas: { ...entrada, parametros: p },
        uma_diaria: p.UMA_DIARIA, uma_mensual: p.UMA_MENSUAL,
        modalidad_a_monto: a?.monto ?? null, modalidad_a_semanas: a?.semanasPerdidas ?? null,
        modalidad_b_90dias: b?.detalle.dias_sbc ?? null, modalidad_b_115pct: b?.detalle.pct_saldo ?? null,
        modalidad_b_monto: b?.monto ?? null, modalidad_b_semanas: b?.semanasPerdidas ?? null,
        modalidad_elegible: s.modalidades.elegible, modalidad_elegida: o?.modalidad ?? null,
        monto_estimado: o?.monto ?? null, semanas_perdidas: o?.semanasPerdidas ?? null, pct_saldo_retirado: o ? o.pctSaldo / 100 : null,
        semanas_despues: o?.semanasDespues ?? null, honorario_estimado: o?.honorario ?? null, neto_cliente_estimado: o?.netoCliente ?? null,
        impacto_pension: { impacto: s.impacto, motivos: s.motivos, tareas: s.tareas, opciones: s.modalidades.opciones,
          porDefecto: s.modalidades.porDefecto, cuestaMenos: s.modalidades.cuestaMenos },
        severidad_impacto: s.impacto && s.impacto.severidad !== "ok" ? s.impacto.severidad : null,
        resultado_automatico: s.resultado, resultado: final, dictamen_manual: caso.dictamen_manual,
        fecha_elegibilidad: s.fechaElegibilidad ? new Date(`${s.fechaElegibilidad}T00:00:00Z`) : null,
        servicio_sugerido: s.servicioSugerido, explicacion: s.explicacion, created_by: usuario.id,
      },
      select: { id: true },
    });
    await tx.caso.update({
      where: { id: casoId },
      data: { resultado_precalificacion: final, fecha_elegibilidad: s.fechaElegibilidad ? new Date(`${s.fechaElegibilidad}T00:00:00Z`) : null },
      select: { id: true },
    });
    await tx.evento.create({
      data: { caso_id: casoId, tipo: "sistema", usuario_id: usuario.id,
        texto: `Precalificación: ${ETIQUETA[final]}${o ? ` · modalidad ${o.modalidad} ${o.monto.toLocaleString("es-MX", { style: "currency", currency: "MXN" })} estimado, pierde ${o.semanasPerdidas} semanas` : ""}` },
    });
    return { ok: true, critica: s.impacto?.severidad === "critica", caso };
  }, ip);

  // Alerta RIESGO_SEMANAS (8.1): la crea el sistema porque los usuarios no insertan alertas.
  if ("critica" in r && r.critica && r.caso) {
    const directores = await prismaSistema.usuario.findMany({ where: { rol: "director", activo: true }, select: { id: true } });
    const para = new Set([...(r.caso.asignado_a ? [r.caso.asignado_a] : []), ...directores.map((d) => d.id)]);
    const nombre = [r.caso.persona.nombre, r.caso.persona.apellido_paterno].filter(Boolean).join(" ");
    await prismaSistema.alerta.createMany({
      data: [...para].map((u) => ({ regla: "RIESGO_SEMANAS", caso_id: casoId, severidad: "critica" as const, asignado_a: u,
        mensaje: `${nombre} (${r.caso.folio}): el retiro pone en riesgo la pensión`, fecha_disparo: new Date(`${hoy}T00:00:00Z`),
        clave_dedup: `RIESGO_SEMANAS:${casoId}:${hoy}` })),
      skipDuplicates: true,
    });
  }
  if ("ok" in r && r.ok) revalidatePath(`/casos/${casoId}`);
  return "faltantes" in r ? { faltantes: r.faltantes } : "error" in r ? { error: r.error } : { ok: true };
}
