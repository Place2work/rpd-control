"use client";

// Tablero por etapas (10.3). En computadora se arrastra una tarjeta a otra columna; el servidor
// valida la transición con las mismas reglas del expediente. Si pide motivo, se pregunta aquí; si
// pide datos (fecha de firma, acuse…), se explica qué falta y se ofrece abrir el caso.
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { moverCaso } from "./acciones-tablero";

export type Tarjeta = { id: string; folio: string; nombre: string; etapa: string; diasEtapa: number; dia46: { texto: string; tono: "pagado" | "espera" | "critico" } | null; servicio: string | null };
export type Columna = { clave: string; titulo: string; tono: "prospecto" | "tramite" | "espera" | "pagado" | "critico" | "perdido" };

type Pendiente = { tarjeta: Tarjeta; destino: Columna; faltantes: string[]; pideMotivo: boolean };
const MOTIVO = "Escribe el motivo (mínimo 5 caracteres)";

export function Tablero({ columnas, tarjetas }: { columnas: Columna[]; tarjetas: Tarjeta[] }) {
  const router = useRouter();
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [motivo, setMotivo] = useState("");
  const [moviendo, iniciar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  const intentar = (t: Tarjeta, destino: Columna, conMotivo: string | null) => iniciar(async () => {
    setAviso(null);
    const r = await moverCaso(t.id, destino.clave, conMotivo);
    if (r.ok) { setPendiente(null); setMotivo(""); setAviso(`${t.folio} pasó a «${destino.titulo}».`); router.refresh(); return; }
    const faltantes = r.faltantes ?? (r.error ? [r.error] : r.errores ? Object.values(r.errores) : []);
    setPendiente({ tarjeta: t, destino, faltantes: faltantes.filter((f) => f !== MOTIVO), pideMotivo: faltantes.includes(MOTIVO) });
  });

  return (
    <>
      {aviso && <p role="status" className="mb-3 rounded-[var(--radius-boton)] bg-exito-tint px-3 py-2 text-sm text-exito-texto">{aviso}</p>}
      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        <div className="flex gap-3" role="list" aria-label="Etapas">
          {columnas.map((col) => {
            const lista = tarjetas.filter((c) => c.etapa === col.clave);
            return (
              <section key={col.clave} role="listitem" aria-label={col.titulo}
                onDragOver={(e) => { if (arrastrando) { e.preventDefault(); setSobre(col.clave); } }}
                onDragLeave={() => setSobre((s) => (s === col.clave ? null : s))}
                onDrop={(e) => {
                  e.preventDefault(); setSobre(null);
                  const t = tarjetas.find((x) => x.id === e.dataTransfer.getData("text/plain"));
                  if (t && t.etapa !== col.clave) intentar(t, col, null);
                }}
                className={cn("flex w-72 shrink-0 flex-col rounded-[var(--radius-tarjeta)] bg-slate-100/70 p-3 transition-colors", sobre === col.clave && "bg-brand-tint ring-2 ring-brand")}>
                <div className="mb-3 flex items-center justify-between">
                  <Badge tono={col.tono}>{col.titulo}</Badge>
                  <span className="cifra text-xs text-ink-muted">{lista.length}</span>
                </div>
                {lista.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-borde px-3 py-6 text-center text-xs text-ink-muted">Sin casos</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {lista.map((c) => (
                      <li key={c.id} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); e.dataTransfer.effectAllowed = "move"; setArrastrando(c.id); }}
                        onDragEnd={() => setArrastrando(null)} className={cn("cursor-grab active:cursor-grabbing", arrastrando === c.id && "opacity-50")}>
                        <Link href={`/casos/${c.id}`} draggable={false} className="block rounded-lg border border-borde bg-surface p-3 shadow-[var(--shadow-tarjeta)] hover:border-brand">
                          <p className="truncate text-sm font-medium text-ink">{c.nombre}</p>
                          <p className="text-xs text-ink-muted">
                            <span className="cifra">{c.folio}</span>{c.servicio ? ` · ${c.servicio}` : ""} · {c.diasEtapa === 0 ? "hoy en esta etapa" : `${c.diasEtapa} ${c.diasEtapa === 1 ? "día" : "días"} en la etapa`}
                          </p>
                          {c.dia46 && <span className="mt-2 inline-block"><Badge tono={c.dia46.tono}>{c.dia46.texto}</Badge></span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-muted">Arrastra una tarjeta a otra columna para cambiar la etapa (en computadora). En el celular, ábrelo y usa «Siguiente paso».</p>

      {pendiente && (
        <div role="dialog" aria-modal="true" aria-labelledby="titulo-mover" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onKeyDown={(e) => { if (e.key === "Escape") setPendiente(null); }}>
          <div className="w-full max-w-md rounded-[var(--radius-tarjeta)] bg-surface p-5 shadow-xl">
            <h2 id="titulo-mover" className="font-display text-lg font-semibold text-ink">{pendiente.tarjeta.folio} → {pendiente.destino.titulo}</h2>
            {pendiente.faltantes.length > 0 ? (
              <>
                <p className="mt-2 text-sm text-ink">Todavía no se puede mover:</p>
                <ul className="mt-1 list-disc pl-5 text-sm text-ink-muted">{pendiente.faltantes.map((f) => <li key={f}>{f}</li>)}</ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  {/* Un salto que la máquina de etapas no permite no se arregla capturando datos. */}
                  {!pendiente.faltantes.some((f) => f.startsWith("No se puede pasar")) && (
                    <Button asChild><Link href={`/casos/${pendiente.tarjeta.id}?tab=resumen`}>Abrir el caso para completarlo</Link></Button>
                  )}
                  <Button type="button" variant="secundario" onClick={() => setPendiente(null)}>Cerrar</Button>
                </div>
              </>
            ) : (
              <form className="mt-3 grid gap-3" onSubmit={(e) => { e.preventDefault(); intentar(pendiente.tarjeta, pendiente.destino, motivo); }}>
                <div className="grid gap-1.5">
                  <Label htmlFor="motivo-mover">Motivo</Label>
                  <Input id="motivo-mover" autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por qué se mueve el caso" />
                  {pendiente.pideMotivo && motivo.trim().length > 0 && motivo.trim().length < 5 && <p className="text-xs text-critico">Mínimo 5 caracteres</p>}
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={moviendo || motivo.trim().length < 5}>{moviendo ? "Moviendo…" : "Mover"}</Button>
                  <Button type="button" variant="secundario" onClick={() => setPendiente(null)}>Cancelar</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
