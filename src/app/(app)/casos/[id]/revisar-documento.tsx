"use client";

import { Check, Eye, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { revisarDocumento, verDocumento } from "./acciones-documentos";

const boton = "inline-flex h-11 items-center gap-1 rounded-[var(--radius-boton)] px-2.5 text-sm font-medium md:h-9";

export function RevisarDocumento({ casoId, documentoId, puedeValidar }: { casoId: string; documentoId: string; puedeValidar: boolean }) {
  const router = useRouter();
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const decidir = (d: "validado" | "rechazado") => iniciar(async () => {
    const r = await revisarDocumento(casoId, documentoId, d, d === "rechazado" ? motivo : null);
    if (r.error) return setError(r.error);
    setError(null); setRechazando(false); router.refresh();
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        <button type="button" className={`${boton} text-ink hover:bg-brand-tint`} disabled={pendiente}
          onClick={() => iniciar(async () => {
            const r = await verDocumento(documentoId);
            if (r.url) window.open(r.url, "_blank", "noopener"); else setError(r.error ?? "No disponible");
          })}>
          <Eye className="size-4" aria-hidden /> Ver
        </button>
        {puedeValidar && (
          <>
            <button type="button" className={`${boton} text-exito-texto hover:bg-exito-tint`} disabled={pendiente} onClick={() => decidir("validado")}>
              <Check className="size-4" aria-hidden /> Validar
            </button>
            <button type="button" className={`${boton} text-critico hover:bg-critico-tint`} disabled={pendiente} onClick={() => setRechazando(!rechazando)}>
              <X className="size-4" aria-hidden /> Rechazar
            </button>
          </>
        )}
      </div>
      {rechazando && (
        <div className="flex flex-wrap gap-2">
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo: borrosa, recortada, vencida…" aria-label="Motivo del rechazo"
            className="h-11 min-w-0 flex-1 rounded-[var(--radius-boton)] border border-borde bg-surface px-3 text-sm md:h-9" />
          <button type="button" className={`${boton} bg-critico text-white`} disabled={pendiente} onClick={() => decidir("rechazado")}>Rechazar</button>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-critico">{error}</p>}
    </div>
  );
}
