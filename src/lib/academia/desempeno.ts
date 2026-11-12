// Lectura de los hechos del CRM para el tablero de desempeño (CAPACITACION.md 10). Con RLS: el asesor de pensiones
// solo ve sus casos y alertas; el Director, los de todos.
import "server-only";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { parametrosVigentes } from "@/lib/parametros";
import { hoyCDMX } from "@/lib/tiempo";
import { calcularDesempeno, sugerirRepaso, type AlertaDesempeno, type CasoDesempeno, type ClaveMetrica, type Metrica, type ParametrosDesempeno } from "@/lib/reglas/desempeno";

const CONTACTO = ["llamada", "whatsapp", "correo", "nota"] as const;
export const DIAS_TABLERO = 90;

export type Persona = { usuarioId: string; socioId: string | null; nombre: string };
export type FilaDesempeno = Persona & { metricas: Metrica[]; repaso: { metricas: ClaveMetrica[]; modulos: string[] } };

export async function metasVigentes(sesion: Sesion, hoy = hoyCDMX()): Promise<Partial<Record<ClaveMetrica, number>>> {
  const filas = await conUsuario(sesion.claims, (tx) => tx.capMeta.findMany({ where: { vigente_desde: { lte: new Date(`${hoy}T00:00:00Z`) } }, orderBy: { vigente_desde: "desc" }, select: { metrica: true, valor: true } }), sesion.ip);
  const r: Partial<Record<ClaveMetrica, number>> = {};
  for (const f of filas) r[f.metrica as ClaveMetrica] ??= Number(f.valor);
  return r;
}

export async function parametrosDesempeno(): Promise<ParametrosDesempeno> {
  const p = await parametrosVigentes(["CAP_CONTACTO_HORAS", "CAP_ALERTA_DIAS"]);
  const n = (k: string) => { const v = Number(p[k]); if (!Number.isFinite(v)) throw new Error(`Falta el parámetro ${k}`); return v; };
  return { horasContacto: n("CAP_CONTACTO_HORAS"), diasAlerta: n("CAP_ALERTA_DIAS") };
}

/** Métricas de cada persona: últimos 90 días y, para el coaching, la semana pasada contra la anterior. */
export async function desempenoDe(sesion: Sesion, personas: Persona[], ahora: Date): Promise<FilaDesempeno[]> {
  const desde = new Date(ahora.getTime() - DIAS_TABLERO * 864e5);
  const socios = personas.map((p) => p.socioId).filter((x): x is string => Boolean(x));
  const usuarios = personas.map((p) => p.usuarioId);
  const [d, metas, params] = await Promise.all([
    conUsuario(sesion.claims, async (tx) => ({
      casos: await tx.caso.findMany({
        where: { archivado_at: null, socio_id: { in: socios }, created_at: { gte: desde } },
        select: {
          socio_id: true, created_at: true, etapa: true, analisis_impacto_ok: true, contrato_generado_at: true,
          persona: { select: { origen: true } }, datos_imss: { select: { regimen: true } },
          eventos: { where: { archivado_at: null, tipo: { in: [...CONTACTO] }, usuario_id: { not: null } }, orderBy: { fecha: "asc" }, take: 1, select: { fecha: true } },
          calculos: { orderBy: { created_at: "desc" }, take: 1, select: { resultado: true } },
          documentos: { where: { estado: { in: ["recibido", "validado", "rechazado", "vencido"] } }, select: { estado: true } },
          desvios: { take: 1, select: { id: true } },
        },
      }),
      alertas: await tx.alerta.findMany({ where: { asignado_a: { in: usuarios }, fecha_disparo: { gte: desde }, estado: { not: "descartada" } }, select: { asignado_a: true, fecha_disparo: true, atendida_at: true } }),
      lineaRoja: await tx.capIncidencia.findMany({ where: { usuario_id: { in: usuarios }, severidad: "linea_roja", archivado_at: null, created_at: { gte: desde } }, select: { usuario_id: true, created_at: true } }),
    }), sesion.ip),
    metasVigentes(sesion, hoyCDMX(ahora)),
    parametrosDesempeno(),
  ]);
  const iso = ahora.toISOString();
  return personas.map((p) => {
    const casos = d.casos.filter((c) => p.socioId && c.socio_id === p.socioId).map((c) => ({
      creado: c.created_at.toISOString(),
      primerContacto: c.eventos[0]?.fecha.toISOString() ?? null,
      precalificado: c.calculos.length > 0,
      resultado: c.calculos[0]?.resultado ?? null,
      contrato: Boolean(c.contrato_generado_at),
      docsRecibidos: c.documentos.length,
      docsRechazados: c.documentos.filter((x) => x.estado === "rechazado").length,
      bloqueado: c.etapa === "BLOQUEADO",
      ley73: c.datos_imss?.regimen === "L73",
      analisisImpacto: c.analisis_impacto_ok,
      desviado: c.desvios.length > 0,
      referido: c.persona.origen === "referido",
    } satisfies CasoDesempeno));
    const alertas: (AlertaDesempeno & { t: number })[] = d.alertas.filter((a) => a.asignado_a === p.usuarioId)
      .map((a) => ({ disparo: a.fecha_disparo.toISOString().slice(0, 10), atendida: a.atendida_at?.toISOString() ?? null, t: a.fecha_disparo.getTime() }));
    const rojas = d.lineaRoja.filter((x) => x.usuario_id === p.usuarioId);
    const ventana = (dias0: number, dias1: number) => {
      const a = ahora.getTime() - dias1 * 864e5, b = ahora.getTime() - dias0 * 864e5;
      const en = (t: number) => t >= a && t < b;
      return calcularDesempeno(casos.filter((c) => en(Date.parse(c.creado))), alertas.filter((x) => en(x.t)), rojas.filter((x) => en(x.created_at.getTime())).length, metas, params, iso);
    };
    return { ...p, metricas: calcularDesempeno(casos, alertas, rojas.length, metas, params, iso), repaso: sugerirRepaso(ventana(0, 7), ventana(7, 14)) };
  });
}
