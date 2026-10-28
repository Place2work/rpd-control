"use client";

// Asistente de precalificación en 4 pasos (10.4): situación laboral → cuenta y semanas →
// salarios y saldos → resultado. Guarda con las mismas acciones de «IMSS y Afore» (mismas
// validaciones: régimen por la primera alta, bimestres calculados, semanas totales…); por eso
// cada paso envía todos los valores, no solo los que se ven.
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { guardarAfore, guardarImss, type Resultado } from "./acciones";
import { BotonCalcular } from "./boton-calcular";

export type Valores = Record<string, string | boolean>;
type Campo = { id: string; etiqueta: string; tipo?: "date" | "decimal" | "texto" | "casilla" | "seleccion"; ayuda?: string; opciones?: readonly (readonly [string, string])[] };

const IMSS = ["regimen", "regimen_justificacion", "fecha_primera_alta", "fecha_constancia", "fecha_baja", "semanas_cotizadas", "semanas_descontadas",
  "semanas_reintegradas", "bimestres_cotizados", "sbc_ultimo", "sbc_promedio_250", "ultimo_patron", "cotiza_actualmente"];
const AFORE = ["afore", "tipo_cuenta", "fecha_apertura_cuenta", "fecha_estado_cuenta", "saldo_rcv", "saldo_sar92", "saldo_vivienda", "saldo_voluntarias",
  "estado_ultimo_retiro", "fecha_ultimo_retiro", "ide_vigente", "banco", "cuenta_nivel4", "cuenta_solo_digital"];

