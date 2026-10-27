import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Campos de formulario del expediente, sin estado (se usan dentro de FormularioAccion).
export const claseSelect = "h-11 w-full rounded-[var(--radius-boton)] border border-borde bg-surface px-3 text-sm text-ink md:h-10";

export function Campo({ id, etiqueta, ayuda, className, children }: { id: string; etiqueta: string; ayuda?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{etiqueta} {ayuda && <span className="font-normal text-ink-muted">· {ayuda}</span>}</Label>
      {children}
    </div>
  );
}

export function CampoTexto({ id, etiqueta, ayuda, valor, tipo = "text", className, ...resto }:
  { id: string; etiqueta: string; ayuda?: string; valor?: string | number | null; tipo?: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Campo id={id} etiqueta={etiqueta} ayuda={ayuda} className={className}>
      <Input id={id} name={id} type={tipo} defaultValue={valor ?? ""} autoComplete="off" {...resto} />
    </Campo>
  );
}

export function Casilla({ id, etiqueta, marcada }: { id: string; etiqueta: string; marcada?: boolean }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
      <input type="checkbox" id={id} name={id} value="si" defaultChecked={marcada} className="size-5" />
      {etiqueta}
    </label>
  );
}

export function Seleccion({ id, etiqueta, ayuda, valor, opciones, vacia }:
  { id: string; etiqueta: string; ayuda?: string; valor?: string | null; opciones: readonly (readonly [string, string])[]; vacia?: string }) {
  return (
    <Campo id={id} etiqueta={etiqueta} ayuda={ayuda}>
      <select id={id} name={id} defaultValue={valor ?? ""} className={claseSelect}>
        {vacia !== undefined && <option value="">{vacia}</option>}
        {opciones.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </Campo>
  );
}

export function Dato({ titulo, valor }: { titulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{titulo}</dt>
      <dd className="mt-0.5 text-ink">{valor}</dd>
    </div>
  );
}

export const isoODefecto = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
export const numero = (d: { toString(): string } | null | undefined) => (d === null || d === undefined ? "" : d.toString());
