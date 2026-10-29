"use client";

// Vista de tabla (10.3): búsqueda, filtros y orden en el navegador sobre los casos que RLS ya dejó ver.
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import type { Columna } from "./tablero";

export type FilaCaso = { id: string; folio: string; nombre: string; servicio: string; etapa: string; diasEtapa: number; asignado: string; vendedor: string; alta: string };
type Orden = "diasEtapa" | "folio" | "nombre" | "alta";

const select = "h-11 w-full rounded-[var(--radius-boton)] border border-borde bg-surface px-3 text-sm text-ink md:h-10";

export function TablaCasos({ filas, columnas }: { filas: FilaCaso[]; columnas: Columna[] }) {
  const [q, setQ] = useState("");
  const [etapa, setEtapa] = useState("");
  const [servicio, setServicio] = useState("");
  const [asignado, setAsignado] = useState("");
  const [orden, setOrden] = useState<{ campo: Orden; desc: boolean }>({ campo: "diasEtapa", desc: true });

  const servicios = useMemo(() => [...new Set(filas.map((f) => f.servicio))].sort(), [filas]);
  const asignados = useMemo(() => [...new Set(filas.map((f) => f.asignado))].sort(), [filas]);
  const columna = (clave: string) => columnas.find((c) => c.clave === clave);

  const vista = useMemo(() => {
    const t = q.trim().toLowerCase();
    const r = filas.filter((f) => (!t || f.nombre.toLowerCase().includes(t) || f.folio.toLowerCase().includes(t))
      && (!etapa || f.etapa === etapa) && (!servicio || f.servicio === servicio) && (!asignado || f.asignado === asignado));
    const s = orden.desc ? -1 : 1;
    return r.sort((a, b) => (a[orden.campo] < b[orden.campo] ? -s : a[orden.campo] > b[orden.campo] ? s : 0));
  }, [filas, q, etapa, servicio, asignado, orden]);

  const encabezado = (campo: Orden, texto: string) => (
    <th scope="col" aria-sort={orden.campo === campo ? (orden.desc ? "descending" : "ascending") : undefined} className="px-3 py-2 font-medium">
      <button type="button" className="hover:text-ink" onClick={() => setOrden((o) => ({ campo, desc: o.campo === campo ? !o.desc : campo === "diasEtapa" }))}>
        {texto}{orden.campo === campo ? (orden.desc ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-1.5"><Label htmlFor="t-q">Buscar</Label><Input id="t-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o folio" /></div>
        <div className="grid gap-1.5"><Label htmlFor="t-etapa">Etapa</Label>
          <select id="t-etapa" className={select} value={etapa} onChange={(e) => setEtapa(e.target.value)}>
            <option value="">Todas</option>{columnas.map((c) => <option key={c.clave} value={c.clave}>{c.titulo}</option>)}
          </select></div>
        <div className="grid gap-1.5"><Label htmlFor="t-servicio">Servicio</Label>
          <select id="t-servicio" className={select} value={servicio} onChange={(e) => setServicio(e.target.value)}>
            <option value="">Todos</option>{servicios.map((s) => <option key={s}>{s}</option>)}
          </select></div>
        <div className="grid gap-1.5"><Label htmlFor="t-asignado">Asignado a</Label>
          <select id="t-asignado" className={select} value={asignado} onChange={(e) => setAsignado(e.target.value)}>
            <option value="">Todos</option>{asignados.map((s) => <option key={s}>{s}</option>)}
          </select></div>
      </div>
      <p className="text-xs text-ink-muted" aria-live="polite">{vista.length} de {filas.length} {filas.length === 1 ? "caso" : "casos"}</p>
      <div className="overflow-x-auto rounded-[var(--radius-tarjeta)] border border-borde bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-borde text-xs text-ink-muted">
            <tr>{encabezado("folio", "Folio")}{encabezado("nombre", "Cliente")}<th scope="col" className="px-3 py-2 font-medium">Servicio</th>
              <th scope="col" className="px-3 py-2 font-medium">Etapa</th>{encabezado("diasEtapa", "Días en etapa")}
              <th scope="col" className="px-3 py-2 font-medium">Asignado</th><th scope="col" className="px-3 py-2 font-medium">Vendedor</th>{encabezado("alta", "Alta")}</tr>
          </thead>
          <tbody>
            {vista.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-ink-muted">Ningún caso coincide con los filtros.</td></tr>
            ) : vista.map((f) => {
              const c = columna(f.etapa);
              return (
                <tr key={f.id} className="border-b border-borde last:border-0 hover:bg-slate-50">
                  <td className="cifra px-3 py-2"><Link href={`/casos/${f.id}`} className="text-brand hover:underline">{f.folio}</Link></td>
                  <td className="px-3 py-2 text-ink">{f.nombre}</td>
                  <td className="px-3 py-2 text-ink-muted">{f.servicio}</td>
                  <td className="px-3 py-2"><Badge tono={c?.tono ?? "prospecto"}>{c?.titulo ?? f.etapa}</Badge></td>
                  <td className="cifra px-3 py-2">{f.diasEtapa}</td>
                  <td className="px-3 py-2 text-ink-muted">{f.asignado}</td>
                  <td className="px-3 py-2 text-ink-muted">{f.vendedor}</td>
                  <td className="cifra px-3 py-2 text-ink-muted">{f.alta}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
