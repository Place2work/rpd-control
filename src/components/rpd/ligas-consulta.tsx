"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { LigasConsulta as Ligas } from "@/lib/parametros";

// Ligas oficiales para consultar CURP, NSS y semanas. Los portales del gobierno no aceptan
// datos por la URL, así que se ofrece copiar el dato y abrir el portal en otra pestaña.
// Las direcciones son parámetros editables (LIGA_CONSULTA_*).
export function LigasConsulta({ ligas, curp, nss }: { ligas: Ligas; curp?: string; nss?: string }) {
  const filas = [
    { clave: "curp", titulo: "Consultar CURP", fuente: "RENAPO · gob.mx", url: ligas.curp, valor: curp },
    { clave: "nss", titulo: "Localizar o asignar NSS", fuente: "IMSS", url: ligas.nss, valor: nss },
    { clave: "semanas", titulo: "Constancia de semanas", fuente: "IMSS", url: ligas.semanas, valor: undefined },
  ];
  return (
    <ul className="divide-y divide-borde">
      {filas.map((f) => (
        <li key={f.clave} className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink">{f.titulo}</p>
            <p className="text-xs text-ink-muted">{f.fuente}</p>
          </div>
          {f.valor && <BotonCopiar valor={f.valor} etiqueta={f.clave.toUpperCase()} />}
          <a
            href={f.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-boton)] border border-brand px-3 text-sm font-medium text-brand hover:bg-brand-tint md:h-9"
          >
            Abrir <ExternalLink className="size-4" aria-hidden />
            <span className="sr-only">(se abre en otra pestaña)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function BotonCopiar({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(valor);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }}
      className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-boton)] px-3 text-sm text-ink hover:bg-brand-tint md:h-9"
    >
      {copiado ? <Check className="size-4 text-exito-texto" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {copiado ? "Copiado" : `Copiar ${etiqueta}`}
    </button>
  );
}
