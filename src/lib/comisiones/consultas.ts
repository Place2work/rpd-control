// Liquidaciones de comisiones (9.3, 10.7). Con RLS: el Director ve todo; cada beneficiario
// con usuario (vendedor, socio) ve solo lo suyo. El mes de una comisión es el de su devengo.
import "server-only";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { finDeMes, sumar } from "@/lib/reglas/comisiones";

export type ClaveBenef = `${"usuario" | "referidor" | "socio"}:${string}`;
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function leerBenef(v: string | undefined | null): { tipo: "usuario" | "referidor" | "socio"; id: string } | null {
  const m = /^(usuario|referidor|socio):([0-9a-f-]{36})$/i.exec(v ?? "");
  return m ? { tipo: m[1] as "usuario" | "referidor" | "socio", id: m[2] } : null;
}

/** Nombres de todos los beneficiarios posibles (los que RLS deja ver). */
async function nombres(s: Sesion) {
  return conUsuario(s.claims, async (tx) => {
    const [u, r, so] = await Promise.all([
      tx.usuario.findMany({ select: { id: true, nombre: true } }),
      tx.referidor.findMany({ select: { id: true, nombre: true } }),
      tx.socio.findMany({ select: { id: true, nombre: true } }),
    ]);
    const m = new Map<string, string>();
    u.forEach((x) => m.set(`usuario:${x.id}`, x.nombre));
    r.forEach((x) => m.set(`referidor:${x.id}`, x.nombre));
    so.forEach((x) => m.set(`socio:${x.id}`, x.nombre));
    return m;
  }, s.ip);
}

export type ResumenBenef = { clave: ClaveBenef; nombre: string; tipo: string; porPagar: number; pagado: number; estimado: number; casos: number };

/** Resumen del mes por beneficiario: devengado por pagar, pagado y lo estimado (en camino). */
export async function resumenComisiones(s: Sesion, mes: string): Promise<ResumenBenef[]> {
  const desde = dia(`${mes}-01`), hasta = dia(finDeMes(mes));
  const [filas, n] = await Promise.all([
    conUsuario(s.claims, (tx) => tx.comision.findMany({
      where: { archivado_at: null, OR: [{ estado: "estimada" }, { estado: { in: ["devengada", "pagada"] }, fecha_devengo: { gte: desde, lte: hasta } }] },
      select: { beneficiario_tipo: true, beneficiario_id: true, tipo: true, estado: true, monto: true, caso_id: true },
    }), s.ip),
    nombres(s),
  ]);
  const grupos = new Map<ClaveBenef, typeof filas>();
  for (const f of filas) {
    const k = `${f.beneficiario_tipo}:${f.beneficiario_id}` as ClaveBenef;
    grupos.set(k, [...(grupos.get(k) ?? []), f]);
  }
  return [...grupos].map(([clave, l]) => ({
    clave, nombre: n.get(clave) ?? "—", tipo: l[0].tipo,
    porPagar: sumar(l.filter((x) => x.estado === "devengada").map((x) => Number(x.monto))),
    pagado: sumar(l.filter((x) => x.estado === "pagada").map((x) => Number(x.monto))),
    estimado: sumar(l.filter((x) => x.estado === "estimada").map((x) => Number(x.monto))),
    casos: new Set(l.map((x) => x.caso_id)).size,
  })).sort((a, b) => b.porPagar - a.porPagar || a.nombre.localeCompare(b.nombre));
}

/** Estado de cuenta de un beneficiario en un mes: devengadas y pagadas del mes + estimadas. */
export async function estadoDeCuenta(s: Sesion, benef: { tipo: "usuario" | "referidor" | "socio"; id: string }, mes: string) {
  const desde = dia(`${mes}-01`), hasta = dia(finDeMes(mes));
  const [comisiones, liquidaciones, n] = await Promise.all([
    conUsuario(s.claims, (tx) => tx.comision.findMany({
      where: {
        archivado_at: null, beneficiario_tipo: benef.tipo, beneficiario_id: benef.id,
        OR: [{ estado: "estimada" }, { estado: { in: ["devengada", "pagada"] }, fecha_devengo: { gte: desde, lte: hasta } }],
      },
      include: { caso: { select: { id: true, folio: true, tipo_servicio: true, persona: { select: { nombre: true, apellido_paterno: true } } } } },
      orderBy: [{ fecha_devengo: "asc" }, { created_at: "asc" }],
    }), s.ip),
    conUsuario(s.claims, (tx) => tx.liquidacion.findMany({ where: { beneficiario_tipo: benef.tipo, beneficiario_id: benef.id, periodo: desde }, orderBy: { created_at: "asc" } }), s.ip),
    nombres(s),
  ]);
  const del = (e: string) => comisiones.filter((c) => c.estado === e);
  return {
    nombre: n.get(`${benef.tipo}:${benef.id}`) ?? "—",
    comisiones,
    liquidaciones,
    totales: {
      porPagar: sumar(del("devengada").map((c) => Number(c.monto))),
      pagado: sumar(del("pagada").map((c) => Number(c.monto))),
      estimado: sumar(del("estimada").map((c) => Number(c.monto))),
      devengadoMes: sumar([...del("devengada"), ...del("pagada")].map((c) => Number(c.monto))),
    },
  };
}
