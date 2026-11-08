"use client";

// Canal del caso con la proyección de comisiones: al elegir asesor de pensiones o referidor se ve al instante
// cuánto le tocaría con el honorario esperado (antes de guardar). Las cuentas salen de lib/reglas (puras).
import { useState } from "react";
import { mxn } from "@/lib/formato";
import { proyectarComisiones, type Escalon } from "@/lib/reglas/comisiones";
import { Campo, claseSelect } from "./campos";

export type DatosProyeccion = {
  honorario: number | null; // con IVA
  subtotal: number | null;
  fuente: string; // de dónde sale el honorario
  costoAlta: number;
  base: "subtotal" | "total";
  iva: number;
  escalones: Escalon[] | null;
};

type Props = {
  datos: DatosProyeccion;
  asesores: { id: string; nombre: string; pct: number }[];
  referidores: { id: string; nombre: string; referidosMes: number }[];
  asesorId: string | null;
  referidorId: string | null;
};

export function CanalConProyeccion({ datos, asesores, referidores, asesorId, referidorId }: Props) {
  const [asesor, setAsesor] = useState(asesorId ?? "");
  const [referidor, setReferidor] = useState(referidorId ?? "");
  const a = asesores.find((x) => x.id === asesor) ?? null;
  const r = referidores.find((x) => x.id === referidor) ?? null;
  const conMonto = datos.honorario !== null && datos.subtotal !== null;
  const p = proyectarComisiones({
    honorario: datos.honorario ?? 0, subtotal: datos.subtotal ?? 0, costoAlta: datos.costoAlta, base: datos.base, iva: datos.iva,
    asesorPct: a ? a.pct : null, escalones: r ? datos.escalones : null, referidosMes: r ? r.referidosMes : 0,
  });
  const pct = (x: number) => `${+(x * 100).toFixed(2)}%`;
  const txtBase = datos.base === "total" ? "honorario con IVA" : "honorario sin IVA";

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="referidor_id" etiqueta="Referidor">
          <select id="referidor_id" name="referidor_id" value={referidor} onChange={(e) => setReferidor(e.target.value)} className={claseSelect}>
            <option value="">Ninguno</option>
            {referidores.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>
        </Campo>
        <Campo id="socio_id" etiqueta="Asesor de pensiones">
          <select id="socio_id" name="socio_id" value={asesor} onChange={(e) => setAsesor(e.target.value)} className={claseSelect}>
            <option value="">Ninguno</option>
            {asesores.map((o) => <option key={o.id} value={o.id}>{o.nombre} · {pct(o.pct)}</option>)}
          </select>
        </Campo>
      </div>

      {(a || r) && (
        <section aria-label="Proyección de comisiones" className="rounded-[var(--radius-tarjeta)] border border-brand/30 bg-brand-tint p-4 text-sm">
          <p className="font-display font-semibold text-ink">Proyección de comisiones</p>
          {conMonto ? (
            <p className="mt-1 text-xs text-ink-muted">Con un honorario de {mxn(datos.honorario!)} ({datos.fuente}).</p>
          ) : (
            <p className="mt-1 text-xs text-aviso">Todavía no hay monto: captura el pago esperado de la Afore o el cálculo para ver cuánto le tocaría.</p>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {a && p.asesor && (
              <div className="rounded-[var(--radius-boton)] bg-surface p-3">
                <p className="text-xs text-ink-muted">Asesor de pensiones · {a.nombre}</p>
                <p className="cifra font-display text-2xl font-semibold text-brand">{conMonto ? mxn(p.asesor.monto) : "—"}</p>
                {conMonto && (
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                    <dt className="text-ink-muted">{txtBase[0].toUpperCase() + txtBase.slice(1)}</dt><dd className="cifra text-right">{mxn(p.asesor.base)}</dd>
                    <dt className="text-ink-muted">− Costo del alta</dt><dd className="cifra text-right">{mxn(p.asesor.costo)}</dd>
                    <dt className="text-ink-muted">× {pct(a.pct)} asesor</dt><dd className="cifra text-right font-medium">{mxn(p.asesor.monto)}</dd>
                    <dt className="text-ink-muted">Empresa ({pct(1 - a.pct)})</dt><dd className="cifra text-right">{mxn(p.asesor.empresa)}</dd>
                    <dt className="col-span-2 mt-1 text-ink-muted">Su factura: {mxn(p.asesor.factura.subtotal)} + IVA {mxn(p.asesor.factura.iva)}</dt>
                  </dl>
                )}
              </div>
            )}
            {r && p.referidor && (
              <div className="rounded-[var(--radius-boton)] bg-surface p-3">
                <p className="text-xs text-ink-muted">Referidor · {r.nombre}</p>
                <p className="cifra font-display text-2xl font-semibold text-brand">{mxn(p.referidor.monto)}</p>
                <p className="mt-2 text-xs text-ink-muted">
                  Sería su referido número {p.referidor.n} cobrado este mes. El escalón se fija al cierre del mes:
                  {" "}{(datos.escalones ?? []).map((e) => `${e.desde}${e.hasta ? `–${e.hasta}` : "+"}: ${mxn(e.monto)}`).join(" · ")}.
                </p>
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-ink-muted">Es una proyección. La comisión real nace al firmar el contrato y se ajusta con lo que pague la Afore y se cobre.</p>
        </section>
      )}
    </div>
  );
}
