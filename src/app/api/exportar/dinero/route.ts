// Excel de Dinero: resumen mensual (subtotal e IVA para el RESICO) y el detalle de cobros del mes.
import type { NextRequest } from "next/server";
import { exigirRol } from "@/lib/auth/sesion";
import { mesValido } from "@/components/rpd/selector-mes";
import { conUsuario } from "@/lib/db/prisma";
import { resumenDinero } from "@/lib/dinero/consultas";
import { libroExcel, respuestaExcel } from "@/lib/exportar/excel";
import { finDeMes, sumar } from "@/lib/reglas/comisiones";
import { hoyCDMX } from "@/lib/tiempo";

export async function GET(req: NextRequest) {
  const s = await exigirRol("director", "asesor", "socio");
  const mes = mesValido(req.nextUrl.searchParams.get("mes") ?? undefined, hoyCDMX().slice(0, 7));
  const d = await resumenDinero(s, mes);
  const cobros = await conUsuario(s.claims, (tx) => tx.cobro.findMany({
    where: { estado: "cobrado", archivado_at: null, fecha_cobro: { gte: new Date(`${mes}-01T00:00:00Z`), lte: new Date(`${finDeMes(mes)}T00:00:00Z`) } },
    include: { caso: { select: { folio: true, tipo_servicio: true, persona: { select: { nombre: true, apellido_paterno: true, apellido_materno: true } } } }, pago_afore: { select: { numero: true } } },
    orderBy: { fecha_cobro: "asc" },
  }), s.ip);
  const n = (v: unknown) => Number(v ?? 0);
  const buf = await libroExcel([
    {
      nombre: "Resumen mensual", titulo: `RetiroPorDesempleo.com · honorarios cobrados (12 meses hasta ${mes})`,
      columnas: [{ clave: "mes", titulo: "Mes" }, { clave: "cobros", titulo: "Cobros", tipo: "numero" }, { clave: "total", titulo: "Honorario (IVA incl.)", tipo: "pesos", ancho: 20 },
        { clave: "subtotal", titulo: "Subtotal", tipo: "pesos", ancho: 16 }, { clave: "iva", titulo: "IVA", tipo: "pesos", ancho: 14 }, { clave: "depositado", titulo: "Depositado Afore", tipo: "pesos", ancho: 18 }],
      filas: d.meses.map((m) => ({ ...m })),
      totales: { cobros: d.meses.reduce((a, m) => a + m.cobros, 0), total: sumar(d.meses.map((m) => m.total)), subtotal: sumar(d.meses.map((m) => m.subtotal)), iva: sumar(d.meses.map((m) => m.iva)), depositado: sumar(d.meses.map((m) => m.depositado)) },
    },
    {
      nombre: `Cobros ${mes}`, titulo: `Cobros del mes ${mes}`,
      columnas: [{ clave: "fecha", titulo: "Fecha", ancho: 12 }, { clave: "folio", titulo: "Folio" }, { clave: "cliente", titulo: "Cliente", ancho: 30 }, { clave: "servicio", titulo: "Servicio", ancho: 18 },
        { clave: "concepto", titulo: "Concepto", ancho: 16 }, { clave: "total", titulo: "Honorario", tipo: "pesos", ancho: 14 }, { clave: "subtotal", titulo: "Subtotal", tipo: "pesos", ancho: 14 },
        { clave: "iva", titulo: "IVA", tipo: "pesos" }, { clave: "metodo", titulo: "Método", ancho: 14 }, { clave: "referencia", titulo: "Referencia", ancho: 16 }, { clave: "factura", titulo: "Factura", ancho: 12 }],
      filas: cobros.map((c) => ({
        fecha: c.fecha_cobro?.toISOString().slice(0, 10) ?? null, folio: c.caso.folio,
        cliente: [c.caso.persona.nombre, c.caso.persona.apellido_paterno, c.caso.persona.apellido_materno].filter(Boolean).join(" "),
        servicio: c.caso.tipo_servicio, concepto: c.pago_afore ? `Pago ${c.pago_afore.numero} Afore` : c.concepto,
        total: n(c.honorario_total), subtotal: n(c.subtotal), iva: n(c.iva), metodo: c.metodo, referencia: c.referencia, factura: c.factura_folio,
      })),
      totales: { total: sumar(cobros.map((c) => n(c.honorario_total))), subtotal: sumar(cobros.map((c) => n(c.subtotal))), iva: sumar(cobros.map((c) => n(c.iva))) },
    },
  ]);
  return respuestaExcel(buf, `RPD-dinero-${mes}`);
}
