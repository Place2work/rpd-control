"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { agregarNota } from "./acciones";

const TIPOS = [["nota", "Nota"], ["llamada", "Llamada"], ["whatsapp", "WhatsApp"], ["correo", "Correo"]] as const;

export function NotaRapida({ casoId }: { casoId: string }) {
  const [estado, accion, enviando] = useActionState(agregarNota.bind(null, casoId), {});
  return (
    <form action={accion} className="flex flex-col gap-2">
      <label htmlFor="texto" className="sr-only">Nota</label>
      <textarea id="texto" name="texto" rows={3} placeholder="¿Qué pasó? Ej.: Le marqué, manda su constancia mañana."
        className="w-full rounded-[var(--radius-boton)] border border-borde bg-surface p-3 text-sm" />
      <div className="flex flex-wrap items-center gap-2">
        <select name="tipo" aria-label="Tipo de contacto" defaultValue="nota"
          className="h-11 rounded-[var(--radius-boton)] border border-borde bg-surface px-3 text-sm md:h-10">
          {TIPOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        <Button type="submit" disabled={enviando}>{enviando ? "Guardando…" : "Guardar"}</Button>
        {estado.error && <p role="alert" className="text-sm text-critico">{estado.error}</p>}
      </div>
    </form>
  );
}
