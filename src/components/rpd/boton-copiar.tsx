"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** Copia un texto al portapapeles (para pegarlo en portales oficiales sin errores de captura). */
export function BotonCopiar({ texto, etiqueta = "Copiar" }: { texto: string; etiqueta?: string }) {
  const [listo, setListo] = useState(false);
  return (
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(texto); setListo(true); setTimeout(() => setListo(false), 1500); } catch { /* sin permiso */ } }}
      className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-xs font-medium text-brand hover:bg-brand-tint" aria-label={`${etiqueta}: ${texto}`}>
      {listo ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />} {listo ? "Copiado" : etiqueta}
    </button>
  );
}
