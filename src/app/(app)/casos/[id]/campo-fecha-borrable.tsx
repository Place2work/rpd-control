"use client";

// Campo de fecha con botón «Borrar»: vacía la fecha y guarda el formulario en un clic
// (en el navegador, borrar una fecha a mano es difícil y queda «01/01/0001»).
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Campo } from "./campos";

export function CampoFechaBorrable({ id, etiqueta, ayuda, valor, min, max, confirmar }:
  { id: string; etiqueta: string; ayuda?: string; valor: string | null; min?: string; max?: string; confirmar: string }) {
  return (
    <Campo id={id} etiqueta={etiqueta} ayuda={ayuda}>
      <div className="flex gap-2">
        <Input id={id} name={id} type="date" defaultValue={valor ?? ""} min={min} max={max} autoComplete="off" className="flex-1" />
        {valor && (
          <button type="button" title={`Borrar ${etiqueta.toLowerCase()}`}
            onClick={() => {
              const input = document.getElementById(id) as HTMLInputElement | null;
              if (!input || !window.confirm(confirmar)) return;
              input.value = "";
              input.form?.requestSubmit();
            }}
            className="inline-flex h-11 shrink-0 items-center gap-1 rounded-[var(--radius-boton)] border border-borde px-3 text-sm text-critico hover:bg-critico-tint md:h-10">
            <X className="size-4" aria-hidden /> Borrar
          </button>
        )}
      </div>
    </Campo>
  );
}
