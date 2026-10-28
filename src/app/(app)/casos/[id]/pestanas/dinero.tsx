import { Banknote, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatoFecha, isoDe } from "@/components/rpd/insignia-dia46";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { mxn } from "@/lib/formato";
import type { CasoDetalle } from "@/lib/prospectos/consultas";
import { margenCaso } from "@/lib/reglas/comisiones";
import { hoyCDMX } from "@/lib/tiempo";
import { archivarPagoAfore, cancelarCobro, guardarCanal, marcarCobrado, registrarCobro, registrarPagoAfore } from "../acciones-dinero";
import { Campo, CampoTexto, Casilla, claseSelect, Seleccion } from "../campos";
import { FormularioAccion } from "../formulario-accion";

const corta = (d: Date | null) => (d ? formatoFecha(isoDe(d)!, { dateStyle: "medium" }) : "—");
const METODOS = [["transferencia", "Transferencia"], ["efectivo", "Efectivo"], ["tarjeta", "Tarjeta"]] as const;
const CONCEPTOS = [["honorario", "Honorario"], ["pago_inicial", "Pago inicial"], ["recuperado", "% de lo recuperado"], ["primera_mensualidad", "Primera mensualidad"]] as const;
const ESTADO_COBRO = { por_cobrar: ["Por cobrar", "espera"], cobrado: ["Cobrado", "pagado"], cancelado: ["Cancelado", "prospecto"] } as const;
const ESTADO_COMISION = { estimada: ["Estimada", "prospecto"], devengada: ["Devengada", "tramite"], pagada: ["Pagada", "pagado"], cancelada: ["Cancelada", "prospecto"] } as const;
const TIPO_COMISION = { vendedor: "Vendedor", referido: "Referidor", socio: "Socio" } as const;

