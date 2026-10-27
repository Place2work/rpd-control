import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { exigirRol } from "@/lib/auth/sesion";
import { prismaSistema } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Configuración" };

const fecha = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "sin fin");

// 10.9, solo Director. En fase 0 es de consulta; la edición con vigencia llega en la fase 1.
export default async function Configuracion() {
  await exigirRol("director");
  const [parametros, servicios, documentos, afores, inhabiles] = await Promise.all([
    prismaSistema.parametro.findMany({ orderBy: [{ clave: "asc" }, { vigente_desde: "desc" }] }),
    prismaSistema.tipoServicio.count(),
    prismaSistema.tipoDocumento.count(),
    prismaSistema.afore.count(),
    prismaSistema.diaInhabil.count(),
  ]);
  return (
    <>
      <Encabezado titulo="Configuración" descripcion="Parámetros con vigencia, catálogos y bitácora." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Servicios", servicios], ["Tipos de documento", documentos], ["Afores", afores], ["Días inhábiles", inhabiles]].map(([t, n]) => (
          <Card key={t} className="p-4">
            <p className="text-xs text-ink-muted">{t}</p>
            <p className="cifra mt-1 font-display text-[22px] font-semibold">{n}</p>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Parámetros</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-left text-xs text-ink-muted">
              <tr className="border-b border-borde">
                <th className="py-2 pr-4 font-medium">Clave</th>
                <th className="py-2 pr-4 text-right font-medium">Valor</th>
                <th className="py-2 pr-4 font-medium">Vigencia</th>
                <th className="py-2 font-medium">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {parametros.map((p) => (
                <tr key={p.id} className="border-b border-borde last:border-0">
                  <td className="py-2 pr-4 font-mono text-xs">{p.clave}</td>
                  <td className="cifra max-w-64 truncate py-2 pr-4 text-right" title={p.valor}>{p.valor}</td>
                  <td className="cifra whitespace-nowrap py-2 pr-4 text-ink-muted">{fecha(p.vigente_desde)} → {fecha(p.vigente_hasta)}</td>
                  <td className="py-2 text-ink-muted">{p.descripcion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}
