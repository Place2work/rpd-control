// Comisiones proyectadas por pagar (asesores de pensiones y referidores) de los retiros vivos. Con RLS:
// el Director y el analista ven todo; el asesor de pensiones solo sus casos y solo lo suyo.
import "server-only";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { parametrosDinero } from "@/lib/parametros";
import { comisionesProyectadasPorPagar, honorarioParaProyectar, pctHonorarioRetiro, type CasoComisionProyectable, type Escalon } from "@/lib/reglas/comisiones";
import { costoDeAlta, type VigenciaCosto } from "@/lib/reglas/costo-alta";
import { hoyCDMX } from "@/lib/tiempo";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function comisionesProyectadas(s: Sesion) {
  const hoy = hoyCDMX();
  const p = await parametrosDinero(hoy);
  const esAsesor = s.usuario.rol === "socio";
  const d = await conUsuario(s.claims, async (tx) => {
    const casos = await tx.caso.findMany({
      where: { archivado_at: null, tipo_servicio: "RETIRO_DESEMPLEO", etapa: { not: "PERDIDO" },
        OR: esAsesor ? [{ socio_id: s.usuario.socio_id ?? "00000000-0000-0000-0000-000000000000" }] : [{ socio_id: { not: null } }, { referidor_id: { not: null } }] },
      select: {
        id: true, folio: true, persona_id: true, monto_afore_esperado: true, contrato_pct: true,
        persona: { select: { nombre: true, apellido_paterno: true } },
        socio: { select: { id: true, nombre: true, porcentaje_socio: true } },
        referidor: { select: { id: true, nombre: true } },
        cobros: { where: { archivado_at: null, estado: { not: "cancelado" } }, select: { honorario_total: true, subtotal: true } },
        pagos_afore: { where: { archivado_at: null }, select: { monto_neto: true } },
        calculos: { orderBy: { created_at: "desc" }, take: 1, select: { monto_estimado: true } },
        comisiones: { where: { archivado_at: null, estado: { not: "cancelada" } }, select: { tipo: true, estado: true, monto: true } },
      },
      orderBy: { folio: "asc" },
    });
    const personas = [...new Set(casos.map((c) => c.persona_id))];
    const [primeros, vigencias, refMes, esquema] = await Promise.all([
      tx.caso.findMany({ where: { persona_id: { in: personas }, archivado_at: null }, orderBy: { created_at: "asc" }, select: { persona_id: true, created_at: true, costo_admin_alta: true } }),
      tx.parametro.findMany({ where: { clave: "COSTO_ADMIN_ALTA" }, select: { valor: true, vigente_desde: true, vigente_hasta: true } }),
      esAsesor ? Promise.resolve([] as { referidor_id: string; n: number }[]) : tx.$queryRaw<{ referidor_id: string; n: number }[]>`
        SELECT referidor_id::text, count(*)::int AS n FROM (
          SELECT c.referidor_id, min(k.fecha_cobro) AS primero FROM casos c
          JOIN cobros k ON k.caso_id = c.id AND k.estado = 'cobrado' AND k.archivado_at IS NULL
          WHERE c.referidor_id IS NOT NULL AND c.archivado_at IS NULL GROUP BY c.id, c.referidor_id
        ) x WHERE to_char(primero, 'YYYY-MM') = ${hoy.slice(0, 7)} GROUP BY 1`,
      tx.esquemaComision.findFirst({ where: { tipo: "referido", vigente_desde: { lte: new Date(`${hoy}T00:00:00Z`) },
        OR: [{ vigente_hasta: null }, { vigente_hasta: { gte: new Date(`${hoy}T00:00:00Z`) } }] }, orderBy: { version: "desc" }, select: { reglas: true } }),
    ]);
    return { casos, primeros, vigencias, refMes, esquema };
  }, s.ip);

  const vig: VigenciaCosto[] = d.vigencias.map((v) => ({ desde: iso(v.vigente_desde)!, hasta: iso(v.vigente_hasta), monto: Number(v.valor) }));
  const costo = new Map<string, number>();
  for (const c of d.primeros) if (!costo.has(c.persona_id)) costo.set(c.persona_id, costoDeAlta(c.costo_admin_alta === null ? null : Number(c.costo_admin_alta), hoyCDMX(c.created_at), vig));
  const refMes = new Map(d.refMes.map((r) => [r.referidor_id, r.n]));

  const entrada: CasoComisionProyectable[] = d.casos.map((c) => {
    const pct = pctHonorarioRetiro(c.contrato_pct === null ? null : Number(c.contrato_pct), p);
    const h = honorarioParaProyectar({ cobros: c.cobros.map((k) => ({ honorario: Number(k.honorario_total), subtotal: Number(k.subtotal) })),
      pagosNeto: c.pagos_afore.map((x) => Number(x.monto_neto)), esperado: c.monto_afore_esperado === null ? null : Number(c.monto_afore_esperado),
      calculo: c.calculos[0]?.monto_estimado ? Number(c.calculos[0].monto_estimado) : null, pct, iva: p.IVA });
    // El cobrado de este caso ya cuenta en el mes; si todavía no, sería uno más.
    const yaCobrado = c.cobros.length > 0;
    return {
      casoId: c.id, folio: c.folio, cliente: [c.persona.nombre, c.persona.apellido_paterno].filter(Boolean).join(" "),
      honorario: h.honorario, subtotal: h.subtotal, costoAlta: costo.get(c.persona_id) ?? 0,
      asesor: c.socio ? { id: c.socio.id, nombre: c.socio.nombre, pct: Number(c.socio.porcentaje_socio) } : null,
      referidor: !esAsesor && c.referidor ? { id: c.referidor.id, nombre: c.referidor.nombre, referidosMes: (refMes.get(c.referidor.id) ?? 0) + (yaCobrado ? 0 : 1) } : null,
      comisiones: c.comisiones.map((k) => ({ tipo: k.tipo, estado: k.estado, monto: Number(k.monto) })),
    };
  });
  return comisionesProyectadasPorPagar(entrada, { base: p.BASE_REPARTO_SOCIO, iva: p.IVA, escalones: (d.esquema?.reglas as { escalones?: Escalon[] } | null)?.escalones ?? null });
}
