import { HandCoins } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { EstadoVacio } from "@/components/rpd/estado-vacio";

export const metadata: Metadata = { title: "Comisiones" };

export default function Comisiones() {
  return (
    <>
      <Encabezado titulo="Comisiones" descripcion="Se activa en la fase 3 (dinero), después de la calculadora." />
      <Card>
        <EstadoVacio icono={HandCoins} titulo="Sin comisiones todavía" texto="Cada comisión nace estimada al firmar contrato y se devenga cuando entra el dinero." />
      </Card>
    </>
  );
}
