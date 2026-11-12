"use client";

// Evaluación (quiz de módulo o examen de ruta): una pregunta por pantalla, sin regresar; al final la
// calificación y la explicación de cada error, con las críticas falladas resaltadas (CAPACITACION.md 12.1).
import { AlertTriangle, Award, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { PreguntaServida } from "@/lib/academia/tipos";
import type { ResultadoEvaluacion } from "@/lib/academia/motor";
import { cn } from "@/lib/utils";
import { comenzarEvaluacion, enviarEvaluacion } from "../acciones";

type Props = { tipo: "quiz_modulo" | "examen_ruta" | "recertificacion" | "actualizacion"; objetivo: string; titulo: string; volver: string };

export function Evaluacion({ tipo, objetivo, titulo, volver }: Props) {
  const [intento, setIntento] = useState<{ id: string; preguntas: PreguntaServida[]; minimo: number } | null>(null);
  const [i, setI] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, number | null>>({});
  const [numero, setNumero] = useState("");
  const [resultado, setResultado] = useState<ResultadoEvaluacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, iniciar] = useTransition();

  const comenzar = () => iniciar(async () => {
    setError(null);
    const r = await comenzarEvaluacion(tipo, objetivo);
    if (r.error || !r.intentoId || !r.preguntas) return setError(r.error ?? "No se pudo abrir la evaluación.");
    setIntento({ id: r.intentoId, preguntas: r.preguntas, minimo: r.minimo ?? 0.8 });
  });

  if (resultado) return <Resultado r={resultado} volver={volver} />;

  if (!intento) {
    return (
      <div className="grid gap-3 rounded-[var(--radius-tarjeta)] border border-borde bg-surface p-5 text-sm">
        <p className="font-medium text-ink">{titulo}</p>
        <ul className="list-disc pl-5 text-ink-muted">
          <li>Una pregunta por pantalla; no se puede regresar.</li>
          <li>Las preguntas marcadas como <strong className="text-critico">críticas</strong> deben ir todas bien para aprobar.</li>
          {tipo === "examen_ruta" || tipo === "recertificacion" ? <li>Tienes 3 intentos; después del tercero sin aprobar, esperas 7 días y repasas con el Director.</li>
            : <li>Puedes repetirlo cuantas veces quieras (con una hora entre intentos si no apruebas).</li>}
        </ul>
        {error && <p role="alert" className="text-critico">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={comenzar} disabled={cargando}
            className="inline-flex h-11 items-center rounded-[var(--radius-boton)] bg-brand px-5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">
            {cargando ? "Abriendo…" : "Comenzar"}
          </button>
          <Link href={volver} className="inline-flex h-11 items-center px-3 text-sm text-ink-muted hover:text-ink">Ahora no</Link>
        </div>
      </div>
    );
  }

  const p = intento.preguntas[i];
  const ultima = i === intento.preguntas.length - 1;
  const valor = respuestas[p.clave];
  const contestada = p.tipo === "numerica" ? numero.trim() !== "" && Number.isFinite(Number(numero.replace(/[,$\s]/g, ""))) : valor !== undefined && valor !== null;
  const avanzar = () => {
    const nuevas = p.tipo === "numerica" ? { ...respuestas, [p.clave]: Number(numero.replace(/[,$\s]/g, "")) } : respuestas;
    setRespuestas(nuevas);
    setNumero("");
    if (!ultima) return setI(i + 1);
    iniciar(async () => {
      const r = await enviarEvaluacion(intento.id, nuevas);
      if (r.error) return setError(r.error);
      setResultado(r);
    });
  };

  return (
    <div className="grid gap-4 rounded-[var(--radius-tarjeta)] border border-borde bg-surface p-5">
      <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
        <span className="cifra">Pregunta {i + 1} de {intento.preguntas.length}</span>
        {p.critica && <span className="rounded-full bg-critico-tint px-2 py-0.5 font-semibold text-critico">Crítica</span>}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand" style={{ width: `${(i / intento.preguntas.length) * 100}%` }} /></div>
      <p className="text-base font-medium leading-relaxed text-ink">{p.enunciado}</p>
      {p.tipo === "numerica" ? (
        <label className="grid gap-1.5 text-sm text-ink">
          Tu respuesta (solo el número)
          <input type="text" inputMode="decimal" value={numero} onChange={(e) => setNumero(e.target.value)} autoFocus
            className="h-11 rounded-[var(--radius-boton)] border border-borde bg-surface px-3 font-mono text-base" />
        </label>
      ) : (
        <fieldset className="grid gap-2">
          <legend className="sr-only">Opciones</legend>
          {p.opciones.map((o, k) => (
            <label key={k} className={cn("flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-boton)] border px-3 py-2.5 text-sm",
              valor === k ? "border-brand bg-brand-tint text-ink" : "border-borde text-ink hover:bg-slate-50")}>
              <input type="radio" name={p.clave} checked={valor === k} onChange={() => setRespuestas({ ...respuestas, [p.clave]: k })} className="mt-0.5 size-4 shrink-0" />
              <span>{o}</span>
            </label>
          ))}
        </fieldset>
      )}
      {error && <p role="alert" className="text-sm text-critico">{error}</p>}
      <button type="button" onClick={avanzar} disabled={!contestada || cargando}
        className="inline-flex h-11 w-fit items-center rounded-[var(--radius-boton)] bg-brand px-5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">
        {cargando ? "Calificando…" : ultima ? "Terminar y calificar" : "Siguiente"}
      </button>
    </div>
  );
}

function Resultado({ r, volver }: { r: ResultadoEvaluacion; volver: string }) {
  const errores = (r.revision ?? []).filter((x) => !x.correcta);
  return (
    <div className="grid gap-4">
      <div className={cn("grid gap-2 rounded-[var(--radius-tarjeta)] border p-5", r.aprobado ? "border-exito/40 bg-exito-tint" : "border-critico/30 bg-critico-tint")}>
        <p className={cn("flex items-center gap-2 font-display text-xl font-semibold", r.aprobado ? "text-exito-texto" : "text-critico")}>
          {r.aprobado ? <CheckCircle2 className="size-6" aria-hidden /> : <XCircle className="size-6" aria-hidden />}
          {r.aprobado ? "¡Aprobado!" : "No aprobado"} · <span className="cifra">{Math.round((r.calificacion ?? 0) * 100)}%</span>
        </p>
        <p className="text-sm text-ink">{r.aciertos} de {r.total} correctas · mínimo {Math.round((r.minimo ?? 0) * 100)}%{r.criticasOk ? " · todas las críticas bien" : ""}.</p>
        {!r.criticasOk && <p className="flex items-center gap-1.5 text-sm font-medium text-critico"><AlertTriangle className="size-4" aria-hidden /> Fallaste al menos una pregunta crítica: no se aprueba aunque el total pase del mínimo.</p>}
        {r.mensaje && <p className="font-medium text-exito-texto">{r.mensaje}</p>}
        {r.certificaciones?.map((c) => (
          <p key={c} className="flex items-center gap-1.5 text-sm font-semibold text-exito-texto"><Award className="size-5" aria-hidden /> ¡Certificación {c} otorgada!</p>
        ))}
      </div>
      {errores.length > 0 && (
        <div className="grid gap-3">
          <p className="text-sm font-medium text-ink">Repasa tus errores</p>
          {errores.map((x) => (
            <div key={x.clave} className={cn("grid gap-1 rounded-[var(--radius-boton)] border p-3 text-sm", x.critica ? "border-critico/50 bg-critico-tint/50" : "border-borde bg-surface")}>
              <p className="font-medium text-ink">{x.critica && <span className="mr-1.5 rounded-full bg-critico px-1.5 py-0.5 text-[11px] font-semibold text-white">Crítica</span>}{x.enunciado}</p>
              <p className="text-critico">Tu respuesta: {x.tuRespuesta}</p>
              <p className="text-exito-texto">Correcta: {x.respuestaCorrecta}</p>
              {x.explicacion && <p className="text-ink-muted">Por qué: {x.explicacion}</p>}
            </div>
          ))}
        </div>
      )}
      <Link href={volver} className="inline-flex h-11 w-fit items-center rounded-[var(--radius-boton)] border border-brand px-4 text-sm font-medium text-brand hover:bg-brand-tint">Regresar</Link>
    </div>
  );
}
