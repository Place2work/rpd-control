import { CalendarClock, CircleAlert, CircleCheck, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatoFecha, isoDe } from "@/components/rpd/insignia-dia46";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario, prismaSistema } from "@/lib/db/prisma";
import { mxn } from "@/lib/formato";
import { parametrosPension } from "@/lib/parametros";
import type { CasoDetalle } from "@/lib/prospectos/consultas";
import { diasEntre } from "@/lib/reglas/fechas";
import { derechoM40, edadEn, estadoM40, fechasEdad, finConservacion } from "@/lib/reglas/pension";
import { hoyCDMX } from "@/lib/tiempo";
import { guardarPlanM40, registrarPagoM40 } from "../acciones-pension";
import { CampoTexto } from "../campos";
import { FormularioAccion } from "../formulario-accion";

const larga = (iso: string | null) => (iso ? formatoFecha(iso, { dateStyle: "long" }) : "—");
const mesTexto = (iso: string) => new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

// 7.6: fechas que importan para la pensión y el seguimiento mensual de Modalidad 40.
export async function PestanaPension({ caso, sesion }: { caso: CasoDetalle; sesion: Sesion }) {
  const hoy = hoyCDMX();
  const opera = sesion.usuario.rol !== "vendedor";
  const [p, datos, plantilla] = await Promise.all([
    parametrosPension(hoy),
    conUsuario(sesion.claims, async (tx) => ({
      imss: await tx.datosImss.findUnique({ where: { caso_id: caso.id }, select: { regimen: true, fecha_baja: true, semanas_totales: true, semanas_ultimos_5_anios: true } }),
      pagos: opera ? await tx.pagoM40.findMany({ where: { caso_id: caso.id, archivado_at: null }, orderBy: { mes: "asc" } }) : [],
    }), sesion.ip),
    prismaSistema.plantillaMensaje.findUnique({ where: { clave: "RECORDATORIO_M40" } }),
  ]);
  const nac = isoDe(caso.persona.fecha_nacimiento);
  const baja = isoDe(datos.imss?.fecha_baja);
  const semanas = datos.imss?.semanas_totales ? Number(datos.imss.semanas_totales) : null;
  const ult5 = datos.imss?.semanas_ultimos_5_anios ? Number(datos.imss.semanas_ultimos_5_anios) : null;
  const edades = nac ? fechasEdad(nac) : null;
  const m40 = baja ? derechoM40(baja, ult5, p) : null;
  const conserva = baja && semanas && datos.imss?.regimen === "L73" ? finConservacion(baja, semanas, p) : null;
  const pagos = datos.pagos.map((x) => ({ ...x, mesIso: isoDe(x.mes)!, limite: isoDe(x.fecha_limite)!, pagado: isoDe(x.fecha_pago) }));
  const estado = pagos.length ? estadoM40(pagos.map((x) => ({ id: x.id, mes: x.mesIso, fechaLimite: x.limite, fechaPago: x.pagado })), hoy, p) : null;
  const proximo = estado && estado.estado !== "baja" ? estado.proximo : null;
  const wa = caso.persona.whatsapp?.replace("+", "");
  const recordatorio = proximo && plantilla && wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(plantilla.cuerpo.replaceAll("{nombre}", caso.persona.nombre).replaceAll("{mes}", mesTexto(proximo.mes)).replaceAll("{fecha}", larga(proximo.fechaLimite)))}`
    : null;
  const pagados = pagos.filter((x) => x.pagado).length;
  const faltaDias = (iso: string) => { const d = diasEntre(hoy, iso); return d >= 0 ? `faltan ${d} días` : `hace ${-d} días`; };

  const fechas: [string, string | null, string | null][] = [
    ["Edad", nac ? `${edadEn(nac, hoy)} años` : null, nac ? null : "Captura la CURP o la fecha de nacimiento"],
    ["Cumple 60 años", edades ? larga(edades.cumple60) : null, edades ? faltaDias(edades.cumple60) : null],
    ["Cumple 65 años", edades ? larga(edades.cumple65) : null, edades ? faltaDias(edades.cumple65) : null],
    ["Vence el derecho a M40 (baja + 5 años)", m40 ? larga(m40.vence) : null, m40 ? faltaDias(m40.vence) : "Captura la fecha de baja en IMSS y Afore"],
    ["52 semanas en los últimos 5 años", m40?.cumpleSemanas === null || !m40 ? null : m40.cumpleSemanas ? `Sí (${ult5})` : `No (${ult5})`, m40?.cumpleSemanas === null ? "Captúralas abajo" : null],
    ["Ventana sin examen médico (baja + 12 meses)", m40 ? larga(m40.ventanaSinExamen) : null, m40 ? faltaDias(m40.ventanaSinExamen) : null],
    ["Fin de la conservación de derechos (Ley 73)", conserva ? larga(conserva) : null, conserva ? faltaDias(conserva) : datos.imss?.regimen === "L73" ? "Faltan baja y semanas" : "Solo Ley 73"],
    ["Aviso Infonavit (69 años)", edades ? larga(edades.cumple69) : null, edades ? `a los 70 (${larga(edades.cumple70)}) el saldo pasa al Fondo de Pensiones para el Bienestar` : null],
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader><CardTitle>Fechas clave</CardTitle><CalendarClock className="size-5 text-ink-muted" aria-hidden /></CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm">
            {fechas.map(([t, v, nota]) => (
              <div key={t}>
                <dt className="text-xs text-ink-muted">{t}</dt>
                <dd className="text-ink">{v ?? "—"}{nota && <span className="block text-xs text-ink-muted">{nota}</span>}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="grid content-start gap-4 lg:col-span-2">
        {opera && (
          <Card>
            <CardHeader>
              <CardTitle>Modalidad 40</CardTitle>
              {estado && (
                <Badge tono={estado.estado === "al_corriente" ? "pagado" : "critico"}>
                  {estado.estado === "al_corriente" ? "Al corriente" : estado.estado === "atrasado" ? `${estado.vencidos.length} sin pagar` : "Causó baja"}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="grid gap-4">
              {estado?.estado === "baja" && (
                <p className="flex gap-2 rounded-[var(--radius-boton)] bg-critico-tint p-3 text-sm text-critico">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Causó baja el {larga(estado.fechaBaja)} por {p.M40_MESES_BAJA} meses sin pago. Puede reingresar hasta el {larga(estado.reingresoHasta)} pagando lo atrasado con recargos.
                </p>
              )}
              {estado?.estado === "atrasado" && (
                <p className="flex gap-2 rounded-[var(--radius-boton)] bg-critico-tint p-3 text-sm text-critico">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Falta el pago de {mesTexto(estado.vencidos[0].mes)}. Si no se paga el siguiente, causa baja.
                </p>
              )}
              {proximo && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-boton)] bg-brand-tint p-3 text-sm">
                  <span>Próximo pago: <strong>{mesTexto(proximo.mes)}</strong>, vence el {larga(proximo.fechaLimite)} ({faltaDias(proximo.fechaLimite)})</span>
                  {recordatorio && (
                    <a href={recordatorio} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand">
                      <MessageCircle className="size-4" aria-hidden /> Recordar por WhatsApp
                    </a>
                  )}
                </div>
              )}

              {pagos.length > 0 && (
                <div className="-mx-4 overflow-x-auto px-4">
                  <p className="mb-2 text-xs text-ink-muted">{pagados} de {pagos.length} meses pagados · vence el día {p.M40_DIA_LIMITE} {p.M40_PAGO_ADELANTADO ? "del mismo mes (por adelantado)" : "del mes siguiente"}</p>
                  <table className="w-full min-w-[520px] text-sm">
                    <thead><tr className="text-left text-xs text-ink-muted">{["Mes", "Monto", "Vence", "Pago", ""].map((t) => <th key={t} className="pb-2 pr-3 font-medium">{t}</th>)}</tr></thead>
                    <tbody>
                      {pagos.map((x) => {
                        const vencido = !x.pagado && x.limite < hoy;
                        return (
                          <tr key={x.id} className="border-t border-borde align-top">
                            <td className="py-2 pr-3">{mesTexto(x.mesIso)}</td>
                            <td className="cifra py-2 pr-3">{mxn(x.monto)}</td>
                            <td className={`py-2 pr-3 ${vencido ? "font-medium text-critico" : ""}`}>{formatoFecha(x.limite, { dateStyle: "medium" })}</td>
                            <td className="py-2 pr-3">{x.pagado ? <span className="inline-flex items-center gap-1 text-exito-texto"><CircleCheck className="size-4" aria-hidden /> {formatoFecha(x.pagado, { dateStyle: "medium" })}</span> : "—"}</td>
                            <td className="py-2">
                              {!x.pagado && (
                                <details>
                                  <summary className="cursor-pointer text-xs font-medium text-brand">Registrar pago</summary>
                                  <div className="mt-2 w-56">
                                    <FormularioAccion accion={registrarPagoM40.bind(null, caso.id, x.id)} boton="Guardar" etiquetas={{ fecha_pago: "Fecha de pago" }}>
                                      <CampoTexto id="fecha_pago" etiqueta="Fecha de pago" tipo="date" valor={hoy} max={hoy} />
                                    </FormularioAccion>
                                  </div>
                                </details>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <details open={!pagos.length}>
                <summary className="cursor-pointer text-sm font-medium text-brand">{pagos.length ? "Cambiar el plan" : "Programar Modalidad 40"}</summary>
                <div className="mt-3">
                  <FormularioAccion accion={guardarPlanM40.bind(null, caso.id)} boton="Guardar plan"
                    etiquetas={{ m40_desde: "Primer mes", m40_hasta: "Último mes", m40_salario: "Salario diario", m40_monto: "Pago mensual", semanas_ultimos_5_anios: "Semanas últimos 5 años" }}>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <CampoTexto id="m40_desde" etiqueta="Primer mes" tipo="month" valor={isoDe(caso.m40_desde)?.slice(0, 7) ?? ""} />
                      <CampoTexto id="m40_hasta" etiqueta="Último mes" tipo="month" valor={isoDe(caso.m40_hasta)?.slice(0, 7) ?? ""} />
                      <CampoTexto id="m40_monto" etiqueta="Pago mensual" ayuda="lo que cobra el IMSS" inputMode="decimal" valor={caso.m40_monto ? Number(caso.m40_monto) : null} />
                      <CampoTexto id="m40_salario" etiqueta="Salario diario registrado" ayuda="opcional" inputMode="decimal" valor={caso.m40_salario ? Number(caso.m40_salario) : null} />
                      <CampoTexto id="semanas_ultimos_5_anios" etiqueta="Semanas en los últimos 5 años" ayuda={`requisito: ${p.M40_SEMANAS_REQUERIDAS}`} inputMode="decimal" valor={ult5} />
                    </div>
                    <p className="text-xs text-ink-muted">El pago mensual lo calculas con la tasa vigente del IMSS para el año. Al guardar se programa un pago por mes; los meses que salgan del plan y no estén pagados se archivan.</p>
                  </FormularioAccion>
                </div>
              </details>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
