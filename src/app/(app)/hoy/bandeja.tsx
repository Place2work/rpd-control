"use client";

import { AlertTriangle, BellRing, Check, Clock, Info, MessageCircle, RefreshCw, Siren, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { atenderAlerta, descartarAlerta, posponerAlerta, revisarAlertasAhora } from "./acciones";

export type AlertaVista = { id: string; regla: string; severidad: "info" | "aviso" | "critica"; mensaje: string; casoId: string | null; whatsapp: string | null };

const SEVERIDAD = {
  critica: { icono: Siren, clase: "border-critico/30 bg-critico-tint/60", texto: "text-critico", etiqueta: "Crítica" },
  aviso: { icono: AlertTriangle, clase: "border-aviso/30 bg-aviso-tint/50", texto: "text-aviso", etiqueta: "Aviso" },
  info: { icono: Info, clase: "border-borde bg-surface", texto: "text-brand", etiqueta: "Info" },
} as const;
const boton = "inline-flex h-11 items-center gap-1 rounded-md px-2.5 text-xs font-medium hover:bg-white/70 md:h-8";

export function Bandeja({ alertas, esDirector }: { alertas: AlertaVista[]; esDirector: boolean }) {
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2 px-5 pb-5">
      {esDirector && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-ink-muted">Se revisan solas cada día a las 7:00 (CDMX).</p>
          <button type="button" disabled={pendiente} className="inline-flex h-11 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-brand hover:bg-brand-tint md:h-8"
            onClick={() => iniciar(async () => {
              const r = await revisarAlertasAhora();
              setAviso(r.error ?? (r.nuevas ? `${r.nuevas} alertas nuevas` : "Sin alertas nuevas"));
            })}>
            <RefreshCw className={cn("size-3.5", pendiente && "animate-spin")} aria-hidden /> Revisar ahora
          </button>
        </div>
      )}
      {aviso && <p role="status" className="text-xs text-ink-muted">{aviso}</p>}
      {alertas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-exito-tint text-exito-texto"><BellRing className="size-5" strokeWidth={1.5} aria-hidden /></span>
          <p className="font-display font-semibold text-ink">Todo al día</p>
          <p className="max-w-sm text-sm text-ink-muted">No tienes alertas pendientes. Cada día a las 7:00 se revisan las fechas de todos los casos.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {alertas.map((a) => <Fila key={a.id} a={a} />)}
        </ul>
      )}
    </div>
  );
}

function Fila({ a }: { a: AlertaVista }) {
  const s = SEVERIDAD[a.severidad];
  const [pendiente, iniciar] = useTransition();
  const [descartando, setDescartando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const correr = (f: () => Promise<{ error?: string }>) => iniciar(async () => { const r = await f(); setError(r.error ?? null); });

  return (
    <li className={cn("rounded-[var(--radius-boton)] border p-3", s.clase, pendiente && "opacity-60")}>
      <div className="flex gap-2">
        <s.icono className={cn("mt-0.5 size-4 shrink-0", s.texto)} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink"><span className={cn("font-medium", s.texto)}>{s.etiqueta}: </span>{a.mensaje}</p>
          <div className="mt-1 flex flex-wrap gap-0.5">
            {a.casoId && <Link href={`/casos/${a.casoId}`} className={cn(boton, "text-brand")}>Abrir caso</Link>}
            {a.whatsapp && (
              <a href={a.whatsapp} target="_blank" rel="noopener noreferrer" className={cn(boton, "text-brand")}>
                <MessageCircle className="size-3.5" aria-hidden /> WhatsApp
              </a>
            )}
            <button type="button" className={cn(boton, "text-exito-texto")} onClick={() => correr(() => atenderAlerta(a.id))}>
              <Check className="size-3.5" aria-hidden /> Atendida
            </button>
            {([1, 3, 7] as const).map((d) => (
              <button key={d} type="button" className={cn(boton, "text-ink-muted")} onClick={() => correr(() => posponerAlerta(a.id, d))}
                title={`Posponer ${d} ${d === 1 ? "día" : "días"}`}>
                <Clock className="size-3.5" aria-hidden /> {d} d
              </button>
            ))}
            <button type="button" className={cn(boton, "text-ink-muted")} onClick={() => setDescartando(!descartando)}>
              <X className="size-3.5" aria-hidden /> Descartar
            </button>
          </div>
          {descartando && (
            <div className="mt-2 flex gap-2">
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="¿Por qué se descarta?" aria-label="Motivo para descartar"
                className="h-11 min-w-0 flex-1 rounded-md border border-borde bg-surface px-3 text-sm md:h-9" />
              <button type="button" className="h-11 rounded-md bg-ink px-3 text-xs font-medium text-white md:h-9" onClick={() => correr(() => descartarAlerta(a.id, motivo))}>
                Descartar
              </button>
            </div>
          )}
          {error && <p role="alert" className="mt-1 text-xs text-critico">{error}</p>}
        </div>
      </div>
    </li>
  );
}
