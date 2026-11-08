// Excel de Clientes cerrados, con los mismos filtros de la pantalla. El vendedor no exporta (no ve dinero).
import type { NextRequest } from "next/server";
import { exigirRol } from "@/lib/auth/sesion";
import { listarCerrados } from "@/lib/cerrados/consultas";
import { libroExcel, respuestaExcel } from "@/lib/exportar/excel";
import { sumar } from "@/lib/reglas/comisiones";
import { filtrarCerrados } from "@/lib/reglas/cerrados";
import { hoyCDMX } from "@/lib/tiempo";

export async function GET(req: NextRequest) {
  const s = await exigirRol("director", "asesor", "socio");
  const q = req.nextUrl.searchParams;
  const hoy = hoyCDMX();
  const mes = q.get("mes") ?? "";
  const filas = filtrarCerrados(await listarCerrados(s), {
    mes: /^\d{4}-\d{2}$/.test(mes) ? mes : undefined,
    vendedor: q.get("vendedor") || undefined,
    proximos: Number(q.get("proximos")) > 0 ? Number(q.get("proximos")) : undefined,
  }, hoy);
  const buf = await libroExcel([{
    nombre: "Clientes cerrados", titulo: `RetiroPorDesempleo.com · clientes cerrados al ${hoy}`,
    columnas: [
      { clave: "folio", titulo: "Folio" }, { clave: "cliente", titulo: "Cliente", ancho: 32 }, { clave: "servicio", titulo: "Servicio", ancho: 22 },
      { clave: "vendedor", titulo: "Asesor de pensiones", ancho: 22 }, { clave: "cerrado", titulo: "Cerrado", tipo: "fecha", ancho: 12 },
      { clave: "deposito", titulo: "Depósito Afore", tipo: "fecha", ancho: 14 }, { clave: "neto", titulo: "Monto retirado", tipo: "pesos", ancho: 16 },
      { clave: "honorario", titulo: "Honorario cobrado", tipo: "pesos", ancho: 18 }, { clave: "comprobante", titulo: "Comprobante", ancho: 12 },
      { clave: "proximo", titulo: "Próximo retiro", tipo: "fecha", ancho: 14 },
    ],
    filas: filas.map((c) => ({
      folio: c.folio, cliente: c.nombre, servicio: c.servicio, vendedor: c.vendedor, cerrado: c.cerradoEl,
      deposito: c.deposito?.fecha ?? null, neto: c.deposito?.neto ?? null, honorario: c.honorario,
      comprobante: c.comprobantes.de > 0 && c.comprobantes.con === c.comprobantes.de ? "Sí" : "Falta", proximo: c.proximoRetiro,
    })),
    totales: { neto: sumar(filas.map((c) => c.deposito?.neto ?? 0)), honorario: sumar(filas.map((c) => c.honorario ?? 0)) },
  }]);
  return respuestaExcel(buf, `clientes-cerrados-${hoy}.xlsx`);
}
