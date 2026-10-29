import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { mxn } from "@/lib/formato";
import type { Escalon, ReglaEsquema } from "@/lib/reglas/comisiones";
import { hoyCDMX } from "@/lib/tiempo";
import { CampoTexto } from "../../casos/[id]/campos";
import { FormularioAccion } from "../../casos/[id]/formulario-accion";
import { nuevaVersionEsquema } from "../acciones";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const SERVICIO: Record<string, string> = { RETIRO_DESEMPLEO: "Retiro por desempleo", FALLECIMIENTO: "Pensión por fallecimiento" };

export async function SeccionComisiones({ sesion }: { sesion: Sesion }) {
  const hoy = hoyCDMX();
  const todos = await conUsuario(sesion.claims, (tx) => tx.esquemaComision.findMany({ orderBy: [{ nombre: "asc" }, { version: "desc" }] }), sesion.ip);
  const vigentes = todos.filter((e) => iso(e.vigente_desde)! <= hoy && (e.vigente_hasta === null || iso(e.vigente_hasta)! >= hoy));
  const futuros = todos.filter((e) => iso(e.vigente_desde)! > hoy);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {vigentes.map((e) => {
        const r = e.reglas as ReglaEsquema;
        const prog = futuros.find((f) => f.nombre === e.nombre && f.tipo_servicio === e.tipo_servicio);
        return (
          <Card key={e.id}>
            <CardHeader>
              <CardTitle>{e.nombre}</CardTitle>
              <span className="text-sm text-ink-muted">{e.tipo_servicio ? SERVICIO[e.tipo_servicio] ?? e.tipo_servicio : "Cualquier servicio"} · v{e.version}</span>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {r.tipo === "porcentaje" && <p>{+(r.pct * 100).toFixed(4)}% de lo que paga la Afore, por cada pago, cuando se cobra su honorario.</p>}
              {r.tipo === "escalonado_mensual" && (
                <ul>{r.escalones.map((x: Escalon) => <li key={x.desde}>{x.desde}{x.hasta ? `–${x.hasta}` : " o más"} referidos cobrados en el mes: {mxn(x.monto)} c/u</li>)}</ul>
              )}
              {r.tipo === "reparto" && <p>El % y el costo administrativo se toman de cada socio (Comisiones → Referidores y socios). La base (subtotal o total) está en Parámetros.</p>}
              {r.tipo === "compuesto" && <p>Los montos fijos y el % de lo recuperado están en Parámetros (FALLEC_COMISION_…).</p>}
              {prog && <p className="text-xs text-aviso">Hay una versión programada desde el {iso(prog.vigente_desde)}.</p>}
              {(r.tipo === "porcentaje" || r.tipo === "escalonado_mensual") && (
                <details>
                  <summary className="cursor-pointer font-medium text-brand">Cambiar (crea una versión nueva)</summary>
                  <div className="mt-3">
                    <FormularioAccion accion={nuevaVersionEsquema.bind(null, e.id)} boton="Programar" etiquetas={{ pct: "%", hasta1: "Primer límite", hasta2: "Segundo límite", monto1: "Monto", vigente_desde: "Desde" }}>
                      {r.tipo === "porcentaje" ? (
                        <CampoTexto id="pct" etiqueta="% del pago de la Afore" valor={+(r.pct * 100).toFixed(4)} inputMode="decimal" />
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <CampoTexto id="hasta1" etiqueta="1 a … referidos" valor={r.escalones[0].hasta ?? ""} inputMode="numeric" />
                          <CampoTexto id="monto1" etiqueta="Pago c/u" valor={r.escalones[0].monto} inputMode="decimal" />
                          <CampoTexto id="hasta2" etiqueta="… hasta" valor={r.escalones[1]?.hasta ?? ""} inputMode="numeric" />
                          <CampoTexto id="monto2" etiqueta="Pago c/u" valor={r.escalones[1]?.monto ?? ""} inputMode="decimal" />
                          <span className="self-end text-sm text-ink-muted">Más de eso:</span>
                          <CampoTexto id="monto3" etiqueta="Pago c/u" valor={r.escalones[2]?.monto ?? ""} inputMode="decimal" />
                        </div>
                      )}
                      <CampoTexto id="vigente_desde" etiqueta="Vigente desde" tipo="date" valor={hoy} min={hoy} />
                    </FormularioAccion>
                    <p className="mt-2 text-xs text-ink-muted">Las comisiones ya pagadas no cambian; las estimadas y devengadas sin pagar se recalculan con la versión vigente.</p>
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
