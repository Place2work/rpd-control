// PDF del estado de cuenta de un beneficiario y mes. RLS decide qué comisiones se ven: el
// Director cualquiera; un vendedor o socio solo el suyo (si pide otro, sale vacío).
import { NextResponse, type NextRequest } from "next/server";
import { mesValido, nombreMes } from "@/components/rpd/selector-mes";
import { obtenerSesion } from "@/lib/auth/sesion";
import { estadoDeCuenta, leerBenef } from "@/lib/comisiones/consultas";
import { formatoFechaLarga } from "@/lib/formato";
import { generarEstadoCuenta, type RenglonEstado } from "@/lib/pdf/estado-cuenta";
import { hoyCDMX } from "@/lib/tiempo";

const TIPO = { usuario: "Vendedor", referidor: "Referidor", socio: "Socio licenciatario" } as const;
const ESTADO = { estimada: "Estimada", devengada: "Por pagar", pagada: "Pagada", cancelada: "Cancelada" } as const;

export async function GET(req: NextRequest) {
  const s = await obtenerSesion();
  const benef = leerBenef(req.nextUrl.searchParams.get("benef"));
  const hoy = hoyCDMX();
  const mes = mesValido(req.nextUrl.searchParams.get("mes") ?? undefined, hoy.slice(0, 7));
  if (!benef) return new NextResponse("Beneficiario no válido", { status: 400 });
  const e = await estadoDeCuenta(s, benef, mes);
  const renglon = (c: (typeof e.comisiones)[number]): RenglonEstado => ({
    fecha: c.fecha_devengo?.toISOString().slice(0, 10) ?? "—", folio: c.caso.folio,
    cliente: [c.caso.persona.nombre, c.caso.persona.apellido_paterno].filter(Boolean).join(" "),
    concepto: c.tipo, regla: c.regla_aplicada, estado: ESTADO[c.estado], monto: Number(c.monto),
  });
  const pdf = await generarEstadoCuenta({
    beneficiario: e.nombre, tipo: TIPO[benef.tipo], mes: nombreMes(mes), emitido: formatoFechaLarga(hoy),
    devengadas: e.comisiones.filter((c) => c.estado !== "estimada").map(renglon),
    estimadas: e.comisiones.filter((c) => c.estado === "estimada").map(renglon),
    pagos: e.liquidaciones.map((l) => ({ fecha: l.fecha_pago.toISOString().slice(0, 10), metodo: l.metodo, referencia: l.referencia, total: Number(l.total) })),
    totales: e.totales,
  });
  const archivo = `Estado-de-cuenta-${e.nombre.replace(/[^\p{L}\p{N}]+/gu, "-")}-${mes}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${archivo}"`, "Cache-Control": "private, no-store" },
  });
}