export function AsistenteCalculo({ casoId, inicial, afores, hoy, modalidad }:
  { casoId: string; inicial: Valores; afores: readonly (readonly [string, string])[]; hoy: string; modalidad: "A" | "B" | null }) {
  const PASOS: { titulo: string; campos: Campo[] }[] = [
    { titulo: "Situación laboral", campos: [
      { id: "fecha_baja", etiqueta: "Fecha de baja del último empleo", tipo: "date", ayuda: "certificado de baja o constancia" },
      { id: "cotiza_actualmente", etiqueta: "Hoy tiene un empleo formal (cotiza al IMSS)", tipo: "casilla" },
      { id: "ultimo_patron", etiqueta: "Último patrón", ayuda: "opcional" },
    ] },
    { titulo: "Cuenta y semanas", campos: [
      { id: "fecha_primera_alta", etiqueta: "Primera alta en el IMSS", tipo: "date", ayuda: "define Ley 73 o 97" },
      { id: "regimen", etiqueta: "Régimen", tipo: "seleccion", opciones: [["por_definir", "Por definir (lo calcula)"], ["L73", "Ley 73"], ["L97", "Ley 97"]] },
      { id: "semanas_cotizadas", etiqueta: "Semanas cotizadas", tipo: "decimal" },
      { id: "semanas_descontadas", etiqueta: "Semanas descontadas", tipo: "decimal", ayuda: "si hubo retiros" },
      { id: "semanas_reintegradas", etiqueta: "Semanas reintegradas", tipo: "decimal" },
      { id: "bimestres_cotizados", etiqueta: "Bimestres cotizados", tipo: "decimal", ayuda: "vacío = se calculan con alta y baja" },
      { id: "afore", etiqueta: "Afore", tipo: "seleccion", opciones: [["", "Sin capturar"], ...afores] },
      { id: "fecha_apertura_cuenta", etiqueta: "Apertura de la cuenta Afore", tipo: "date" },
      { id: "tipo_cuenta", etiqueta: "Tipo de cuenta", tipo: "seleccion", opciones: [["", "Sin capturar"], ["registrada", "Registrada"], ["asignada", "Asignada (no puede retirar)"]] },
      { id: "estado_ultimo_retiro", etiqueta: "Último retiro por desempleo", tipo: "seleccion",
        opciones: [["por_verificar", "Por verificar"], ["nunca_retiro", "Nunca ha retirado"], ["con_retiro", "Tiene un retiro previo"]] },
      { id: "fecha_ultimo_retiro", etiqueta: "Fecha del último retiro", tipo: "date", ayuda: "solo si tiene uno" },
      { id: "ide_vigente", etiqueta: "Expediente de identificación (IDE) vigente en la Afore", tipo: "casilla" },
    ] },
    { titulo: "Salarios y saldos", campos: [
      { id: "sbc_ultimo", etiqueta: "Último salario base de cotización (diario)", tipo: "decimal", ayuda: "modalidad A" },
      { id: "sbc_promedio_250", etiqueta: "SBC promedio de las últimas 250 semanas", tipo: "decimal", ayuda: "modalidad B" },
      { id: "saldo_rcv", etiqueta: "Saldo RCV", tipo: "decimal", ayuda: "sin SAR 92" },
      { id: "saldo_voluntarias", etiqueta: "Aportaciones voluntarias", tipo: "decimal" },
      { id: "fecha_estado_cuenta", etiqueta: "Fecha del estado de cuenta", tipo: "date" },
    ] },
    { titulo: "Resultado", campos: [] },
  ];

  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const [v, setV] = useState<Valores>(inicial);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const cambiar = (id: string, valor: string | boolean) => setV((x) => ({ ...x, [id]: valor }));

  const forma = (ids: string[]) => {
    const f = new FormData();
    for (const id of ids) {
      const x = v[id];
      if (typeof x === "boolean") { if (x) f.set(id, "si"); } else if (x !== undefined) f.set(id, x);
    }
    return f;
  };
  const guardar = (siguiente: number) => iniciar(async () => {
    setError(null);
    const [a, b]: Resultado[] = await Promise.all([guardarImss(casoId, {}, forma(IMSS)), guardarAfore(casoId, {}, forma(AFORE))]);
    const e = { ...(a.errores ?? {}), ...(b.errores ?? {}) };
    setErrores(e);
    if (a.error || b.error) setError(a.error ?? b.error ?? null);
    if (!Object.keys(e).length && !a.error && !b.error) { setPaso(siguiente); router.refresh(); }
  });

  const actual = PASOS[paso];
  const visibles = actual.campos.filter((c) => c.id !== "fecha_ultimo_retiro" || v.estado_ultimo_retiro === "con_retiro");
  // Errores de campos que no están en este paso (p. ej. la justificación del régimen) también se muestran.
  const ajenos = Object.entries(errores).filter(([k]) => !visibles.some((c) => c.id === k));

  return (
    <div className="grid gap-4">
      <ol className="grid grid-cols-4 gap-2" aria-label="Pasos">
        {PASOS.map((p, i) => (
          <li key={p.titulo}>
            <button type="button" onClick={() => (i < paso ? setPaso(i) : undefined)} disabled={i > paso}
              aria-current={i === paso ? "step" : undefined}
              className={cn("flex w-full flex-col items-start gap-1 border-t-4 pt-2 text-left text-xs md:text-sm",
                i < paso ? "border-exito text-exito-texto" : i === paso ? "border-brand font-medium text-brand" : "border-borde text-ink-muted")}>
              <span className="cifra">{i < paso ? <Check className="inline size-4" aria-hidden /> : `${i + 1}.`}</span>
              <span className="hidden sm:inline">{p.titulo}</span>
            </button>
          </li>
        ))}
      </ol>
      <h3 className="font-display text-lg font-semibold text-ink sm:hidden">{actual.titulo}</h3>

      {paso < 3 ? (
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); guardar(paso + 1); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            {visibles.map((c) => (
              <div key={c.id} className={cn("flex flex-col gap-1.5", c.tipo === "casilla" && "sm:col-span-2")}>
                {c.tipo === "casilla" ? (
                  <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
                    <input type="checkbox" id={`a-${c.id}`} checked={Boolean(v[c.id])} onChange={(e) => cambiar(c.id, e.target.checked)} className="size-5" />
                    {c.etiqueta}
                  </label>
                ) : (
                  <>
                    <Label htmlFor={`a-${c.id}`}>{c.etiqueta} {c.ayuda && <span className="font-normal text-ink-muted">· {c.ayuda}</span>}</Label>
                    {c.tipo === "seleccion" ? (
                      <select id={`a-${c.id}`} value={String(v[c.id] ?? "")} onChange={(e) => cambiar(c.id, e.target.value)}
                        className="h-11 w-full rounded-[var(--radius-boton)] border border-borde bg-surface px-3 text-sm text-ink md:h-10">
                        {c.opciones!.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                      </select>
                    ) : (
                      <Input id={`a-${c.id}`} type={c.tipo === "date" ? "date" : "text"} inputMode={c.tipo === "decimal" ? "decimal" : undefined}
                        max={c.tipo === "date" ? hoy : undefined} value={String(v[c.id] ?? "")} onChange={(e) => cambiar(c.id, e.target.value)}
                        aria-invalid={Boolean(errores[c.id])} />
                    )}
                  </>
                )}
                {errores[c.id] && <p className="text-xs text-critico">{errores[c.id]}</p>}
              </div>
            ))}
            {paso === 1 && errores.regimen && (
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="a-regimen_justificacion">¿Por qué cambias el régimen?</Label>
                <Input id="a-regimen_justificacion" value={String(v.regimen_justificacion ?? "")} onChange={(e) => cambiar("regimen_justificacion", e.target.value)} />
              </div>
            )}
          </div>
          {(error || ajenos.length > 0) && (
            <div role="alert" className="rounded-[var(--radius-boton)] bg-critico-tint p-3 text-sm text-critico">
              {error && <p>{error}</p>}
              {ajenos.length > 0 && <ul className="list-disc pl-5">{ajenos.map(([k, m]) => <li key={k}>{m}</li>)}</ul>}
            </div>
          )}
          <div className="flex gap-2">
            {paso > 0 && <Button type="button" variant="secundario" onClick={() => setPaso(paso - 1)}><ArrowLeft aria-hidden /> Atrás</Button>}
            <Button type="submit" disabled={pendiente}>{pendiente ? "Guardando…" : <>Guardar y seguir <ArrowRight aria-hidden /></>}</Button>
          </div>
        </form>
      ) : (
        <div className="grid gap-3">
          <p className="text-sm text-ink-muted">Datos guardados. Calcula para ver cuánto puede retirar en cada modalidad, cuántas semanas pierde y el texto para el cliente.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secundario" onClick={() => setPaso(2)}><ArrowLeft aria-hidden /> Atrás</Button>
            <BotonCalcular casoId={casoId} modalidad={modalidad} texto="Calcular precalificación" />
          </div>
        </div>
      )}
    </div>
  );
}
