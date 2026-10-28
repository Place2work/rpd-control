import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

const nombreMes = (mes: string) => {
  const t = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${mes}-01T00:00:00Z`));
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function moverMes(mes: string, delta: number) {
  const [a, m] = mes.split("-").map(Number);
  const t = a * 12 + (m - 1) + delta;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export const mesValido = (v: string | undefined, defecto: string) => (v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : defecto);

/** Navegación por mes con ligas (sin JavaScript). `base` conserva los demás filtros. */
export function SelectorMes({ mes, base, maximo }: { mes: string; base: string; maximo: string }) {
  const liga = (m: string) => `${base}${base.includes("?") ? "&" : "?"}mes=${m}`;
  const clase = "inline-flex size-10 items-center justify-center rounded-[var(--radius-boton)] border border-borde text-ink hover:bg-brand-tint";
  return (
    <nav aria-label="Mes" className="flex items-center gap-2">
      <Link href={liga(moverMes(mes, -1))} className={clase} aria-label="Mes anterior"><ChevronLeft className="size-4" aria-hidden /></Link>
      <span className="min-w-36 text-center text-sm font-medium text-ink">{nombreMes(mes)}</span>
      {mes < maximo ? (
        <Link href={liga(moverMes(mes, 1))} className={clase} aria-label="Mes siguiente"><ChevronRight className="size-4" aria-hidden /></Link>
      ) : <span className={`${clase} opacity-40`} aria-hidden><ChevronRight className="size-4" /></span>}
    </nav>
  );
}

export { nombreMes };
