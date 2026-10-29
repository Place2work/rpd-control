"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { Resultado } from "./acciones";

// Botón para acciones de un clic (activar, desactivar). Con `confirmar` pregunta antes.
export function BotonAccion({ accion, texto, confirmar, variante = "secundario" }:
  { accion: () => Promise<Resultado>; texto: string; confirmar?: string; variante?: "primario" | "secundario" | "fantasma" | "destructivo" }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button type="button" variant={variante} className="h-9 px-3 md:h-9" disabled={pendiente} onClick={() => {
        if (confirmar && !window.confirm(confirmar)) return;
        iniciar(async () => { const r = await accion(); setError(r.error ?? null); if (r.ok) router.refresh(); });
      }}>{pendiente ? "…" : texto}</Button>
      {error && <span role="alert" className="text-xs text-critico">{error}</span>}
    </span>
  );
}
