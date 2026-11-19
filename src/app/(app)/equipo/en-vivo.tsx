"use client";

// Pantalla del equipo en vivo: oficina 3D + contadores del día + registro de lo que va pasando. Se refresca sola.
import dynamic from "next/dynamic";
import { Pause, Play, RotateCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NOMBRE_DEPARTAMENTO, renglon, resumenPorPersona, type Departamento } from "@/lib/equipo/actividad";
import type { FotoEquipo } from "@/lib/equipo/datos";
import { refrescarEquipo } from "./acciones";
import type { PersonaVista } from "./oficina";

const Oficina3D = dynamic(() => import("./oficina").then((m) => m.Oficina3D), {
  ssr: false,
  loading: () => <div className="flex h-[62vh] min-h-[380px] items-center justify-center rounded-[var(--radius-tarjeta)] border border-borde bg-sky-50 text-sm text-ink-muted">Armando la oficina…</div>,
});

const CADA_MS = 20_000;
const COLOR: Record<Departamento, string> = { direccion: "#004AAD", analisis: "#7C3AED", asesores: "#5E9E3A", vendedores: "#D97706", calle: "#6B7280" };
const hora = (iso: string) => new Intl.DateTimeFormat("es-MX", { timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date(iso));

export function EquipoEnVivo({ inicial }: { inicial: FotoEquipo }) {
  const [foto, setFoto] = useState(inicial);
  const [enVivo, setEnVivo] = useState(true);
  const [giro, setGiro] = useState(false);

  useEffect(() => {
    if (!enVivo) return;
    const id = setInterval(() => { refrescarEquipo().then((f) => f && setFoto(f)).catch(() => undefined); }, CADA_MS);
    return () => clearInterval(id);
  }, [enVivo]);

  const resumen = useMemo(() => resumenPorPersona(foto.actividades), [foto.actividades]);
  const personas: PersonaVista[] = useMemo(() => foto.personas.map((p) => ({ ...p, resumen: resumen.get(p.id) ?? null })), [foto.personas, resumen]);
  const nombre = useMemo(() => new Map(foto.personas.map((p) => [p.id, p.nombre])), [foto.personas]);
  const total = (k: "prospectos" | "verificados" | "avances" | "cierres") => [...resumen.values()].reduce((a, r) => a + r[k], 0);
  const activos = [...resumen.keys()].filter((id) => nombre.has(id)).length;
  const porDepto = (Object.keys(NOMBRE_DEPARTAMENTO) as Departamento[]).map((d) => ({ d, n: foto.personas.filter((p) => p.departamento === d && p.conCuenta).length,
    sin: foto.personas.filter((p) => p.departamento === d && !p.conCuenta).length }));

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[["Activos hoy", `${activos} de ${foto.personas.filter((p) => p.conCuenta).length}`], ["Prospectos hoy", total("prospectos")], ["Verificados hoy", total("verificados")],
          ["Casos que avanzaron", total("avances")], ["Honorarios cobrados", total("cierres")]].map(([t, v]) => (
          <div key={String(t)} className="rounded-[var(--radius-tarjeta)] border border-borde bg-surface p-3">
            <p className="text-xs text-ink-muted">{t}</p><p className="font-display text-2xl font-semibold text-ink">{v}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Oficina3D personas={personas} actividades={foto.actividades} autoGiro={giro} premio={foto.premio} />
        <div className="absolute right-3 top-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setEnVivo((v) => !v)} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-boton)] bg-surface/90 px-3 text-sm font-medium text-ink shadow">
            {enVivo ? <><span className="size-2 animate-pulse rounded-full bg-critico" aria-hidden /> En vivo <Pause className="size-4" aria-hidden /></> : <>Pausado <Play className="size-4" aria-hidden /></>}
          </button>
          <button type="button" onClick={() => setGiro((g) => !g)} aria-pressed={giro} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-boton)] bg-surface/90 px-3 text-sm font-medium text-ink shadow">
            <RotateCw className="size-4" aria-hidden /> {giro ? "Detener giro" : "Vista automática"}
          </button>
        </div>
        <p className="pointer-events-none absolute bottom-3 left-3 rounded-[var(--radius-boton)] bg-surface/85 px-2 py-1 text-xs text-ink-muted">Arrastra para girar · rueda o pellizco para acercar · actualizado {hora(foto.hora)}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <section className="rounded-[var(--radius-tarjeta)] border border-borde bg-surface p-4">
          <h2 className="font-display text-base font-semibold text-ink">Departamentos</h2>
          <ul className="mt-2 grid gap-2 text-sm">
            {porDepto.map(({ d, n, sin }) => (
              <li key={d} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><span className="size-3 rounded-sm" style={{ background: COLOR[d] }} aria-hidden />{NOMBRE_DEPARTAMENTO[d]}</span>
                <span className="text-ink-muted">{n === 0 && sin === 0 ? "puesto vacante" : `${n}${sin ? ` + ${sin} sin cuenta` : ""}`}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-[var(--radius-tarjeta)] border border-borde bg-surface p-4">
          <h2 className="font-display text-base font-semibold text-ink">Lo que va pasando hoy</h2>
          {foto.actividades.length === 0 ? <p className="mt-2 text-sm text-ink-muted">Todavía no hay movimiento hoy. Cuando alguien registre, verifique o avance un caso, aparece aquí y en la oficina.</p> : (
            <ul className="mt-2 max-h-72 divide-y divide-borde overflow-y-auto text-sm">
              {foto.actividades.slice(0, 60).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-ink">{renglon(a, nombre.get(a.usuarioId) ?? "Alguien")}</span>
                  <span className="shrink-0 text-xs text-ink-muted">{hora(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
