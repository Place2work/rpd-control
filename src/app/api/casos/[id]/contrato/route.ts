// Contrato o aviso de privacidad del caso, en PDF, desde la plantilla vigente a la fecha de firma.
// Imprime CURP y NSS completos: cada uno se abre con verDatoSensible() y deja renglón en la bitácora.
import { NextResponse, type NextRequest } from "next/server";
import { obtenerSesion } from "@/lib/auth/sesion";
import { datosContrato, plantillaVigente, sensiblesDe, type Clase } from "@/lib/contratos/datos";
import { bloques, llenar } from "@/lib/contratos/plantilla";
import { conUsuario } from "@/lib/db/prisma";
import { generarContratoPdf } from "@/lib/pdf/contrato";

const PIE: Record<Clase, (comercial: string) => string> = {
  contrato: () => "Contrato de prestación de servicios de asesoría · hola@retiropordesempleo.com · www.retiropordesempleo.com",
  aviso_privacidad: (c) => `Aviso de Privacidad · ${c} · hola@retiropordesempleo.com`,
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await obtenerSesion();
  if (s.usuario.rol === "vendedor") return new NextResponse("El contrato lo genera el asesor.", { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("No encontrado", { status: 404 });
  const clase: Clase = req.nextUrl.searchParams.get("doc") === "aviso_privacidad" ? "aviso_privacidad" : "contrato";

  const previo = await conUsuario(s.claims, (tx) => tx.caso.findUnique({ where: { id }, select: { tipo_servicio: true, fecha_contrato: true } }), s.ip);
  if (!previo) return new NextResponse("No encontrado", { status: 404 });
  const fechaPlantilla = previo.fecha_contrato?.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const plantilla = await plantillaVigente(previo.tipo_servicio, clase, fechaPlantilla);
  if (!plantilla) return new NextResponse("Este servicio todavía no tiene plantilla de ese documento.", { status: 404 });

  const r = await datosContrato(s, id, true, sensiblesDe(plantilla.cuerpo, clase));
  if (!r) return new NextResponse("No encontrado", { status: 404 });
  const { texto } = llenar(plantilla.cuerpo, r.datos);
  const pdf = await generarContratoPdf({
    clase, titulo: `${plantilla.nombre ?? "Contrato"} ${r.caso.folio}`, pie: PIE[clase](String((r.datos.prestador as Record<string, string>).nombre_comercial)),
    bloques: bloques(texto), firmas: r.firmas[clase], fecha: r.fecha,
  });

  await conUsuario(s.claims, async (tx) => {
    if (clase === "contrato") await tx.caso.update({ where: { id }, data: { contrato_generado_at: new Date() }, select: { id: true } });
    await tx.evento.create({ data: { caso_id: id, tipo: "documento", usuario_id: s.usuario.id, texto: `Se generó ${clase === "contrato" ? "el contrato" : "el aviso de privacidad"} (plantilla v${plantilla.version})` } });
  }, s.ip);

  const nombre = `${clase === "contrato" ? "Contrato" : "Aviso-Privacidad"}-${r.caso.folio}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nombre}"`, "Cache-Control": "private, no-store" },
  });
}
