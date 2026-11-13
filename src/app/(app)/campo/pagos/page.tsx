import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BarChart3, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { exigirRol } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { liquidacionesDe, tarifasCampo } from "@/lib/campo/datos";
import { panelFinanciero, semanaCerrada, sumarPaneles, type PanelFinanciero } from "@/lib/reglas/campo";
import { mxn } from "@/lib/formato";
import { hoyCDMX } from "@/lib/tiempo";
import { CampoTexto } from "../../casos/[id]/campos";
import { FormularioAccion } from "../../casos/[id]/formulario-accion";
import { ajustarPagoDia, pagarSemanaCampo } from "../acciones";
import { programarParametro } from "../../configuracion/acciones";

const plural = (k: number, uno: string, varios: string) => `${k} ${k === 1 ? uno : varios}`;
export const metadata: Metadata = { title: "Pagos de campo" };
const pesos = (cent: number) => mxn(cent / 100);
const dia = (iso: string) => new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const isoDb = (d: Date) => d.toISOString().slice(0, 10);

// Pagos semanales del gerente de campo: lo verificado y aprobado de lunes a domingo se paga el miércoles siguiente.
export default async function PagosCampo() {
  const s = await exigirRol("director");
  const hoy = hoyCDMX();
  const tarifa = await tarifasCampo(hoy);
  const d = await conUsuario(s.claims, async (tx) => {
    const gerentes = await tx.usuario.findMany({ where: { OR: [
      { rol: "campo", archivado_at: null },
      // Quien dejó de ser gerente de campo pero tiene algo verificado o aprobado sin pagar: no se pierde su dinero.
      { campo_prospectos: { some: { estado: "verificado", pago_id: null, archivado_at: null } } },
      { campo_jornadas: { some: { estado: "aprobada", pago_id: null } } },
    ] }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, activo: true } });
    return {
      gerentes: await Promise.all(gerentes.map(async (g) => ({
        ...g,
        liquidaciones: await liquidacionesDe(tx, g.id, tarifa.diasParaPago),
        dias: await tx.campoJornada.findMany({ where: { gerente_id: g.id, estado: "aprobada", pago_id: null }, orderBy: { fecha: "asc" },
          select: { id: true, fecha: true, municipio: true, lugar: true, monto_cent: true } }),
        pendientes: await tx.campoProspecto.count({ where: { gerente_id: g.id, estado: "pendiente", archivado_at: null } }),
        totales: await tx.campoProspecto.groupBy({ by: ["estado"], where: { gerente_id: g.id, archivado_at: null }, _count: { _all: true } }),
        todos: await tx.campoProspecto.findMany({ where: { gerente_id: g.id, archivado_at: null }, select: { estado: true, monto_cent: true, pago_id: true, fecha_registro: true } }),
        jornadas: await tx.campoJornada.findMany({ where: { gerente_id: g.id }, select: { estado: true, monto_cent: true, pago_id: true } }),
        pagosG: await tx.campoPago.findMany({ where: { gerente_id: g.id }, select: { fecha_pago: true, total_cent: true } }),
      }))),
      pagos: await tx.campoPago.findMany({ orderBy: { fecha_pago: "desc" }, take: 30, select: { id: true, fecha_pago: true, semana_inicio: true, semana_fin: true, prospectos: true, dias: true, total_cent: true, referencia: true, gerente: { select: { nombre: true } } } }),
    };
  }, s.ip);

  // Panel financiero: por gerente y el total.
  const paneles = d.gerentes.map((g) => ({ id: g.id, nombre: g.nombre, panel: panelFinanciero(
    g.todos.map((p) => ({ estado: p.estado, montoCent: p.monto_cent === null ? null : Number(p.monto_cent), pagada: !!p.pago_id, fechaRegistro: isoDb(p.fecha_registro) })),
    g.jornadas.map((j) => ({ estado: j.estado, montoCent: j.monto_cent === null ? null : Number(j.monto_cent), pagada: !!j.pago_id })),
    g.pagosG.map((x) => ({ fechaPago: isoDb(x.fecha_pago), totalCent: Number(x.total_cent) })),
    g.liquidaciones, tarifa, hoy) }));
  const total = sumarPaneles(paneles.map((x) => x.panel));

  return (
    <>
      <Encabezado titulo="Pagos de campo" descripcion={`Tarifas vigentes: ${pesos(tarifa.prospectoCent)} por prospecto verificado y ${pesos(tarifa.diaCent)} por día con foto aprobada. Lo de lunes a domingo se paga el miércoles siguiente.`}>
        <Link href="/campo/revisar" className="inline-flex items-center gap-1.5 text-sm text-brand underline"><ArrowLeft className="size-4" aria-hidden /> Prospectos de campo</Link>

      </Encabezado>
      <div className="grid gap-4">
        <PanelFinancieroCampo total={total} paneles={paneles} />
        <Card>
          <CardHeader><CardTitle>Tarifas</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm lg:grid-cols-2">
            {([
              ["CAMPO_PAGO_PROSPECTO", "Pago por prospecto verificado", tarifa.prospectoCent, "Aplica a los prospectos levantados desde esa fecha; lo anterior conserva su tarifa."],
              ["CAMPO_PAGO_DIA", "Pago base por día", tarifa.diaCent, "Es el monto que trae cada día al aprobarlo; ahí puedes cambiarlo según la ubicación."],
            ] as const).map(([clave, titulo, cent, ayuda]) => (
              <FormularioAccion key={clave} accion={programarParametro.bind(null, clave)} boton="Guardar tarifa" etiquetas={{ valor: "Monto", vigente_desde: "Desde" }} className="grid gap-2 rounded-[var(--radius-boton)] border border-borde p-3">
                <p className="font-medium text-ink">{titulo}: <span className="font-display">{pesos(cent)}</span></p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <CampoTexto id="valor" etiqueta="Monto nuevo (pesos)" inputMode="decimal" valor={(cent / 100).toFixed(2)} />
                  <CampoTexto id="vigente_desde" etiqueta="Desde" tipo="date" valor={hoy} min={hoy} />
                </div>
                <p className="text-xs text-ink-muted">{ayuda}</p>
              </FormularioAccion>
            ))}
          </CardContent>
        </Card>
        {d.gerentes.length === 0 && <Card><CardContent className="pt-5 text-sm text-ink-muted">Todavía no hay gerentes de campo. Dalos de alta en Configuración → Usuarios con el rol «Gerente de campo».</CardContent></Card>}
        {d.gerentes.map((g) => {
          const porEstado = (e: string) => g.totales.find((t) => t.estado === e)?._count._all ?? 0;
          return (
            <Card key={g.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Wallet className="size-5 text-brand" aria-hidden /> {g.nombre}</CardTitle>
                {!g.activo && <Badge tono="critico">Inactivo</Badge>}
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <p className="text-ink-muted">{porEstado("verificado")} verificados · {g.pendientes} por verificar · {porEstado("rechazado")} no cuentan</p>
                {g.liquidaciones.length === 0 ? <p className="text-ink-muted">Nada pendiente de pago.</p> : g.liquidaciones.map((l) => {
                  const cerrada = semanaCerrada(l, hoy);
                  return (
                    <div key={l.semanaFin} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-boton)] border border-borde p-3">
                      <div>
                        <p className="font-medium text-ink">Semana del {dia(l.semanaInicio)} al {dia(l.semanaFin)} · se paga el {dia(l.fechaPago)}</p>
                        <p className="text-xs text-ink-muted">{plural(l.prospectos.length, "prospecto", "prospectos")} ({pesos(l.montoProspectosCent)}) · {plural(l.dias.length, "día", "días")} ({pesos(l.montoDiasCent)})</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-display text-xl font-semibold text-ink">{pesos(l.totalCent)}</span>
                        {cerrada ? (
                          <FormularioAccion accion={pagarSemanaCampo.bind(null, g.id, l.semanaFin)} boton="Marcar como pagado" confirmar={`¿Registrar el pago de ${pesos(l.totalCent)} a ${g.nombre}?`} className="flex flex-wrap items-end gap-2">
                            <CampoTexto id="referencia" etiqueta="Referencia (opcional)" placeholder="Transferencia 123456" />
                          </FormularioAccion>
                        ) : <Badge tono="espera">Semana en curso</Badge>}
                      </div>
                      {l.dias.length > 0 && (
                        <div className="grid w-full gap-2 border-t border-borde pt-3">
                          <p className="text-xs text-ink-muted">Pago por día (puedes cambiarlo según la ubicación antes de pagar):</p>
                          {g.dias.filter((x) => l.dias.includes(x.id)).map((x) => (
                            <FormularioAccion key={x.id} accion={ajustarPagoDia.bind(null, x.id)} boton="Guardar" etiquetas={{ monto: "Pago" }} className="flex flex-wrap items-end gap-2">
                              <span className="min-w-48 self-center text-sm text-ink">{dia(isoDb(x.fecha))} · {x.lugar}, {x.municipio}</span>
                              <CampoTexto id="monto" etiqueta="Pago (pesos)" inputMode="decimal" valor={(Number(x.monto_cent ?? 0) / 100).toFixed(2)} />
                            </FormularioAccion>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}

        <Card>
          <CardHeader><CardTitle>Pagos registrados</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {d.pagos.length === 0 ? <p className="text-ink-muted">Todavía no hay pagos.</p> : (
              <ul className="divide-y divide-borde">
                {d.pagos.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span><span className="font-medium text-ink">{p.gerente.nombre}</span> <span className="text-xs text-ink-muted">· semana del {dia(isoDb(p.semana_inicio))} al {dia(isoDb(p.semana_fin))} · pagado el {dia(isoDb(p.fecha_pago))}{p.referencia ? ` · ${p.referencia}` : ""}</span>
                      <span className="block text-xs text-ink-muted">{plural(p.prospectos, "prospecto", "prospectos")} · {plural(p.dias, "día", "días")}</span></span>
                    <span className="cifra font-medium text-ink">{pesos(Number(p.total_cent))}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Cifra({ titulo, valor, detalle, tono = "ink" }: { titulo: string; valor: string; detalle?: string; tono?: "ink" | "exito" | "brand" }) {
  const color = { ink: "text-ink", exito: "text-exito-texto", brand: "text-brand" }[tono];
  return (
    <div className="rounded-[var(--radius-boton)] border border-borde p-3">
      <p className="text-xs text-ink-muted">{titulo}</p>
      <p className={`font-display text-2xl font-semibold ${color}`}>{valor}</p>
      {detalle && <p className="text-xs text-ink-muted">{detalle}</p>}
    </div>
  );
}

function PanelFinancieroCampo({ total: t, paneles }: { total: PanelFinanciero; paneles: { id: string; nombre: string; panel: PanelFinanciero }[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="size-5 text-brand" aria-hidden /> Panel financiero</CardTitle></CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Cifra titulo="Por pagar (ya verificado)" tono="exito" valor={pesos(t.porPagar.cent)} detalle={`${plural(t.porPagar.prospectos, "prospecto", "prospectos")} · ${plural(t.porPagar.dias, "día", "días")}`} />
          <Cifra titulo="Próximo pago" valor={t.proximoPago ? pesos(t.proximoPago.cent) : "—"} detalle={t.proximoPago ? `se paga el ${dia(t.proximoPago.fecha)}` : "Nada pendiente"} />
          <Cifra titulo="En revisión (si se verifica)" valor={pesos(t.enRevision.centEstimado)} detalle={`${plural(t.enRevision.prospectos, "prospecto", "prospectos")} · ${plural(t.enRevision.dias, "día", "días")} por aprobar`} />
          <Cifra titulo="Proyección total por pagar" tono="brand" valor={pesos(t.proyeccionCent)} detalle="Por pagar + en revisión" />
          <Cifra titulo="Prospectos esta semana" valor={String(t.prospectos.semana)} detalle={`${t.prospectos.mes} este mes · ${t.prospectos.total} en total`} />
          <Cifra titulo="Verificados" valor={String(t.prospectos.verificados)} detalle={`${t.prospectos.pendientes} por verificar · ${t.prospectos.rechazados} no cuentan`} />
          <Cifra titulo="Tasa de verificación" valor={t.tasaVerificacion === null ? "—" : `${t.tasaVerificacion}%`} detalle="De los revisados, cuántos eran reales" />
          <Cifra titulo="Pagado" valor={pesos(t.pagado.mesCent)} detalle={`este mes · ${pesos(t.pagado.totalCent)} acumulado${t.costoPorVerificadoCent !== null ? ` · ${pesos(t.costoPorVerificadoCent)} por verificado` : ""}`} />
        </div>
        {paneles.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs text-ink-muted">
                <tr className="border-b border-borde">
                  <th className="py-2 pr-3 font-medium">Gerente</th><th className="py-2 pr-3 font-medium">Semana</th><th className="py-2 pr-3 font-medium">Mes</th>
                  <th className="py-2 pr-3 font-medium">Verificados</th><th className="py-2 pr-3 font-medium">Por verificar</th>
                  <th className="py-2 pr-3 text-right font-medium">Por pagar</th><th className="py-2 pr-3 text-right font-medium">En revisión</th>
                  <th className="py-2 pr-3 text-right font-medium">Proyección</th><th className="py-2 text-right font-medium">Pagado</th>
                </tr>
              </thead>
              <tbody>
                {paneles.map(({ id, nombre, panel: p }) => (
                  <tr key={id} className="border-b border-borde last:border-0">
                    <td className="py-2 pr-3 text-ink">{nombre}</td><td className="py-2 pr-3">{p.prospectos.semana}</td><td className="py-2 pr-3">{p.prospectos.mes}</td>
                    <td className="py-2 pr-3">{p.prospectos.verificados}</td><td className="py-2 pr-3">{p.prospectos.pendientes}</td>
                    <td className="py-2 pr-3 text-right font-medium text-exito-texto">{pesos(p.porPagar.cent)}</td><td className="py-2 pr-3 text-right">{pesos(p.enRevision.centEstimado)}</td>
                    <td className="py-2 pr-3 text-right font-medium text-brand">{pesos(p.proyeccionCent)}</td><td className="py-2 text-right">{pesos(p.pagado.totalCent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-ink-muted">«En revisión» es un estimado con la tarifa vigente; los días, con el pago base. Lo verificado conserva el monto con el que se verificó.</p>
      </CardContent>
    </Card>
  );
}
