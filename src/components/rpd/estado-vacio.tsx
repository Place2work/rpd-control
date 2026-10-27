import type { LucideIcon } from "lucide-react";

// Estados vacíos con una frase útil y la acción siguiente (11.3).
export function EstadoVacio({ icono: Icono, titulo, texto, children }: { icono: LucideIcon; titulo: string; texto: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-brand-tint text-brand">
        <Icono className="size-5" strokeWidth={1.5} aria-hidden />
      </span>
      <p className="font-display text-base font-semibold text-ink">{titulo}</p>
      <p className="max-w-sm text-sm text-ink-muted">{texto}</p>
      {children && <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
