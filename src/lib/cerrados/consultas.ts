// Clientes cerrados (etapa «Honorario cobrado»). Con RLS: cada quien ve los casos que le tocan; el
// vendedor no ve pagos ni cobros, así que para él los montos quedan vacíos.
import "server-only";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { parametrosFechas } from "@/lib/parametros";
import { fechaProximoRetiro } from "@/lib/reglas/alertas";
import type { ClienteCerrado } from "@/lib/reglas/cerrados";
import { hoyCDMX, inicioDiaCDMX } from "@/lib/tiempo";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function listarCerrados(s: Sesion): Promise<ClienteCerrado[]> {
  const veDinero = s.usuario.rol !== "vendedor";
  const [casos, p] = await Promise.all([
    conUsuario(s.claims, (tx) => tx.caso.findMany({
      where: { archivado_at: null, etapa: "CERRADO" },
      orderBy: { etapa_desde: "desc" },
      select: {
        id: true, folio: true, etapa_desde: true, tipo_servicio: true, vendedor_id: true,
        persona: { select: { nombre: true, apellido_paterno: true, apellido_materno: true } },
        servicio: { select: { nombre: true } },
        vendedor: { select: { nombre: true } },
        pagos_afore: { where: { archivado_at: null }, orderBy: { numero: "asc" }, take: 1, select: { fecha_deposito: true, monto_neto: true } },
        cobros: { where: { archivado_at: null, estado: "cobrado" }, select: { honorario_total: true, comprobante_path: true } },
      },
    }), s.ip),
    parametrosFechas(hoyCDMX()),
  ]);
  return casos.map((c) => {
    const pago = c.pagos_afore[0];
    return {
      id: c.id, folio: c.folio,
      nombre: [c.persona.nombre, c.persona.apellido_paterno, c.persona.apellido_materno].filter(Boolean).join(" "),
      servicio: c.servicio.nombre.split(" (")[0],
      vendedorId: c.vendedor_id, vendedor: c.vendedor?.nombre ?? null,
      cerradoEl: hoyCDMX(c.etapa_desde),
      deposito: pago ? { fecha: iso(pago.fecha_deposito), neto: Number(pago.monto_neto) } : null,
      honorario: veDinero ? Math.round(c.cobros.reduce((a, k) => a + Math.round(Number(k.honorario_total) * 100), 0)) / 100 : null,
      comprobantes: { con: c.cobros.filter((k) => k.comprobante_path).length, de: c.cobros.length },
      proximoRetiro: c.tipo_servicio === "RETIRO_DESEMPLEO" && pago ? fechaProximoRetiro(iso(pago.fecha_deposito), p) : null,
    };
  });
}

/** Vendedores para el filtro (solo quien ve todo el equipo lo necesita). */
export async function vendedoresParaFiltro(s: Sesion) {
  if (s.usuario.rol === "vendedor") return [];
  return conUsuario(s.claims, (tx) => tx.usuario.findMany({ where: { rol: "vendedor", archivado_at: null }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }), s.ip);
}

/** Movimientos del mes para el embudo de Hoy: etapas alcanzadas (historial) y pagos de la Afore (con RLS). */
export async function movimientosDelMes(s: Sesion, mes: string) {
  const [a, m] = mes.split("-").map(Number);
  const siguiente = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
  return conUsuario(s.claims, async (tx) => {
    const [historial, pagos] = await Promise.all([
      // historial.fecha es un momento (timestamptz): el mes va de las 00:00 a las 00:00 de la Ciudad de México.
      tx.historialEtapa.findMany({ where: { fecha: { gte: inicioDiaCDMX(`${mes}-01`), lt: inicioDiaCDMX(siguiente) }, caso: { tipo_servicio: "RETIRO_DESEMPLEO", archivado_at: null } }, select: { caso_id: true, etapa_nueva: true } }),
      // fecha_deposito es un día (DATE): se compara tal cual.
      tx.pagoAfore.findMany({ where: { archivado_at: null, fecha_deposito: { gte: new Date(`${mes}-01T00:00:00Z`), lt: new Date(`${siguiente}T00:00:00Z`) } }, select: { caso_id: true, monto_neto: true } }),
    ]);
    return {
      movimientos: historial.map((h) => ({ casoId: h.caso_id, etapa: h.etapa_nueva })),
      pagos: pagos.map((p) => ({ casoId: p.caso_id, neto: Number(p.monto_neto) })),
    };
  }, s.ip);
}
