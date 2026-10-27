"use client";

import { Eye } from "lucide-react";
import { useState, useTransition } from "react";
import { verIdentificador } from "./acciones";

// Muestra el dato enmascarado; "Ver completo" lo pide al servidor y queda en bitácora.
export function DatoSensible({ personaId, campo, enmascarado, puedeVer }: { personaId: string; campo: "curp" | "nss"; enmascarado: string | null; puedeVer: boolean }) {
  const [valor, setValor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  if (!enmascarado) return <span className="text-ink-muted">Sin capturar</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="font-mono">{valor ?? enmascarado}</span>
      {puedeVer && !valor && (
        <button type="button" disabled={pendiente}
          onClick={() => iniciar(async () => {
            const r = await verIdentificador(personaId, campo);
            if (r.valor) setValor(r.valor);
            else setError(r.error ?? "No disponible");
          })}
          className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-xs font-medium text-brand hover:bg-brand-tint">
          <Eye className="size-3.5" aria-hidden /> {pendiente ? "Abriendo…" : "Ver completo"}
        </button>
      )}
      {valor && <span className="text-xs text-ink-muted">Quedó registrado en la bitácora</span>}
      {error && <span className="text-xs text-critico">{error}</span>}
    </span>
  );
}
