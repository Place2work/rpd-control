"use client";

// Simulador (CAPACITACION.md 12.1-4): el asesor captura su respuesta y el servidor la compara con el motor de la
// calculadora (montos ±$1, semanas ±0.1). No crea personas ni casos reales.
import { Award, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { CampoCaso, CasoServido } from "@/lib/academia/tipos";
import type { ResultadoSimulador } from "@/lib/academia/motor";
import { cn } from "@/lib/utils";
import { resolverCasoPractico } from "../../acciones";

const RESULTADOS = [
  ["APTO", "APTO · genera contrato"], ["APTO_BLOQUEADO", "APTO_BLOQUEADO · falta un documento o trámite"],
  ["CALIFICA_NO_CONVIENE", "CALIFICA_NO_CONVIENE · no le conviene"], ["NO_TODAVIA", "NO_TODAVIA · todavía no (con fecha)"],
  ["NO_ELEGIBLE_DESVIO", "NO_ELEGIBLE_DESVIO · ofrece otro servicio"], ["NO_ELEGIBLE_DEFINITIVO", "NO_ELEGIBLE_DEFINITIVO · no califica"],
] as const;
const CAMPO: Record<CampoCaso, { etiqueta: string; tipo: "resultado" | "dinero" | "numero" | "fecha" | "modalidad" }> = {
  resultado: { etiqueta: "Resultado de la precalificación", tipo: "resultado" },
  montoA: { etiqueta: "Monto modalidad A ($)", tipo: "dinero" }, semanasA: { etiqueta: "Semanas que pierde con A", tipo: "numero" },
  montoB: { etiqueta: "Monto modalidad B ($)", tipo: "dinero" }, semanasB: { etiqueta: "Semanas que pierde con B", tipo: "numero" },
  honorario: { etiqueta: "Honorario estimado, IVA incluido ($)", tipo: "dinero" }, fechaElegibilidad: { etiqueta: "¿Desde qué fecha puede?", tipo: "fecha" },
  incrementosAntes: { etiqueta: "Incrementos (art. 167) antes del retiro", tipo: "numero" }, incrementosDespues: { etiqueta: "Incrementos después del retiro", tipo: "numero" },
  modalidadMenosSemanas: { etiqueta: "¿Qué modalidad resalta el sistema por costar menos semanas?", tipo: "modalidad" },
};
const claseCampo = "h-11 w-full rounded-[var(--radius-boton)] border border-borde bg-surface px-3 text-sm text-ink";
const texto = (v: unknown) => v === null || v === undefined || v === "" ? "—" : typeof v === "number" ? v.toLocaleString("es-MX", { maximumFractionDigits: 2 }) : String(v);

export function Simulador({ caso, volver }: { caso: CasoServido; volver: string }) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [opcion, setOpcion] = useState<number | null>(null);
  const [r, setR] = useState<ResultadoSimulador | null>(null);
  const [cargando, iniciar] = useTransition();
  const enviar = () => iniciar(async () => {
    const captura: Record<string, string | number | null> = caso.tipo === "opcion" ? { opcion } : Object.fromEntries((caso.captura ?? []).map((c) => {
      const v = (valores[c] ?? "").trim();
      const t = CAMPO[c].tipo;
      return [c, !v ? null : t === "dinero" || t === "numero" ? Number(v.replace(/[,$\s]/g, "")) : v];
    }));
    setR(await resolverCasoPractico(caso.clave, captura));
  });
  const completo = caso.tipo === "opcion" ? opcion !== null : (caso.captura ?? []).every((c) => (valores[c] ?? "").trim() !== "");

  return (
    <div className="grid gap-4">
      {caso.tipo === "retiro" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {(caso.captura ?? []).map((c) => {
            const f = CAMPO[c];
            return (
              <label key={c} className={cn("grid gap-1.5 text-sm font-medium text-ink", f.tipo === "resultado" && "sm:col-span-2")}>
                {f.etiqueta}
                {f.tipo === "resultado" ? (
                  <select className={claseCampo} value={valores[c] ?? ""} onChange={(e) => setValores({ ...valores, [c]: e.target.value })} disabled={!!r?.aprobado}>
                    <option value="">Elige…</option>{RESULTADOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                ) : f.tipo === "modalidad" ? (
                  <select className={claseCampo} value={valores[c] ?? ""} onChange={(e) => setValores({ ...valores, [c]: e.target.value })} disabled={!!r?.aprobado}>
                    <option value="">Elige…</option><option value="A">A</option><option value="B">B</option>
                  </select>
                ) : (
                  <input className={cn(claseCampo, "font-mono")} type={f.tipo === "fecha" ? "date" : "text"} inputMode={f.tipo === "fecha" ? undefined : "decimal"}
                    value={valores[c] ?? ""} onChange={(e) => setValores({ ...valores, [c]: e.target.value })} disabled={!!r?.aprobado} />
                )}
              </label>
            );
          })}
        </div>
      ) : (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">¿Qué haces?</legend>
          {(caso.opciones ?? []).map((o, k) => (
            <label key={k} className={cn("flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-boton)] border px-3 py-2.5 text-sm",
              opcion === k ? "border-brand bg-brand-tint text-ink" : "border-borde text-ink hover:bg-slate-50")}>
              <input type="radio" name="opcion" checked={opcion === k} onChange={() => setOpcion(k)} disabled={!!r?.aprobado} className="mt-0.5 size-4 shrink-0" />
              <span>{o}</span>
            </label>
          ))}
        </fieldset>
      )}
      {r?.error && <p role="alert" className="text-sm text-critico">{r.error}</p>}
      {r && !r.error && (
        <div className={cn("grid gap-2 rounded-[var(--radius-tarjeta)] border p-4 text-sm", r.aprobado ? "border-exito/40 bg-exito-tint" : "border-critico/30 bg-critico-tint")}>
          <p className={cn("flex items-center gap-2 font-semibold", r.aprobado ? "text-exito-texto" : "text-critico")}>
            {r.aprobado ? <CheckCircle2 className="size-5" aria-hidden /> : <XCircle className="size-5" aria-hidden />}
            {caso.tipo === "retiro" ? (r.aprobado ? "¡Correcto! Coincide con la calculadora." : "No coincide con la calculadora.") : (r.aprobado ? "¡Correcto!" : "No es la mejor respuesta.")}
          </p>
          {!r.aprobado && (r.diferencias ?? []).length > 0 && (
            <ul className="grid gap-1">
              {(r.diferencias ?? []).map((d) => (
                <li key={d.campo}>{d.campo === "opcion" ? "Tu respuesta" : CAMPO[d.campo as CampoCaso].etiqueta}: pusiste <strong>{texto(d.capturado)}</strong>
                  {r.aprobado ? "" : <> · la correcta es <strong className="text-exito-texto">{texto(d.esperado)}</strong></>}</li>
              ))}
            </ul>
          )}
          {r.explicacion && <p className="text-ink-muted">Por qué: {r.explicacion}</p>}
          {r.certificaciones?.map((c) => <p key={c} className="flex items-center gap-1.5 font-semibold text-exito-texto"><Award className="size-5" aria-hidden /> ¡Certificación {c} otorgada!</p>)}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {!r?.aprobado && (
          <button type="button" onClick={enviar} disabled={!completo || cargando}
            className="inline-flex h-11 items-center rounded-[var(--radius-boton)] bg-brand px-5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">
            {cargando ? "Revisando…" : r ? "Volver a revisar" : "Revisar mi respuesta"}
          </button>
        )}
        <Link href={volver} className="inline-flex h-11 items-center px-3 text-sm text-ink-muted hover:text-ink">Regresar a Academia</Link>
      </div>
    </div>
  );
}
