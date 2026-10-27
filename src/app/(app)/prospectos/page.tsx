import { Search, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Encabezado } from "@/components/rpd/encabezado";
import { EstadoVacio } from "@/components/rpd/estado-vacio";
import { LigasConsulta } from "@/components/rpd/ligas-consulta";
import { obtenerSesion } from "@/lib/auth/sesion";
import { ligasConsulta } from "@/lib/parametros";

export const metadata: Metadata = { title: "Prospectos" };

export default async function Prospectos() {
  await obtenerSesion();
  const ligas = await ligasConsulta();
  return (
    <>
      <Encabezado titulo="Prospectos" descripcion="Alta rápida, búsqueda y precalificación.">
        <Button disabled title="Disponible en la fase 1"><UserPlus aria-hidden /> Alta rápida</Button>
      </Encabezado>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="pb-0">
            <label className="relative block">
              <span className="sr-only">Buscar</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
              <Input className="pl-9" placeholder="Nombre, teléfono, CURP, NSS o folio" disabled />
            </label>
          </CardContent>
          <EstadoVacio icono={UserPlus} titulo="Aún no hay prospectos"
            texto="Da de alta al primero con su nombre y WhatsApp; el resto se completa después." />
        </Card>
        <Card>
          <CardHeader><CardTitle>Consultas oficiales</CardTitle></CardHeader>
          <CardContent className="pt-2">
            <p className="text-sm text-ink-muted">Para confirmar la CURP o el NSS del cliente antes de capturarlos.</p>
            <LigasConsulta ligas={ligas} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
