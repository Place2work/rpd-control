import { CalendarCheck, CalendarClock, CalendarX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fechasRetiroDesempleo, type FechaISO, type FechasRetiro } from "@/lib/reglas/fechas";

export const isoDe = (d: Date | null | undefined): FechaISO | null => (d ? d.toISOString().slice(0, 10) : null);

export function formatoFecha(iso: FechaISO, opciones: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("es-MX", { ...opciones, timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

/**
 * Texto de las dos fechas del retiro (10.3): la legal (día 46, ya puede retirar) y la del trámite (46 + días
 * administrativos de la empresa). Así un vendedor entiende qué falta sin hacer cuentas.
 */
export function estadoRetiro(f: FechasRetiro): { texto: string; tono: "espera" | "tramite" | "pagado"; titulo: string } {
  const legal = `Cumple ${f.diasEspera} días el ${formatoFecha(f.legal.fecha, { dateStyle: "long" })}`;
  const tramite = f.diasAdmin > 0 ? ` · trámite el ${formatoFecha(f.tramite.fecha, { dateStyle: "long" })} (+${f.diasAdmin} días administrativos)` : "";
  const titulo = legal + tramite;
  const dias = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;
  if (!f.legal.yaPuede) return { texto: `Día ${f.diasEspera} en ${dias(f.legal.diasFaltan)}`, tono: "espera", titulo };
  if (!f.tramite.listo) return { texto: `Cumplió ${f.diasEspera} días · trámite en ${dias(f.tramite.diasFaltan)}`, tono: "tramite", titulo };
  return { texto: f.diasAdmin > 0 ? "Listo para trámite" : "Ya puede retirar", tono: "pagado", titulo };
}

// Insignia con las fechas clave del retiro: ámbar mientras espera el día 46, azul en los días administrativos,
// verde cuando ya se puede ingresar. Siempre lleva texto e ícono: el color nunca es la única señal (11.6).
export function InsigniaDia46({ fechaBaja, hoy, diasEspera, diasAdmin }: { fechaBaja: Date | null | undefined; hoy: FechaISO; diasEspera: number; diasAdmin: number }) {
  const baja = isoDe(fechaBaja);
  if (!baja) {
    return (
      <Badge tono="prospecto">
        <CalendarX className="size-3.5" aria-hidden /> Sin fecha de baja
      </Badge>
    );
  }
  const e = estadoRetiro(fechasRetiroDesempleo(baja, hoy, { DIAS_ESPERA_DESEMPLEO: diasEspera, DIAS_ADMINISTRATIVOS: diasAdmin }));
  const Icono = e.tono === "pagado" ? CalendarCheck : CalendarClock;
  return (
    <Badge tono={e.tono} title={e.titulo}>
      <Icono className="size-3.5" aria-hidden /> {e.texto}
    </Badge>
  );
}
