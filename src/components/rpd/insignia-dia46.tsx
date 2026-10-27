import { CalendarCheck, CalendarClock, CalendarX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fechaElegibleDesempleo, type FechaISO } from "@/lib/reglas/fechas";

export const isoDe = (d: Date | null | undefined): FechaISO | null => (d ? d.toISOString().slice(0, 10) : null);

export function formatoFecha(iso: FechaISO, opciones: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("es-MX", { ...opciones, timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

// Insignia con la fecha clave del retiro (10.3): ámbar mientras espera, verde cuando ya puede.
// Siempre lleva texto e ícono: el color nunca es la única señal (11.6).
export function InsigniaDia46({ fechaBaja, hoy, diasEspera }: { fechaBaja: Date | null | undefined; hoy: FechaISO; diasEspera: number }) {
  const baja = isoDe(fechaBaja);
  if (!baja) {
    return (
      <Badge tono="prospecto">
        <CalendarX className="size-3.5" aria-hidden /> Sin fecha de baja
      </Badge>
    );
  }
  const { fecha, diasFaltan, yaPuede } = fechaElegibleDesempleo(baja, hoy, { DIAS_ESPERA_DESEMPLEO: diasEspera });
  if (yaPuede) {
    return (
      <Badge tono="pagado" title={`Desde el ${formatoFecha(fecha, { dateStyle: "long" })}`}>
        <CalendarCheck className="size-3.5" aria-hidden /> Ya puede retirar
      </Badge>
    );
  }
  return (
    <Badge tono="espera" title={`Puede retirar el ${formatoFecha(fecha, { dateStyle: "long" })}`}>
      <CalendarClock className="size-3.5" aria-hidden /> Día 46 en {diasFaltan} {diasFaltan === 1 ? "día" : "días"}
    </Badge>
  );
}
