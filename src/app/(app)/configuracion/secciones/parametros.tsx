import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Sesion } from "@/lib/auth/sesion";
import { ES_PORCENTAJE, grupoDe, GRUPOS, OPCIONES, valorVisible } from "@/lib/configuracion/parametros";
import { conUsuario } from "@/lib/db/prisma";
import { hoyCDMX } from "@/lib/tiempo";
import { CampoTexto, Seleccion } from "../../casos/[id]/campos";
import { FormularioAccion } from "../../casos/[id]/formulario-accion";
import { programarParametro } from "../acciones";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function SeccionParametros({ sesion }: { sesion: Sesion }) {
  const hoy = hoyCDMX();
  const filas = await conUsuario(sesion.claims, (tx) => tx.parametro.findMany({ orderBy: [{ clave: "asc" }, { vigente_desde: "desc" }] }), sesion.ip);
  const porClave = new Map<string, typeof filas>();
  for (const f of filas) porClave.set(f.clave, [...(porClave.get(f.clave) ?? []), f]);
  const grupos = [...GRUPOS.map((g) => g.titulo), "Otros"];

  return (
    <div className="grid gap-4">
      <p className="text-sm text-ink-muted">
        Un cambio nunca altera lo ya calculado: el valor nuevo empieza en la fecha que elijas (hoy o después) y el anterior queda vigente hasta el día previo.
        Los porcentajes se escriben como 26 o 26%.
      </p>
      {grupos.map((g) => {
        const claves = [...porClave.keys()].filter((k) => grupoDe(k) === g);
        if (!claves.length) return null;
        return (
          <Card key={g}>
            <CardHeader><CardTitle>{g}</CardTitle></CardHeader>
            <CardContent>
              <ul className="divide-y divide-borde">
                {claves.map((clave) => {
                  const versiones = porClave.get(clave)!;
                  const vigente = versiones.find((v) => iso(v.vigente_desde)! <= hoy && (v.vigente_hasta === null || iso(v.vigente_hasta)! >= hoy));
                  const futuro = versiones.find((v) => iso(v.vigente_desde)! > hoy);
                  return (
                    <li key={clave} className="grid gap-2 py-3 md:grid-cols-[1fr_auto] md:items-start">
                      <div className="min-w-0">
                        <p className="text-sm text-ink">{versiones[0].descripcion ?? clave}</p>
                        <p className="font-mono text-[11px] text-ink-muted">{clave}</p>
                        {futuro && <p className="mt-1 text-xs text-aviso">Programado: {valorVisible(clave, futuro.valor)} desde el {iso(futuro.vigente_desde)}</p>}
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs font-medium text-brand">Cambiar{versiones.length > 1 ? ` · historial (${versiones.length})` : ""}</summary>
                          <div className="mt-2 grid gap-3 rounded-[var(--radius-boton)] bg-slate-50 p-3">
                            {versiones.length > 1 && (
                              <ul className="text-xs text-ink-muted">
                                {versiones.map((v) => <li key={v.id} className="cifra">{valorVisible(clave, v.valor)} · {iso(v.vigente_desde)} → {iso(v.vigente_hasta) ?? "sin fin"}</li>)}
                              </ul>
                            )}
                            <FormularioAccion accion={programarParametro.bind(null, clave)} boton="Programar" etiquetas={{ valor: "Valor", vigente_desde: "Desde" }}>
                              <div className="grid gap-3 sm:grid-cols-2">
                                {OPCIONES[clave]
                                  ? <Seleccion id="valor" etiqueta="Valor nuevo" valor={vigente?.valor} opciones={OPCIONES[clave].map((o) => [o, o] as const)} />
                                  : <CampoTexto id="valor" etiqueta="Valor nuevo" ayuda={ES_PORCENTAJE.has(clave) ? "en %" : undefined}
                                      valor={vigente ? (ES_PORCENTAJE.has(clave) ? +(Number(vigente.valor) * 100).toFixed(4) : vigente.valor) : ""} />}
                                <CampoTexto id="vigente_desde" etiqueta="Vigente desde" tipo="date" valor={hoy} min={hoy} />
                              </div>
                            </FormularioAccion>
                          </div>
                        </details>
                      </div>
                      <p className="cifra text-right text-sm font-medium text-ink md:min-w-40">{vigente ? valorVisible(clave, vigente.valor) : "—"}
                        <span className="block text-xs font-normal text-ink-muted">desde {vigente ? iso(vigente.vigente_desde) : "—"}</span></p>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
