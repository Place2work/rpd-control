import { FileText, HandCoins, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { EstadoVacio } from "@/components/rpd/estado-vacio";
import { mesValido, nombreMes, SelectorMes } from "@/components/rpd/selector-mes";
import { obtenerSesion } from "@/lib/auth/sesion";
import { estadoDeCuenta, leerBenef, resumenComisiones } from "@/lib/comisiones/consultas";
import { mxn } from "@/lib/formato";
import { hoyCDMX } from "@/lib/tiempo";
import { CampoTexto, Seleccion } from "../casos/[id]/campos";
import { FormularioAccion } from "../casos/[id]/formulario-accion";
import { liquidar } from "./acciones";

export const metadata: Metadata = { title: "Comisiones" };

const TIPO = { vendedor: "Vendedor", referido: "Referidor", socio: "Socio" } as const;
const ESTADO = { estimada: ["Estimada", "prospecto"], devengada: ["Por pagar", "tramite"], pagada: ["Pagada", "pagado"], cancelada: ["Cancelada", "prospecto"] } as const;
const METODOS = [["transferencia", "Transferencia"], ["efectivo", "Efectivo"], ["tarjeta", "Tarjeta"]] as const;

// 9.3 y 10.7: liquidaciones por beneficiario y mes. Cada beneficiario con usuario ve solo lo suyo.
export default async function Comisiones({ searchParams }: { searchParams: Promise<{ mes?: string; benef?: string }> }) {
  const sesion = await obtenerSesion();
  const hoy = hoyCDMX();
  const q = await searchParams;
  const mes = mesValido(q.mes, hoy.slice(0, 7));
  const director = sesion.usuario.rol === "director";
  // Sin ser Director, el estado de cuenta es siempre el propio.
  const propio = sesion.usuario.rol === "socio" && sesion.usuario.socio_id ? `socio:${sesion.usuario.socio_id}` : `usuario:${sesion.usuario.id}`;
  const benef = leerBenef(director ? q.benef : propio);
  const resumen = director ? await resumenComisiones(sesion, mes) : [];
  const e = benef ? await estadoDeCuenta(sesion, benef, mes) : null;
  const claveBenef = benef ? `${benef.tipo}:${benef.id}` : "";

  return (
    <>
      <Encabezado titulo="Comisiones" descripcion={director ? "Liquidaciones por beneficiario y mes. Una comisión se paga solo cuando ya entró el dinero que la origina." : "Tu estado de cuenta: estimado, devengado y pagado."}>
        <SelectorMes mes={mes} base={benef && director ? `/comisiones?benef=${claveBenef}` : "/comisiones"} maximo={hoy.slice(0, 7)} />
        {director && <Link href="/comisiones/beneficiarios" className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-boton)] border border-brand px-4 text-sm font-medium text-brand hover:bg-brand-tint"><Users className="size-4" aria-hidden /> Referidores y socios</Link>}
      </Encabezado>

      {director && (
        <Card className="mb-4">
          <CardHeader><CardTitle>{nombreMes(mes)}</CardTitle></CardHeader>
          {resumen.length === 0 ? (
            <EstadoVacio icono={HandCoins} titulo="Sin comisiones en el mes" texto="Las comisiones nacen estimadas al firmar contrato si el caso tiene vendedor, referidor o socio." />
          ) : (
            <CardContent>
              <div className="-mx-4 overflow-x-auto px-4">
                <table className="w-full min-w-[620px] text-sm">
                  <thead><tr className="text-left text-xs text-ink-muted">{["Beneficiario", "Tipo", "Casos", "Por pagar", "Pagado", "Estimado en camino"].map((t) => <th key={t} className="pb-2 pr-3 font-medium">{t}</th>)}</tr></thead>
                  <tbody>
                    {resumen.map((r) => (
                      <tr key={r.clave} className={`border-t border-borde ${r.clave === claveBenef ? "bg-brand-tint" : ""}`}>
                        <td className="py-2 pr-3"><Link href={`/comisiones?mes=${mes}&benef=${r.clave}`} className="font-medium text-brand hover:underline">{r.nombre}</Link></td>
                        <td className="py-2 pr-3">{TIPO[r.tipo as keyof typeof TIPO]}</td>
                        <td className="cifra py-2 pr-3">{r.casos}</td>
                        <td className={`cifra py-2 pr-3 font-medium ${r.porPagar > 0 ? "text-ink" : "text-ink-muted"}`}>{mxn(r.porPagar)}</td>
                        <td className="cifra py-2 pr-3">{mxn(r.pagado)}</td>
                        <td className="cifra py-2 pr-3 text-ink-muted">{mxn(r.estimado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {e && benef && (
        <Card>
          <CardHeader>
            <CardTitle>{e.nombre} · {nombreMes(mes)}</CardTitle>
            <a href={`/api/comisiones/estado-cuenta?benef=${claveBenef}&mes=${mes}`} target="_blank" rel="noopener"
              className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-boton)] border border-brand px-4 text-sm font-medium text-brand hover:bg-brand-tint">
              <FileText className="size-4" aria-hidden /> Estado de cuenta PDF
            </a>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-4">
              {[["Devengado en el mes", e.totales.devengadoMes], ["Pagado", e.totales.pagado], ["Por pagar", e.totales.porPagar], ["Estimado en camino", e.totales.estimado]].map(([t, v]) => (
                <div key={t as string} className="rounded-[var(--radius-boton)] bg-brand-tint p-3">
                  <p className="text-xs text-ink-muted">{t}</p>
                  <p className="cifra font-display text-xl font-semibold text-ink">{mxn(v as number)}</p>
                </div>
              ))}
            </div>
            {e.comisiones.length === 0 ? <p className="text-sm text-ink-muted">Sin comisiones en este mes.</p> : (
              <div className="-mx-4 overflow-x-auto px-4">
                <table className="w-full min-w-[640px] text-sm">
                  <thead><tr className="text-left text-xs text-ink-muted">{["Caso", "Regla", "Devengo", "Monto", "Estado"].map((t) => <th key={t} className="pb-2 pr-3 font-medium">{t}</th>)}</tr></thead>
                  <tbody>
                    {e.comisiones.map((c) => {
                      const [texto, tono] = ESTADO[c.estado];
                      return (
                        <tr key={c.id} className="border-t border-borde align-top">
                          <td className="py-2 pr-3">
                            {director || sesion.usuario.rol !== "vendedor" ? <Link href={`/casos/${c.caso.id}?tab=dinero`} className="text-brand hover:underline">{c.caso.folio}</Link> : <span className="cifra">{c.caso.folio}</span>}
                            <span className="block text-xs text-ink-muted">{[c.caso.persona.nombre, c.caso.persona.apellido_paterno].filter(Boolean).join(" ")}</span>
                          </td>
                          <td className="py-2 pr-3 text-ink-muted">{c.regla_aplicada}</td>
                          <td className="py-2 pr-3">{c.fecha_devengo?.toISOString().slice(0, 10) ?? "—"}</td>
                          <td className="cifra py-2 pr-3 font-medium">{mxn(c.monto)}</td>
                          <td className="py-2"><Badge tono={tono}>{texto}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {e.liquidaciones.length > 0 && (
              <p className="text-sm text-ink-muted">
                Pagos del mes: {e.liquidaciones.map((l) => `${mxn(l.total)} el ${l.fecha_pago.toISOString().slice(0, 10)} por ${l.metodo}${l.referencia ? ` (${l.referencia})` : ""}`).join(" · ")}
              </p>
            )}
            {director && e.totales.porPagar > 0 && (
              <div className="rounded-[var(--radius-boton)] border border-borde p-4">
                <p className="mb-3 font-medium text-ink">Marcar como pagada · {mxn(e.totales.porPagar)}</p>
                <FormularioAccion accion={liquidar.bind(null, claveBenef, mes)} boton="Registrar pago" etiquetas={{ fecha_pago: "Fecha de pago", metodo: "Método", referencia: "Referencia" }}>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <CampoTexto id="fecha_pago" etiqueta="Fecha de pago" tipo="date" valor={hoy} max={hoy} />
                    <Seleccion id="metodo" etiqueta="Método" opciones={METODOS} valor="transferencia" />
                    <CampoTexto id="referencia" etiqueta="Referencia" ayuda="opcional" />
                  </div>
                </FormularioAccion>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {director && !benef && resumen.length > 0 && <p className="text-sm text-ink-muted">Elige un beneficiario para ver su detalle, liquidarlo o descargar su estado de cuenta.</p>}
    </>
  );
}
