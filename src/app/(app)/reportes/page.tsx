import { BarChart3 } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { EstadoVacio } from "@/components/rpd/estado-vacio";

export const metadata: Metadata = { title: "Reportes" };

export default function Reportes() {
  return (
    <>
      <Encabezado titulo="Reportes" />
      <Card>
        <EstadoVacio icono={BarChart3} titulo="Sin datos para reportar" texto="Conversión por etapa, tiempos, motivos de pérdida, ingresos y margen por canal." />
      </Card>
    </>
  );
}
