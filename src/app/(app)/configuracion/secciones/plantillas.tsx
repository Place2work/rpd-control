import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Sesion } from "@/lib/auth/sesion";
import { plantillaVigente } from "@/lib/contratos/datos";
import { VARIABLES } from "@/lib/contratos/plantilla";
import { PLANTILLAS_INICIALES } from "@/lib/contratos/plantillas-iniciales";
import { conUsuario } from "@/lib/db/prisma";
import { hoyCDMX } from "@/lib/tiempo";
import { Campo, CampoTexto } from "../../casos/[id]/campos";
import { FormularioAccion } from "../../casos/[id]/formulario-accion";
import { nuevaVersionPlantilla } from "../acciones";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const area = "w-full rounded-[var(--radius-boton)] border border-borde bg-surface p-3 font-mono text-xs leading-relaxed text-ink";

export async function SeccionPlantillas({ sesion }: { sesion: Sesion }) {
  const hoy = hoyCDMX();
  // Carga la versión 1 de las que todavía no se han usado, para poder revisarlas antes del primer contrato.
  await Promise.all(PLANTILLAS_INICIALES.map((x) => plantillaVigente(x.tipoServicio, x.clase, hoy)));
  const todas = await conUsuario(sesion.claims, (tx) => tx.plantillaContrato.findMany({ orderBy: [{ tipo_servicio: "asc" }, { clase: "asc" }, { version: "desc" }] }), sesion.ip);
  const grupos = new Map<string, typeof todas>();
  for (const p of todas) grupos.set(`${p.clase}|${p.tipo_servicio}`, [...(grupos.get(`${p.clase}|${p.tipo_servicio}`) ?? []), p]);

  return (
    <div className="grid gap-4">
      {[...grupos].map(([k, versiones]) => {
        const [clase, servicio] = k.split("|");
        const vigente = versiones.find((v) => iso(v.vigente_desde)! <= hoy && (v.vigente_hasta === null || iso(v.vigente_hasta)! >= hoy)) ?? versiones[0];
        return (
          <Card key={k}>
            <CardHeader>
              <CardTitle>{vigente.nombre ?? `${clase} ${servicio}`}</CardTitle>
              <span className="text-sm text-ink-muted">versión {vigente.version} · desde {iso(vigente.vigente_desde)}</span>
            </CardHeader>
            <CardContent className="grid gap-3">
              {versiones.length > 1 && (
                <p className="text-xs text-ink-muted">Historial: {versiones.map((v) => `v${v.version} (${iso(v.vigente_desde)} → ${iso(v.vigente_hasta) ?? "sin fin"})`).join(" · ")}</p>
              )}
              <details>
                <summary className="cursor-pointer text-sm font-medium text-brand">Editar (crea una versión nueva)</summary>
                <div className="mt-3">
                  <FormularioAccion accion={nuevaVersionPlantilla.bind(null, clase, servicio)} boton="Guardar versión nueva" etiquetas={{ cuerpo: "Texto", vigente_desde: "Vigente desde" }}>
                    <Campo id="cuerpo" etiqueta="Texto de la plantilla">
                      <textarea id="cuerpo" name="cuerpo" rows={24} defaultValue={vigente.cuerpo} className={area} spellCheck />
                    </Campo>
                    <CampoTexto id="vigente_desde" etiqueta="Vigente desde" tipo="date" valor={hoy} min={hoy} className="max-w-60" />
                  </FormularioAccion>
                </div>
              </details>
            </CardContent>
          </Card>
        );
      })}
      <Card>
        <CardHeader><CardTitle>Cómo se escribe una plantilla</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm text-ink-muted">
          <p><code># Título</code> · <code>## Subtítulo</code> · <code>### SECCIÓN</code> · <code>#### Cláusula</code> · <code>a) inciso</code> · <code>• viñeta</code> · <code>☐ casilla</code> · <code>**negritas**</code> · <code>[[firmas]]</code> · <code>[[salto]]</code> (página nueva)</p>
          <p>Un renglón en blanco separa párrafos. Si un renglón empieza con «b) …» y es continuación del anterior, súbelo al renglón de arriba.</p>
          <p>Partes opcionales: <code>{"{{#si finado.afore}}…{{/si}}"}</code>. Listas: <code>{"{{#cada advertencias}}{{letra}}) {{.}}{{/cada}}"}</code>.</p>
          <p>Variables disponibles: {VARIABLES.map((v) => <code key={v} className="mr-1 inline-block rounded bg-slate-100 px-1 text-xs">{`{{${v}}}`}</code>)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
