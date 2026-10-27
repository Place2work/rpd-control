import { BellRing, CalendarClock, Filter, LineChart } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { EstadoVacio } from "@/components/rpd/estado-vacio";
import Link from "next/link";
import { formatoFecha } from "@/components/rpd/insignia-dia46";
import { obtenerSesion } from "@/lib/auth/sesion";
import { parametrosFechas } from "@/lib/parametros";
import { ETAPAS_PROSPECTO, listarCasos, nombreCompleto } from "@/lib/prospectos/consultas";
import { fechaElegibleDesempleo } from "@/lib/reglas/fechas";
import { hoyCDMX } from "@/lib/tiempo";

export const metadata: Metadata = { title: "Hoy" };

const EN_TRAMITE = new Set(["CONTRATO", "EXPEDIENTE", "INGRESADA", "RESOLUCION"]);
// Antes del contrato es cuando importa avisar del día 46.
const ANTES_DE_INGRESAR = new Set([...ETAPAS_PROSPECTO, "CONTRATO", "EXPEDIENTE"]);

export default async function Hoy() {
  const sesion = await obtenerSesion();
  const { usuario } = sesion;
  const hoy = hoyCDMX();
  const [casos, p] = await Promise.all([listarCasos(sesion), parametrosFechas(hoy)]);

  // Próximos día 46 (10.1): retiros que aún no se ingresan, con fecha de baja, en los próximos 14 días.
  const proximos = casos
    .filter((c) => c.servicio.clave === "RETIRO_DESEMPLEO" && ANTES_DE_INGRESAR.has(c.etapa) && c.datos_imss?.fecha_baja)
    .map((c) => ({ c, d: fechaElegibleDesempleo(c.datos_imss!.fecha_baja!.toISOString().slice(0, 10), hoy, p) }))
    .filter(({ d }) => d.diasFaltan <= 14)
    .sort((a, b) => a.d.fecha.localeCompare(b.d.fecha));

  // 10.1: fila de indicadores. Los de dinero llegan en la fase 3.
  const INDICADORES: [string, string][] = [
    ["Prospectos activos", String(casos.filter((c) => ETAPAS_PROSPECTO.includes(c.etapa)).length)],
    ["Casos en trámite", String(casos.filter((c) => EN_TRAMITE.has(c.etapa)).length)],
    ["Listos para retirar esta semana", String(proximos.filter(({ d }) => d.diasFaltan <= 7).length)],
    ["SLA en riesgo", "—"],
    ["Monto retirado del mes", "—"],
    ["Honorarios cobrados del mes", "—"],
    ["Por cobrar", "—"],
    ["Comisiones por pagar", "—"],
  ];

  const fecha = new Intl.DateTimeFormat("es-MX", { dateStyle: "full", timeZone: "America/Mexico_City" })
    .format(new Date(`${hoy}T12:00:00-06:00`));
  return (
    <>
      <Encabezado titulo={`Hola, ${usuario.nombre.split(" ")[0]}`} descripcion={fecha.charAt(0).toUpperCase() + fecha.slice(1)} />
      <section aria-label="Indicadores" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {INDICADORES.map(([t, v]) => (
          <Card key={t} className="p-4">
            <p className="text-xs text-ink-muted">{t}</p>
            <p className={`cifra mt-1 font-display text-[22px] font-semibold ${v === "—" ? "text-ink-muted/60" : "text-ink"}`}>{v}</p>
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
          {proximos.length === 0 ? (
            <EstadoVacio icono={CalendarClock} titulo="Nadie en cuenta regresiva"
              texto="Cuando captures la fecha de baja de un prospecto, verás aquí cuántos días le faltan para poder retirar." />
          ) : (
            <ul className="divide-y divide-borde pb-2">
              {proximos.map(({ c, d }) => (
                <li key={c.id}>
                  <Link href={`/casos/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-brand-tint/40">
                    <span className={`cifra flex size-11 shrink-0 flex-col items-center justify-center rounded-lg font-display text-lg font-semibold leading-none ${d.yaPuede ? "bg-exito-tint text-exito-texto" : "bg-aviso-tint text-aviso"}`}>
                      {d.yaPuede ? "✓" : d.diasFaltan}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{nombreCompleto(c.persona)}</span>
                      <span className="block text-xs text-ink-muted">
                        {d.yaPuede ? "Ya puede retirar" : `${d.diasFaltan === 1 ? "Falta 1 día" : `Faltan ${d.diasFaltan} días`} · ${formatoFecha(d.fecha)}`}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
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
