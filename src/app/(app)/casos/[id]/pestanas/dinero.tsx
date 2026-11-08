import { Banknote, CalendarClock, Receipt } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatoFecha, isoDe } from "@/components/rpd/insignia-dia46";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { mxn } from "@/lib/formato";
import type { CasoDetalle } from "@/lib/prospectos/consultas";
import { parametrosDinero, parametrosFechas, parametrosVigentes } from "@/lib/parametros";
import { fechaProximoRetiro } from "@/lib/reglas/alertas";
import { honorariosProyectados, margenCaso, pagosAforePermitidos, pctHonorarioRetiro } from "@/lib/reglas/comisiones";
import { costoVigente } from "@/lib/reglas/costo-alta";
import { hoyCDMX } from "@/lib/tiempo";
import { BotonAccion } from "../../../configuracion/boton-accion";
import { archivarPagoAfore, cambiarFechaPagoAfore, regresarAPagoEsperado, cancelarCobro, guardarCanal, guardarCostoAlta, guardarHonorarioPactado, guardarPagoEsperado, marcarCobrado, registrarCobro, registrarPagoAfore } from "../acciones-dinero";
import { Campo, CampoTexto, claseSelect, Seleccion } from "../campos";
import { Comprobante } from "../comprobante";
import { FormularioAccion } from "../formulario-accion";

const corta = (d: Date | null) => (d ? formatoFecha(isoDe(d)!, { dateStyle: "medium" }) : "—");
const METODOS = [["transferencia", "Transferencia"], ["efectivo", "Efectivo"], ["tarjeta", "Tarjeta"]] as const;
const CONCEPTOS = [["honorario", "Honorario"], ["pago_inicial", "Pago inicial"], ["recuperado", "% de lo recuperado"], ["primera_mensualidad", "Primera mensualidad"]] as const;
const ESTADO_COBRO = { por_cobrar: ["Por cobrar", "espera"], cobrado: ["Cobrado", "pagado"], cancelado: ["Cancelado", "prospecto"] } as const;
const ESTADO_COMISION = { estimada: ["Estimada", "prospecto"], devengada: ["Devengada", "tramite"], pagada: ["Pagada", "pagado"], cancelada: ["Cancelada", "prospecto"] } as const;
const TIPO_COMISION = { vendedor: "Vendedor", referido: "Referidor", socio: "Asesor de pensiones" } as const;

