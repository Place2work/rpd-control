import { Trophy } from "lucide-react";
import type { Progreso } from "@/lib/reglas/premios";

/** Tarjeta del premio para el asesor: cuánto lleva y cuánto le falta (honorario cobrado = cliente que cuenta). */
export function TarjetaPremio({ nombre, descripcion, meta, progreso }: { nombre: string; descripcion: string | null; meta: number; progreso: Progreso }) {
  return (
    <section aria-label={`Premio: ${nombre}`} className="mb-4 rounded-[var(--radius-tarjeta)] border border-exito/40 bg-exito-tint p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-display text-lg font-semibold text-ink"><Trophy className="size-5 text-exito-texto" aria-hidden /> Premio: {nombre}</p>
        <p className="font-display text-2xl font-semibold text-exito-texto">{progreso.logrados} <span className="text-base text-ink-muted">de {meta}</span></p>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuemin={0} aria-valuemax={meta} aria-valuenow={progreso.logrados}>
        <div className="h-full rounded-full bg-exito" style={{ width: `${progreso.pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-ink">
        {progreso.ganado ? "¡Lo lograste! Ya ganaste el premio; el Director te contacta para entregártelo."
          : `Te ${progreso.faltan === 1 ? "falta 1 cliente" : `faltan ${progreso.faltan} clientes`} de retiro con honorario cobrado.`}
      </p>
      {descripcion && <p className="mt-1 text-xs text-ink-muted">{descripcion}</p>}
    </section>
  );
}
