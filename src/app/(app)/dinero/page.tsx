import { Banknote } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { EstadoVacio } from "@/components/rpd/estado-vacio";

export const metadata: Metadata = { title: "Dinero" };

export default function Dinero() {
  return (
    <>
      <Encabezado titulo="Dinero" />
      <Card>
        <EstadoVacio icono={Banknote} titulo="Sin pagos de Afore registrados" texto="Aquí verás los depósitos de la Afore, los cobros del honorario con subtotal e IVA y lo pendiente por conciliar." />
      </Card>
    </>
  );
}