export async function PestanaDinero({ caso, sesion }: { caso: CasoDetalle; sesion: Sesion }) {
  const rol = sesion.usuario.rol;
  if (rol === "vendedor") {
    return <Card><CardContent className="text-sm text-ink-muted">Los pagos y cobros los registra el analista. Tus comisiones están en «Comisiones».</CardContent></Card>;
  }
  const esRetiro = caso.servicio.clave === "RETIRO_DESEMPLEO";
  const [pDinero, { MODALIDAD_B_MENSUALIDADES_MAX }, pf] = await Promise.all([parametrosDinero(), parametrosVigentes(["MODALIDAD_B_MENSUALIDADES_MAX"]), parametrosFechas(hoyCDMX())]);
  const { HONORARIO_RETIRO_PCT } = pDinero;
  const pctTxt = (x: number) => `${+(x * 100).toFixed(2)}%`;
  const pactado = caso.contrato_pct === null ? null : Number(caso.contrato_pct);
  const pct = pctHonorarioRetiro(pactado, { HONORARIO_RETIRO_PCT });
  const puedeCanal = rol === "director" || rol === "asesor";
  const d = await conUsuario(sesion.claims, async (tx) => ({
    pagos: await tx.pagoAfore.findMany({ where: { caso_id: caso.id, archivado_at: null }, orderBy: { numero: "asc" } }),
    modalidad: (await tx.calculo.findFirst({ where: { caso_id: caso.id }, orderBy: { created_at: "desc" }, select: { modalidad_elegida: true } }))?.modalidad_elegida ?? null,
    cobros: await tx.cobro.findMany({ where: { caso_id: caso.id, archivado_at: null }, orderBy: { created_at: "asc" }, include: { pago_afore: { select: { numero: true } } } }),
    comisiones: await tx.comision.findMany({ where: { caso_id: caso.id, archivado_at: null, estado: { not: "cancelada" } }, orderBy: { created_at: "asc" } }),
    referidores: puedeCanal ? await tx.referidor.findMany({ where: { archivado_at: null }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }) : [],
    // Alta de la persona (su primer caso) y vigencias del costo general: solo para el Director.
    alta: rol === "director" ? await tx.caso.findFirst({ where: { persona_id: caso.persona_id, archivado_at: null }, orderBy: { created_at: "asc" }, select: { id: true, folio: true, created_at: true, costo_admin_alta: true } }) : null,
    vigCosto: rol === "director" ? await tx.parametro.findMany({ where: { clave: "COSTO_ADMIN_ALTA" }, select: { valor: true, vigente_desde: true, vigente_hasta: true } }) : [],
    socios: puedeCanal ? await tx.socio.findMany({ where: { archivado_at: null }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }) : [],
  }), sesion.ip);

  const permitidos = pagosAforePermitidos(d.modalidad, Number(MODALIDAD_B_MENSUALIDADES_MAX) || 1);
  const conMensualidades = permitidos > 1;
  const esperado = caso.monto_afore_esperado === null ? null : Number(caso.monto_afore_esperado);
  const proyeccion = honorariosProyectados([{ id: caso.id, etapa: caso.etapa, montoEsperado: esperado, pctPactado: pactado, pagosAfore: d.pagos.length }], pDinero).filas[0];
  const proximo = d.pagos[0] ? fechaProximoRetiro(isoDe(d.pagos[0].fecha_deposito)!, pf) : null;
  const vivos = d.cobros.filter((c) => c.estado !== "cancelado");
  const porCobrar = vivos.filter((c) => c.estado === "por_cobrar");
  const m = margenCaso(vivos.map((c) => ({ honorario: Number(c.honorario_total), iva: Number(c.iva), estado: c.estado })), d.comisiones.map((k) => ({ monto: Number(k.monto), estado: k.estado })));
  const pendiente = porCobrar.reduce((a, c) => a + Number(c.honorario_total), 0);
  const fechaAlta = d.alta ? hoyCDMX(d.alta.created_at) : null;
  const costoGeneral = fechaAlta ? costoVigente(fechaAlta, d.vigCosto.map((v) => ({ desde: isoDe(v.vigente_desde)!, hasta: v.vigente_hasta ? isoDe(v.vigente_hasta) : null, monto: Number(v.valor) }))) : 0;
  const costoPropio = d.alta?.costo_admin_alta == null ? null : Number(d.alta.costo_admin_alta);
  const nombreDe = (tipo: string, id: string) =>
    (tipo === "referidor" ? d.referidores : tipo === "socio" ? d.socios : []).find((x) => x.id === id)?.nombre ?? (tipo === "socio" ? "Asesor de pensiones" : "—");

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
          <CardHeader>
            <CardTitle>Honorario pactado</CardTitle>
            <span className="cifra font-display text-xl font-semibold text-ink">{pctTxt(pct)}</span>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm text-ink-muted">
              {pactado === null ? `Se cobra el ${pctTxt(HONORARIO_RETIRO_PCT)} general (IVA incluido).` : `Negociado con el cliente; el general es ${pctTxt(HONORARIO_RETIRO_PCT)}.`}
              {" "}Aplica a los pagos de la Afore que registres después y sale así en el contrato.
            </p>
            {rol === "director" ? (
              <FormularioAccion accion={guardarHonorarioPactado.bind(null, caso.id)} boton="Guardar porcentaje" etiquetas={{ pct_pactado: "Porcentaje" }}>
                <div className="grid gap-3 sm:grid-cols-3">
                  {/* Siempre viene con el % que hoy aplica a este cliente: solo se cambia si se negoció otro. */}
                  <CampoTexto id="pct_pactado" etiqueta="Porcentaje pactado con el cliente (%)" ayuda="ej. 30 o 26" inputMode="decimal"
                    placeholder={String(+(HONORARIO_RETIRO_PCT * 100).toFixed(2))} valor={+(pct * 100).toFixed(2)} />
                </div>
                {d.pagos.length > 0 && <p className="text-xs text-aviso">Los {d.pagos.length} pagos ya registrados conservan su honorario. Para recalcular uno, corrígelo y regístralo de nuevo.</p>}
              </FormularioAccion>
            ) : (
              <p className="text-xs text-ink-muted">Solo el Director cambia el porcentaje.</p>
            )}
          </CardContent>
        </Card>
      )}

      {d.alta && fechaAlta && (
        <Card>
          <CardHeader>
            <CardTitle>Costo administrativo del alta</CardTitle>
            <span className="cifra font-display text-xl font-semibold text-ink">{mxn(costoPropio ?? costoGeneral)}</span>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm text-ink-muted">
              {costoPropio === null ? `Se usa el general de ${mxn(costoGeneral)} vigente el día del alta.` : `Ajustado para esta persona; el general era ${mxn(costoGeneral)}.`}
              {" "}Se cuenta una vez por persona{d.alta.id !== caso.id ? ` (su alta es ${d.alta.folio}, del ${corta(d.alta.created_at)})` : ""}. No se le cobra al cliente: se descuenta del reparto del asesor de pensiones antes de su %.
            </p>
            <FormularioAccion accion={guardarCostoAlta.bind(null, caso.id)} boton="Guardar costo" etiquetas={{ costo_admin_alta: "Costo" }}>
              <div className="grid gap-3 sm:grid-cols-3">
                <CampoTexto id="costo_admin_alta" etiqueta="Costo de esta alta ($)" ayuda="0 para no contarlo · vacío = el general" inputMode="decimal"
                  placeholder={String(costoGeneral)} valor={costoPropio} />
              </div>
            </FormularioAccion>
          </CardContent>
        </Card>
      )}

      {esRetiro && d.pagos.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pago esperado de la Afore</CardTitle>
            {proyeccion && <span className="text-sm text-ink-muted">honorario proyectado <span className="cifra font-display text-lg font-semibold text-brand">{mxn(proyeccion.honorario)}</span></span>}
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm text-ink-muted">
              {proyeccion
                ? `Cuando la Afore deposite ${mxn(proyeccion.montoEsperado)}, el honorario del ${pctTxt(proyeccion.pct)} será ${mxn(proyeccion.honorario)} (IVA incluido).${caso.fecha_afore_estimada ? ` Depósito estimado: ${corta(caso.fecha_afore_estimada)}.` : ""}`
                : "¿Ya sabes cuánto va a pagar la Afore? Captúralo para ver el honorario proyectado por cobrar. No cuenta como pago hasta que registres el depósito con su fecha."}
            </p>
            {rol !== "socio" && (
              <FormularioAccion accion={guardarPagoEsperado.bind(null, caso.id)} boton={proyeccion ? "Actualizar" : "Guardar monto esperado"}
                etiquetas={{ monto_esperado: "Monto esperado", fecha_estimada: "Fecha estimada" }}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <CampoTexto id="monto_esperado" etiqueta="Monto que pagará la Afore" ayuda="vacío = quitar" inputMode="decimal" placeholder="35,193.00" valor={esperado} />
                  <CampoTexto id="fecha_estimada" etiqueta="Fecha estimada del depósito" ayuda="opcional" tipo="date" valor={isoDe(caso.fecha_afore_estimada) ?? ""} />
                </div>
              </FormularioAccion>
            )}
          </CardContent>
        </Card>
      )}

      {esRetiro && (
        <Card>
          <CardHeader><CardTitle>Pagos de la Afore</CardTitle><span className="text-sm text-ink-muted">{conMensualidades ? `${d.pagos.length} de ${permitidos} mensualidades (modalidad B)` : `${d.pagos.length} de 1 · pago único`}</span></CardHeader>
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
                          <div className="mt-2 grid w-72 gap-4">
                            <FormularioAccion accion={cambiarFechaPagoAfore.bind(null, caso.id, p.id)} boton="Cambiar fecha" etiquetas={{ fecha_deposito: "Fecha del depósito" }}>
                              <CampoTexto id="fecha_deposito" etiqueta="Fecha correcta del depósito" tipo="date" min="2000-01-01" max={hoyCDMX()} valor={isoDe(p.fecha_deposito) ?? ""} />
                            </FormularioAccion>
                            <div className="grid gap-1 border-t border-borde pt-3">
                              <p className="text-xs text-ink-muted">¿La Afore todavía no deposita? El monto vuelve a «Pago esperado» (proyección) y el caso regresa a su etapa anterior.</p>
                              <BotonAccion accion={regresarAPagoEsperado.bind(null, caso.id, p.id)} texto="Regresar a pago esperado"
                                confirmar={`¿Regresar este pago a «pago esperado»? Su honorario por cobrar se cancela y vuelve a proyectarse; el caso regresa a su etapa anterior.`} />
                            </div>
                            <details className="border-t border-borde pt-3">
                              <summary className="cursor-pointer text-xs text-ink-muted">Archivar el pago (registrado por error)</summary>
                              <div className="mt-2">
                                <FormularioAccion accion={archivarPagoAfore.bind(null, caso.id, p.id)} boton="Archivar pago" etiquetas={{ motivo: "Motivo" }}>
                                  <CampoTexto id="motivo" etiqueta="Motivo" />
                                </FormularioAccion>
                              </div>
                            </details>
                          </div>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </Tabla>
            )}
            {d.pagos.length >= permitidos && (
              <p className="rounded-[var(--radius-boton)] bg-exito-tint p-3 text-sm text-exito-texto">
                {conMensualidades ? "Ya están registradas todas las mensualidades." : "Pago de la Afore registrado. El retiro por desempleo se paga una sola vez; si un dato está mal, usa «Corregir»."}
              </p>
            )}
            {proximo && <ProximoRetiro fecha={proximo} anios={pf.ANIOS_CANDADO_RETIRO} deposito={isoDe(d.pagos[0].fecha_deposito)!} />}
            {d.pagos.length < permitidos && (
              <FormularioAccion accion={registrarPagoAfore.bind(null, caso.id)} boton={conMensualidades ? `Registrar mensualidad ${d.pagos.length + 1}` : "Registrar el pago de la Afore"}
                confirmar={d.pagos.length > 0 ? `¿Registrar la mensualidad ${d.pagos.length + 1}? Revisa que sea un depósito nuevo de la Afore, no el mismo de antes.` : undefined}
                etiquetas={{ fecha_deposito: "Fecha del depósito", monto_bruto: "Monto bruto", isr_retenido: "ISR retenido" }}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <CampoTexto id="fecha_deposito" etiqueta="Fecha del depósito" tipo="date" min="2000-01-01" max={hoyCDMX()} />
                  <CampoTexto id="monto_bruto" etiqueta="Monto bruto" inputMode="decimal" placeholder="10,000.00" valor={esperado} />
                  <CampoTexto id="isr_retenido" etiqueta="ISR retenido" ayuda="si hubo" inputMode="decimal" placeholder="0.00" />
                </div>
                <p className="text-xs text-ink-muted">El honorario del {pctTxt(pct)} (IVA incluido) se calcula sobre el depósito y queda por cobrar.</p>
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
                  Subtotal {mxn(c.subtotal)} + IVA {mxn(c.iva)}{c.base_calculo ? ` · ${pctTxt(Number(c.honorario_total) / Number(c.base_calculo))} de ${mxn(c.base_calculo)}` : ""}
                  {c.estado === "cobrado" && ` · cobrado el ${corta(c.fecha_cobro)} por ${c.metodo}${c.referencia ? ` (${c.referencia})` : ""}${c.factura_folio ? ` · factura ${c.factura_folio}` : ""}`}
                  {c.estado === "cancelado" && ` · ${c.motivo_cancelacion}`}
                </p>
                {c.estado !== "cancelado" && <Comprobante casoId={caso.id} cobroId={c.id} tiene={Boolean(c.comprobante_path)} />}
                {c.estado === "cobrado" && !c.comprobante_path && <p className="mt-1 text-xs text-aviso">Falta el comprobante de la transferencia.</p>}
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
            <p className="text-sm text-ink-muted">Sin comisiones. Nacen como estimadas al firmar el contrato si el caso tiene referidor o asesor de pensiones.</p>
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
            <FormularioAccion accion={guardarCanal.bind(null, caso.id)} etiquetas={{ socio_id: "Asesor de pensiones" }}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Lista id="referidor_id" etiqueta="Referidor" valor={caso.referidor_id} opciones={d.referidores} />
                <Lista id="socio_id" etiqueta="Asesor de pensiones" valor={caso.socio_id} opciones={d.socios} />
              </div>
            </FormularioAccion>
            {/* Las listas solo muestran a quien ya está dado de alta: si alguna está vacía, se dice dónde darlo de alta. */}
            {(d.referidores.length === 0 || d.socios.length === 0) && (
              <ul className="mt-3 grid gap-1 text-xs text-ink-muted">
                {d.referidores.length === 0 && (
                  <li>No hay referidores todavía: dalos de alta en <Link href="/comisiones/beneficiarios" className="text-brand underline">Comisiones → Referidores y asesores</Link>.</li>
                )}
                {d.socios.length === 0 && (
                  <li>No hay asesores de pensiones todavía: dalos de alta en <Link href="/comisiones/beneficiarios" className="text-brand underline">Comisiones → Referidores y asesores</Link>.</li>
                )}
              </ul>
            )}
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

/** Leyenda al terminar el retiro: cuándo puede volver a retirar el cliente (art. 191-II). */
export function ProximoRetiro({ fecha, anios, deposito }: { fecha: string; anios: number; deposito: string }) {
  return (
    <div role="note" className="flex gap-3 rounded-[var(--radius-boton)] border border-brand/30 bg-brand-tint p-3 text-sm">
      <CalendarClock className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
      <div>
        <p className="font-medium text-ink">Próximo retiro por desempleo de este cliente: a partir del {formatoFecha(fecha, { dateStyle: "long" })}</p>
        <p className="text-ink-muted">Solo se puede retirar una vez cada {anios} años; se cuenta desde el depósito de la Afore del {formatoFecha(deposito, { dateStyle: "long" })}. Te avisaremos un mes antes para volver a contactarlo.</p>
      </div>
    </div>
  );
}
