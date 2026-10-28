import { FileSpreadsheet, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Encabezado } from "@/components/rpd/encabezado";
import { GraficaBarras } from "@/components/rpd/grafica-barras";
import { exigirRol } from "@/lib/auth/sesion";
import { formatear } from "@/lib/formato";
import { esReporte, generarReporte, REPORTES } from "@/lib/reportes/consultas";
import { periodoDe } from "@/lib/reportes/periodo";
import { hoyCDMX } from "@/lib/tiempo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reportes" };

const boton = "inline-flex h-10 items-center gap-2 rounded-[var(--radius-boton)] border border-brand px-4 text-sm font-medium text-brand hover:bg-brand-tint";

// 10.8: cada reporte con su gráfica, su tabla y exportación a Excel y PDF.
export default async function Reportes({ searchParams }: { searchParams: Promise<{ r?: string; desde?: string; hasta?: string }> }) {
  const sesion = await exigirRol("director", "asesor");
  const q = await searchParams;
  const hoy = hoyCDMX();
  const p = periodoDe(q.desde, q.hasta, hoy);
  const clave = esReporte(q.r) ? q.r : "conversion_etapa";
  const r = await generarReporte(sesion, clave, p);
  const filtros = `desde=${p.desde}&hasta=${p.hasta}`;
  const g = r.grafica;

  return (
    <>
      <Encabezado titulo="Reportes" descripcion="Embudo, tiempos, ingresos y margen. Cada reporte se exporta a Excel y PDF.">
        <a href={`/api/exportar/reporte?clave=todos&${filtros}`} className={boton}><FileSpreadsheet className="size-4" aria-hidden /> Todos en Excel</a>
      </Encabezado>

      <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
        <input type="hidden" name="r" value={clave} />
        <div className="grid gap-1.5"><Label htmlFor="desde">Desde</Label><Input id="desde" name="desde" type="date" defaultValue={p.desde} max={hoy} className="w-44" /></div>
        <div className="grid gap-1.5"><Label htmlFor="hasta">Hasta</Label><Input id="hasta" name="hasta" type="date" defaultValue={p.hasta} max={hoy} className="w-44" /></div>
        <Button type="submit" variant="secundario">Aplicar</Button>
      </form>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Reportes" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <ul className="flex gap-1 lg:flex-col">
            {REPORTES.map(([k, t]) => (
              <li key={k}>
                <Link href={`/reportes?r=${k}&${filtros}`} aria-current={k === clave ? "page" : undefined}
                  className={cn("block whitespace-nowrap rounded-[var(--radius-boton)] px-3 py-2 text-sm", k === clave ? "bg-brand-tint font-medium text-brand" : "text-ink-muted hover:text-ink")}>{t}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <Card className="min-w-0">
          <CardHeader>
            <div>
              <CardTitle>{r.titulo}</CardTitle>
              <p className="mt-1 text-sm text-ink-muted">{r.descripcion}</p>
            </div>
            <div className="flex gap-2">
              <a href={`/api/exportar/reporte?clave=${clave}&${filtros}`} className={boton}><FileSpreadsheet className="size-4" aria-hidden /> Excel</a>
              <a href={`/api/exportar/reporte?clave=${clave}&formato=pdf&${filtros}`} target="_blank" rel="noopener" className={boton}><FileText className="size-4" aria-hidden /> PDF</a>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {r.filas.length === 0 ? <p className="text-sm text-ink-muted">Sin datos en el periodo.</p> : (
              <>
                {g && <GraficaBarras horizontal formato={g.formato} datos={r.filas.map((f) => ({ etiqueta: String(f[g.etiqueta] ?? "—"), valor: Number(f[g.valor] ?? 0) }))} />}
                <div className="-mx-4 overflow-x-auto px-4">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead><tr className="text-left text-xs text-ink-muted">{r.columnas.map((c) => <th key={c.clave} className={cn("pb-2 pr-3 font-medium", c.tipo && c.tipo !== "texto" && "text-right")}>{c.titulo}</th>)}</tr></thead>
                    <tbody>
                      {r.filas.map((f, i) => (
                        <tr key={i} className="border-t border-borde">
                          {r.columnas.map((c) => <td key={c.clave} className={cn("py-2 pr-3", c.tipo && c.tipo !== "texto" && "cifra text-right")}>{formatear(f[c.clave], c.tipo)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                    {r.totales && (
                      <tfoot><tr className="border-t-2 border-borde font-medium">
                        {r.columnas.map((c, i) => <td key={c.clave} className={cn("py-2 pr-3", c.tipo && c.tipo !== "texto" && "cifra text-right")}>{i === 0 ? "Total" : r.totales![c.clave] !== undefined ? formatear(r.totales![c.clave], c.tipo) : ""}</td>)}
                      </tr></tfoot>
                    )}
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
