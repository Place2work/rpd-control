// Parte de dinero de la tarea diaria (8.1 y 9): recalcula las comisiones que siguen
// estimadas (así el escalón de referidos se cierra solo al cambiar de mes) y crea las
// alertas HONORARIO_POR_COBRAR, PAGO_AFORE_PENDIENTE y COMISION_POR_PAGAR.
import "server-only";
import { prismaSistema } from "@/lib/db/prisma";
import { alertasDinero, type CasoConPagos, type ComisionPorPagar } from "@/lib/reglas/comisiones";
import { hoyCDMX } from "@/lib/tiempo";
import { recalcularComisiones } from "./motor";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function tareaDinero(hoy = hoyCDMX()) {
  const db = prismaSistema;
  const pendientes = await db.comision.findMany({ where: { estado: "estimada", archivado_at: null }, select: { caso_id: true }, distinct: ["caso_id"] });
  const recalculo = await recalcularComisiones(pendientes.map((c) => c.caso_id), hoy);

  const casos = await db.caso.findMany({
    where: { archivado_at: null, etapa: { not: "PERDIDO" }, pagos_afore: { some: { archivado_at: null } } },
    select: {
      id: true, folio: true, etapa: true, asignado_a: true,
      persona: { select: { nombre: true, apellido_paterno: true } },
      calculos: { orderBy: { created_at: "desc" }, take: 1, select: { modalidad_elegida: true } },
      pagos_afore: { where: { archivado_at: null }, select: { id: true, numero: true, fecha_deposito: true, cobros: { where: { archivado_at: null, estado: { not: "cancelado" } }, select: { estado: true } } } },
    },
  });
  const fotos: CasoConPagos[] = casos.map((c) => ({
    id: c.id, folio: c.folio, etapa: c.etapa, nombre: [c.persona.nombre, c.persona.apellido_paterno].filter(Boolean).join(" "),
    modalidad: c.calculos[0]?.modalidad_elegida === "A" || c.calculos[0]?.modalidad_elegida === "B" ? c.calculos[0].modalidad_elegida : null,
    pagos: c.pagos_afore.map((p) => ({ id: p.id, numero: p.numero, fecha: iso(p.fecha_deposito), tieneCobro: p.cobros.length > 0, cobrado: p.cobros.some((k) => k.estado === "cobrado") })),
  }));

  const [devengadas, usuarios, referidores, socios] = await Promise.all([
    db.comision.findMany({ where: { estado: "devengada", archivado_at: null, fecha_devengo: { not: null } }, select: { id: true, beneficiario_tipo: true, beneficiario_id: true, monto: true, fecha_devengo: true } }),
    db.usuario.findMany({ select: { id: true, nombre: true } }),
    db.referidor.findMany({ select: { id: true, nombre: true } }),
    db.socio.findMany({ select: { id: true, nombre: true } }),
  ]);
  const nombres = new Map<string, string>([
    ...usuarios.map((x) => [`usuario:${x.id}`, x.nombre] as const), ...referidores.map((x) => [`referidor:${x.id}`, x.nombre] as const), ...socios.map((x) => [`socio:${x.id}`, x.nombre] as const),
  ]);
  const porPagar: ComisionPorPagar[] = devengadas.map((k) => {
    const clave = `${k.beneficiario_tipo}:${k.beneficiario_id}`;
    return { id: k.id, beneficiarioClave: clave, beneficiario: nombres.get(clave) ?? "Beneficiario", monto: Number(k.monto), fechaDevengo: iso(k.fecha_devengo!) };
  });

  const directores = (await db.usuario.findMany({ where: { rol: "director", activo: true, archivado_at: null }, select: { id: true } })).map((u) => u.id);
  const asesorDe = new Map(casos.map((c) => [c.id, c.asignado_a]));
  const filas = alertasDinero(fotos, porPagar, hoy).flatMap((a) => {
    const para = new Set<string>();
    for (const d of a.para) {
      if (d === "director") directores.forEach((x) => para.add(x));
      // Sin asesor asignado, lo del asesor va al Director (bandeja general).
      if (d === "asesor") { const u = a.casoId ? asesorDe.get(a.casoId) : null; (u ? [u] : directores).forEach((x) => para.add(x)); }
    }
    return [...para].map((u) => ({ regla: a.regla, caso_id: a.casoId, severidad: a.severidad, mensaje: a.mensaje, fecha_disparo: new Date(`${hoy}T00:00:00Z`), asignado_a: u, clave_dedup: a.clave }));
  });
  const creadas = filas.length ? await db.alerta.createMany({ data: filas, skipDuplicates: true }) : { count: 0 };
  return { comisiones: recalculo, alertas_dinero: creadas.count };
}
