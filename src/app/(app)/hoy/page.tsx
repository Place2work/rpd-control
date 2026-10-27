import { BellRing, CalendarClock, Filter, LineChart } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { EstadoVacio } from "@/components/rpd/estado-vacio";
import { obtenerSesion } from "@/lib/auth/sesion";
import { hoyCDMX } from "@/lib/tiempo";

export const metadata: Metadata = { title: "Hoy" };

// 10.1: fila de indicadores. Los valores llegan en las fases 1 y 3.
const INDICADORES = [
  "Prospectos activos", "Casos en trámite", "Listos para retirar esta semana", "SLA en riesgo",
  "Monto retirado del mes", "Honorarios cobrados del mes", "Por cobrar", "Comisiones por pagar",
];

export default async function Hoy() {
  const { usuario } = await obtenerSesion();
  const fecha = new Intl.DateTimeFormat("es-MX", { dateStyle: "full", timeZone: "America/Mexico_City" })
    .format(new Date(`${hoyCDMX()}T12:00:00-06:00`));
  return (
    <>
      <Encabezado titulo={`Hola, ${usuario.nombre.split(" ")[0]}`} descripcion={fecha.charAt(0).toUpperCase() + fecha.slice(1)} />
      <section aria-label="Indicadores" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {INDICADORES.map((t) => (
          <Card key={t} className="p-4">
            <p className="text-xs text-ink-muted">{t}</p>
            <p className="cifra mt-1 font-display text-[22px] font-semibold text-ink">—</p>
          </Card>
        ))}
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Alertas de hoy</CardTitle></CardHeader>
          <EstadoVacio icono={BellRing} titulo="Sin alertas por ahora"
            texto="Cada día a las 7:00 (hora de CDMX) el sistema revisa las fechas de todos los casos y deja aquí lo urgente." />
        </Card>
        <Card>
          <CardHeader><CardTitle>Próximos día 46</CardTitle></CardHeader>
          <EstadoVacio icono={CalendarClock} titulo="Nadie en cuenta regresiva"
            texto="Cuando captures la fecha de baja de un prospecto, verás aquí cuántos días le faltan para poder retirar." />
        </Card>
        <Card>
          <CardHeader><CardTitle>Embudo del mes</CardTitle></CardHeader>
          <EstadoVacio icono={Filter} titulo="Aún no hay movimiento" texto="Prospectos → precalificados → contratos → pagados, con la conversión entre etapas." />
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Ingresos de los últimos 12 meses</CardTitle></CardHeader>
          <EstadoVacio icono={LineChart} titulo="Sin honorarios cobrados" texto="Aquí verás los honorarios cobrados por mes y por servicio." />
        </Card>
      </div>
    </>
  );
}