export async function PestanaDinero({ caso, sesion }: { caso: CasoDetalle; sesion: Sesion }) {
  const rol = sesion.usuario.rol;
  if (rol === "vendedor") {
    return <Card><CardContent className="text-sm text-ink-muted">Los pagos y cobros los registra el asesor. Tus comisiones están en «Comisiones».</CardContent></Card>;
  }
  const esRetiro = caso.servicio.clave === "RETIRO_DESEMPLEO";
  const puedeCanal = rol === "director" || rol === "asesor";
  const d = await conUsuario(sesion.claims, async (tx) => ({
    pagos: await tx.pagoAfore.findMany({ where: { caso_id: caso.id, archivado_at: null }, orderBy: { numero: "asc" } }),
    cobros: await tx.cobro.findMany({ where: { caso_id: caso.id, archivado_at: null }, orderBy: { created_at: "asc" }, include: { pago_afore: { select: { numero: true } } } }),
    comisiones: await tx.comision.findMany({ where: { caso_id: caso.id, archivado_at: null, estado: { not: "cancelada" } }, orderBy: { created_at: "asc" } }),
    vendedores: puedeCanal ? await tx.usuario.findMany({ where: { rol: "vendedor", activo: true, archivado_at: null }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }) : [],
    referidores: puedeCanal ? await tx.referidor.findMany({ where: { archivado_at: null }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }) : [],
    socios: puedeCanal ? await tx.socio.findMany({ where: { archivado_at: null }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }) : [],
  }), sesion.ip);

  const vivos = d.cobros.filter((c) => c.estado !== "cancelado");
  const porCobrar = vivos.filter((c) => c.estado === "por_cobrar");
  const m = margenCaso(vivos.map((c) => ({ honorario: Number(c.honorario_total), iva: Number(c.iva), estado: c.estado })), d.comisiones.map((k) => ({ monto: Number(k.monto), estado: k.estado })));
  const pendiente = porCobrar.reduce((a, c) => a + Number(c.honorario_total), 0);
  const nombreDe = (tipo: string, id: string) =>
    (tipo === "usuario" ? d.vendedores : tipo === "referidor" ? d.referidores : d.socios).find((x) => x.id === id)?.nombre ?? (tipo === "socio" ? "Socio" : "—");

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra titulo="Honorario cobrado" valor={mxn(m.honorario)} nota={`IVA trasladado ${mxn(m.iva)}`} />
        <Cifra titulo="Por cobrar" valor={mxn(pendiente)} nota={`${porCobrar.length} ${porCobrar.length === 1 ? "cobro" : "cobros"}`} alerta={porCobrar.length > 0} />
        <Cifra titulo="Comisiones" valor={mxn(m.comisiones)} nota="Estimadas, devengadas y pagadas" />
        {rol === "director" && <Cifra titulo="Margen" valor={mxn(m.margen)} nota="Honorario − IVA − comisiones" />}
      </div>

      {esRetiro && (
        <Card>
          <CardHeader><CardTitle>Pagos de la Afore</CardTitle><span className="text-sm text-ink-muted">{d.pagos.length} de 6 como máximo</span></CardHeader>
          <CardContent className="grid gap-4">
            {d.pagos.length > 0 && (
              <Tabla encabezados={["#", "Depósito", "Bruto", "ISR", "Neto", ""]}>
                {d.pagos.map((p) => (
                  <tr key={p.id} className="border-t border-borde">
                    <td className="py-2 pr-3 font-medium">{p.numero}</td>
                    <td className="py-2 pr-3">{corta(p.fecha_deposito)}</td>
                    <td className="cifra py-2 pr-3">{mxn(p.monto_bruto)}</td>
                    <td className="cifra py-2 pr-3">{mxn(p.isr_retenido)}</td>
                    <td className="cifra py-2 pr-3 font-medium">{mxn(p.monto_neto)}</td>
                    <td className="py-2 text-right">
                      {rol === "director" && (
                        <details className="text-left">
                          <summary className="cursor-pointer text-xs text-ink-muted">Corregir</summary>
                          <div className="mt-2 w-64">
                            <FormularioAccion accion={archivarPagoAfore.bind(null, caso.id, p.id)} boton="Archivar pago" etiquetas={{ motivo: "Motivo" }}>
                              <CampoTexto id="motivo" etiqueta="Motivo" />
                            </FormularioAccion>
                          </div>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </Tabla>
            )}
            {d.pagos.length < 6 && (
              <FormularioAccion accion={registrarPagoAfore.bind(null, caso.id)} boton={`Registrar pago ${d.pagos.length + 1}`}
                etiquetas={{ fecha_deposito: "Fecha del depósito", monto_bruto: "Monto bruto", isr_retenido: "ISR retenido" }}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <CampoTexto id="fecha_deposito" etiqueta="Fecha del depósito" tipo="date" max={hoyCDMX()} />
                  <CampoTexto id="monto_bruto" etiqueta="Monto bruto" inputMode="decimal" placeholder="10,000.00" />
                  <CampoTexto id="isr_retenido" etiqueta="ISR retenido" ayuda="si hubo" inputMode="decimal" placeholder="0.00" />
                </div>
                <p className="text-xs text-ink-muted">El honorario del 30% (IVA incluido) se calcula sobre el depósito neto y queda por cobrar.</p>
              </FormularioAccion>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Cobros del honorario</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          {d.cobros.length === 0 && (
            <p className="text-sm text-ink-muted">{esRetiro ? "Cuando registres un pago de la Afore aparece aquí su honorario por cobrar." : "Registra el honorario cuando se cobre o se facture."}</p>
          )}
          {d.cobros.map((c) => {
            const [texto, tono] = ESTADO_COBRO[c.estado];
            return (
              <div key={c.id} className="rounded-[var(--radius-boton)] border border-borde p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Receipt className="size-4 text-ink-muted" aria-hidden />
                    <span className="font-medium text-ink">{c.pago_afore ? `Pago ${c.pago_afore.numero} de la Afore` : CONCEPTOS.find(([k]) => k === c.concepto)?.[1] ?? "Honorario"}</span>
                    <Badge tono={tono}>{texto}</Badge>
                  </div>
                  <span className="cifra font-display text-lg font-semibold text-ink">{mxn(c.honorario_total)}</span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  Subtotal {mxn(c.subtotal)} + IVA {mxn(c.iva)}{c.base_calculo ? ` · 30% de ${mxn(c.base_calculo)}` : ""}
                  {c.estado === "cobrado" && ` · cobrado el ${corta(c.fecha_cobro)} por ${c.metodo}${c.referencia ? ` (${c.referencia})` : ""}${c.factura_folio ? ` · factura ${c.factura_folio}` : ""}`}
                  {c.estado === "cancelado" && ` · ${c.motivo_cancelacion}`}
                </p>
                {c.estado === "por_cobrar" && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium text-brand">Marcar como cobrado</summary>
                    <div className="mt-3">
                      <FormularioAccion accion={marcarCobrado.bind(null, caso.id, c.id)} boton="Guardar cobro"
                        etiquetas={{ fecha_cobro: "Fecha de cobro", metodo: "Método", referencia: "Referencia", factura_folio: "Folio de factura" }}>
                        <div className="grid gap-3 sm:grid-cols-4">
                          <CampoTexto id="fecha_cobro" etiqueta="Fecha de cobro" tipo="date" valor={hoyCDMX()} max={hoyCDMX()} />
                          <Seleccion id="metodo" etiqueta="Método" opciones={METODOS} valor="transferencia" />
                          <CampoTexto id="referencia" etiqueta="Referencia" ayuda="opcional" />
                          <CampoTexto id="factura_folio" etiqueta="Folio de factura" ayuda="CFDI" />
                        </div>
                      </FormularioAccion>
                    </div>
                  </details>
                )}
                {c.estado !== "cancelado" && rol === "director" && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-ink-muted">Cancelar cobro</summary>
                    <div className="mt-2 max-w-sm">
                      <FormularioAccion accion={cancelarCobro.bind(null, caso.id, c.id)} boton="Cancelar cobro" etiquetas={{ motivo: "Motivo" }}>
                        <CampoTexto id="motivo" etiqueta="Motivo" />
                      </FormularioAccion>
                    </div>
                  </details>
                )}
              </div>
            );
          })}
          {!esRetiro && (
            <details>
              <summary className="cursor-pointer text-sm font-medium text-brand">Registrar un cobro</summary>
              <div className="mt-3">
                <FormularioAccion accion={registrarCobro.bind(null, caso.id)} boton="Registrar cobro"
                  etiquetas={{ honorario_total: "Honorario", concepto: "Concepto", base_calculo: "Monto recuperado" }}>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <CampoTexto id="honorario_total" etiqueta="Honorario" ayuda="IVA incluido" inputMode="decimal" valor={caso.honorario_fijo ? Number(caso.honorario_fijo) : null} />
                    <Seleccion id="concepto" etiqueta="Concepto" opciones={caso.servicio.clave === "FALLECIMIENTO" ? CONCEPTOS : CONCEPTOS.slice(0, 1)} valor="honorario" />
                    {caso.servicio.clave === "FALLECIMIENTO" && <CampoTexto id="base_calculo" etiqueta="Monto recuperado" ayuda="solo «% de lo recuperado»" inputMode="decimal" />}
                  </div>
                </FormularioAccion>
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Comisiones del caso</CardTitle></CardHeader>
        <CardContent>
          {d.comisiones.length === 0 ? (
            <p className="text-sm text-ink-muted">Sin comisiones. Nacen como estimadas al firmar el contrato si el caso tiene vendedor, referidor o socio.</p>
          ) : (
            <Tabla encabezados={["Tipo", "Beneficiario", "Regla", "Monto", "Estado"]}>
              {d.comisiones.map((k) => {
                const [texto, tono] = ESTADO_COMISION[k.estado];
                return (
                  <tr key={k.id} className="border-t border-borde align-top">
                    <td className="py-2 pr-3">{TIPO_COMISION[k.tipo]}</td>
                    <td className="py-2 pr-3">{nombreDe(k.beneficiario_tipo, k.beneficiario_id)}</td>
                    <td className="py-2 pr-3 text-ink-muted">{k.regla_aplicada}</td>
                    <td className="cifra py-2 pr-3 font-medium">{mxn(k.monto)}</td>
                    <td className="py-2"><Badge tono={tono}>{texto}</Badge>{k.fecha_devengo && <span className="ml-1 text-xs text-ink-muted">{corta(k.fecha_devengo)}</span>}</td>
                  </tr>
                );
              })}
            </Tabla>
          )}
        </CardContent>
      </Card>

      {puedeCanal && (
        <Card>
          <CardHeader><CardTitle>Canal</CardTitle><Banknote className="size-5 text-ink-muted" aria-hidden /></CardHeader>
          <CardContent>
            <FormularioAccion accion={guardarCanal.bind(null, caso.id)} etiquetas={{ vendedor_id: "Vendedor" }}>
              <div className="grid gap-3 sm:grid-cols-3">
                <Lista id="vendedor_id" etiqueta="Vendedor" valor={caso.vendedor_id} opciones={d.vendedores} />
                <Lista id="referidor_id" etiqueta="Referidor" valor={caso.referidor_id} opciones={d.referidores} />
                <Lista id="socio_id" etiqueta="Socio licenciatario" valor={caso.socio_id} opciones={d.socios} />
              </div>
              {rol === "director" && <Casilla id="confirmo_doble" etiqueta="Confirmo que vendedor y referidor cobran ambos (si el caso tiene los dos)" />}
            </FormularioAccion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Cifra({ titulo, valor, nota, alerta }: { titulo: string; valor: string; nota: string; alerta?: boolean }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-ink-muted">{titulo}</p>
        <p className={`cifra font-display text-2xl font-semibold ${alerta ? "text-aviso" : "text-ink"}`}>{valor}</p>
        <p className="text-xs text-ink-muted">{nota}</p>
      </CardContent>
    </Card>
  );
}

function Tabla({ encabezados, children }: { encabezados: string[]; children: React.ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[520px] text-sm">
        <thead><tr className="text-left text-xs text-ink-muted">{encabezados.map((e, i) => <th key={i} className="pb-2 pr-3 font-medium">{e}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Lista({ id, etiqueta, valor, opciones }: { id: string; etiqueta: string; valor: string | null; opciones: { id: string; nombre: string }[] }) {
  return (
    <Campo id={id} etiqueta={etiqueta}>
      <select id={id} name={id} defaultValue={valor ?? ""} className={claseSelect}>
        <option value="">Ninguno</option>
        {opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
      </select>
    </Campo>
  );
}
