// Exporta un reporte (o todos) a Excel o PDF (10.8). Mismos datos y permisos que la pantalla.
import { NextResponse, type NextRequest } from "next/server";
import { exigirRol } from "@/lib/auth/sesion";
import { libroExcel, respuestaExcel } from "@/lib/exportar/excel";
import { formatoFechaLarga } from "@/lib/formato";
import { generarReportePdf } from "@/lib/pdf/reporte";
import { esReporte, generarReporte, REPORTES } from "@/lib/reportes/consultas";
import { periodoDe } from "@/lib/reportes/periodo";
import { hoyCDMX } from "@/lib/tiempo";

export async function GET(req: NextRequest) {
  const s = await exigirRol("director", "asesor");
  const q = req.nextUrl.searchParams;
  const p = periodoDe(q.get("desde"), q.get("hasta"), hoyCDMX());
  const clave = q.get("clave") ?? "";
  const formato = q.get("formato") === "pdf" ? "pdf" : "xlsx";
  if (clave !== "todos" && !esReporte(clave)) return new NextResponse("Reporte desconocido", { status: 400 });
  if (formato === "pdf" && clave === "todos") return new NextResponse("El PDF es por reporte", { status: 400 });
  const claves = clave === "todos" ? REPORTES.map(([k]) => k) : [clave as (typeof REPORTES)[number][0]];
  const reportes = await Promise.all(claves.map((k) => generarReporte(s, k, p)));
  const periodo = `${p.desde} a ${p.hasta}`;

  if (formato === "pdf") {
    const r = reportes[0];
    const pdf = await generarReportePdf({ ...r, periodo, emitido: formatoFechaLarga(hoyCDMX()) });
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="RPD-${r.clave}-${p.desde}-${p.hasta}.pdf"`, "Cache-Control": "private, no-store" },
    });
  }
  const buf = await libroExcel(reportes.map((r) => ({ nombre: r.titulo, titulo: `${r.titulo} · ${periodo}`, columnas: r.columnas, filas: r.filas, totales: r.totales })));
  return respuestaExcel(buf, `RPD-${clave}-${p.desde}-${p.hasta}`);
}
