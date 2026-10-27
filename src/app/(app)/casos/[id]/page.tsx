import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { LigasConsulta } from "@/components/rpd/ligas-consulta";
import { obtenerSesion } from "@/lib/auth/sesion";
import { ligasConsulta } from "@/lib/parametros";

export const metadata: Metadata = { title: "Expediente" };

const PESTANAS = ["Resumen", "Datos personales", "IMSS y Afore", "Cálculo", "Documentos", "Seguimiento", "Dinero", "Contrato"];

// 10.4: estructura del expediente. El contenido llega en la fase 1.
export default async function Expediente({ params }: { params: Promise<{ id: string }> }) {
  await obtenerSesion();
  const { id } = await params;
  const ligas = await ligasConsulta();
  return (
    <>
      <Encabezado titulo="Expediente" descripcion={`Caso ${id}`} />
      <nav aria-label="Secciones del expediente" className="-mx-4 mb-4 overflow-x-auto border-b border-borde px-4 md:mx-0 md:px-0">
        <ul className="flex gap-1">
          {PESTANAS.map((p, i) => (
            <li key={p}>
              <span className={`inline-block whitespace-nowrap border-b-2 px-3 py-2.5 text-sm ${i === 1 ? "border-brand font-medium text-brand" : "border-transparent text-ink-muted"}`}>{p}</span>
            </li>
          ))}
        </ul>
      </nav>
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Consultas oficiales</CardTitle></CardHeader>
        <CardContent className="pt-2"><LigasConsulta ligas={ligas} /></CardContent>
      </Card>
    </>
  );
}
