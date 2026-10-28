"use client";

import { Copy, Link2, Unlink } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { generarLigaCalendario, revocarLigaCalendario } from "./acciones";

// La liga se muestra una sola vez (en la base solo queda su huella). Quien la tenga ve tus fechas.
export function LigaCalendario({ activa }: { activa: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [hay, setHay] = useState(activa);
  const [copiada, setCopiada] = useState(false);
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="grid gap-3 text-sm">
      {url ? (
        <>
          <p className="text-ink">Copia esta liga ahora; por seguridad no se vuelve a mostrar:</p>
          <div className="flex gap-2">
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Liga privada del calendario"
              className="h-10 min-w-0 flex-1 rounded-[var(--radius-boton)] border border-borde bg-surface px-3 text-xs text-ink" />
            <Button type="button" variant="secundario" onClick={() => { navigator.clipboard.writeText(url); setCopiada(true); }}>
              <Copy aria-hidden /> {copiada ? "Copiada" : "Copiar"}
            </Button>
          </div>
          <ol className="list-decimal pl-5 text-ink-muted">
            <li>En Google Calendar (computadora): «Otros calendarios» → «+» → «Desde URL».</li>
            <li>Pega la liga y elige «Agregar calendario». Google la actualiza cada pocas horas.</li>
          </ol>
        </>
      ) : (
        <p className="text-ink-muted">{hay ? "Tienes una liga activa. Si la perdiste o la compartiste por error, genera otra: la anterior deja de funcionar." : "Genera una liga privada para ver estas fechas en Google Calendar o en el calendario de tu celular."}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pendiente} onClick={() => iniciar(async () => { const r = await generarLigaCalendario(); if (r.url) { setUrl(r.url); setHay(true); setCopiada(false); } })}>
          <Link2 aria-hidden /> {hay ? "Generar liga nueva" : "Generar liga"}
        </Button>
        {hay && (
          <Button type="button" variant="fantasma" disabled={pendiente} onClick={() => iniciar(async () => { await revocarLigaCalendario(); setHay(false); setUrl(null); })}>
            <Unlink aria-hidden /> Desactivar
          </Button>
        )}
      </div>
    </div>
  );
}
