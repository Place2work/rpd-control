import { CalendarClock, Filter, LineChart } from "lucide-react";
import { GraficaBarras } from "@/components/rpd/grafica-barras";
import { movimientosDelMes } from "@/lib/cerrados/consultas";
import { cifrasHoy } from "@/lib/dinero/consultas";
import { embudoDelMes } from "@/lib/reglas/cerrados";
import { mxn } from "@/lib/formato";
import type { Metadata } from "next";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { EstadoVacio } from "@/components/rpd/estado-vacio";
import Link from "next/link";
import { formatoFecha } from "@/components/rpd/insignia-dia46";
import { misAlertas } from "@/lib/alertas/consultas";
import { obtenerSesion } from "@/lib/auth/sesion";
import { parametrosFechas } from "@/lib/parametros";
import { ETAPAS_PROSPECTO, listarCasos, nombreCompleto } from "@/lib/prospectos/consultas";
import { fechaElegibleDesempleo } from "@/lib/reglas/fechas";
import { hoyCDMX } from "@/lib/tiempo";
import { Bandeja } from "./bandeja";

export const metadata: Metadata = { title: "Hoy" };

const EN_TRAMITE = new Set(["CONTRATO", "EXPEDIENTE", "INGRESADA", "RESOLUCION"]);
// Antes del contrato es cuando importa avisar del día 46.
const ANTES_DE_INGRESAR = new Set([...ETAPAS_PROSPECTO, "CONTRATO", "EXPEDIENTE"]);

export default async function Hoy() {
  const sesion = await obtenerSesion();
  const { usuario } = sesion;
  const hoy = hoyCDMX();
  // El vendedor no ve dinero (10.6); para él la fila de indicadores solo lleva el embudo.
  const veDinero = usuario.rol !== "vendedor";
  const [casos, p, alertas, dinero, mov] = await Promise.all([
    listarCasos(sesion), parametrosFechas(hoy), misAlertas(sesion), veDinero ? cifrasHoy(sesion, hoy.slice(0, 7)) : null,
    movimientosDelMes(sesion, hoy.slice(0, 7)),
  ]);

  // Próximos día 46 (10.1): retiros que aún no se ingresan, con fecha de baja, en los próximos 14 días.
  const proximos = casos
    .filter((c) => c.servicio.clave === "RETIRO_DESEMPLEO" && ANTES_DE_INGRESAR.has(c.etapa) && c.datos_imss?.fecha_baja)
    .map((c) => ({ c, d: fechaElegibleDesempleo(c.datos_imss!.fecha_baja!.toISOString().slice(0, 10), hoy, p) }))
    .filter(({ d }) => d.diasFaltan <= 14)
    .sort((a, b) => a.d.fecha.localeCompare(b.d.fecha));

  // 10.1: fila de indicadores. Cada uno lleva a la pantalla donde se trabaja.
  const slaEnRiesgo = new Set(alertas.filter((a) => a.regla.startsWith("SLA_15")).map((a) => a.casoId)).size;
  const INDICADORES: { t: string; v: string; nota?: string; liga?: string }[] = [
    { t: "Prospectos activos", v: String(casos.filter((c) => ETAPAS_PROSPECTO.includes(c.etapa)).length), liga: "/prospectos" },
    { t: "Casos en trámite", v: String(casos.filter((c) => EN_TRAMITE.has(c.etapa)).length), liga: "/casos" },
    { t: "Listos para retirar esta semana", v: String(proximos.filter(({ d }) => d.diasFaltan <= 7).length) },
    { t: "Clientes cerrados del mes", v: String(casos.filter((c) => c.etapa === "CERRADO" && hoyCDMX(c.etapa_desde).slice(0, 7) === hoy.slice(0, 7)).length),
      nota: `${casos.filter((c) => c.etapa === "CERRADO").length} en total`, liga: "/clientes-cerrados" },
    { t: "SLA en riesgo", v: String(slaEnRiesgo), nota: "casos con alerta de 15 días hábiles", liga: "#alertas" },
    ...(dinero ? [
      { t: "Monto retirado del mes", v: mxn(dinero.depositadoMes), nota: "depósitos netos de la Afore", liga: "/dinero" },
      { t: "Honorarios cobrados del mes", v: mxn(dinero.cobradoMes), nota: "con IVA", liga: "/dinero" },
      { t: "Por cobrar", v: mxn(dinero.porCobrar), nota: `${dinero.cobrosPendientes} ${dinero.cobrosPendientes === 1 ? "cobro" : "cobros"}`, liga: "/dinero" },
      { t: "Comisiones por pagar", v: mxn(dinero.comisionesPorPagar), nota: `${dinero.comisionesPendientes} devengadas`, liga: "/comisiones" },
    ] : []),
  ];

  // Embudo del mes: retiros dados de alta este mes según la etapa a la que han llegado.
  const delMes = casos.filter((c) => c.servicio.embudo === "retiro" && hoyCDMX(c.created_at).slice(0, 7) === hoy.slice(0, 7));
  // Lo que pasó en el mes (altas, etapas alcanzadas y pagos de la Afore), aunque el caso sea de otro mes.
  const em = embudoDelMes(delMes.length, mov.movimientos, mov.pagos);
  const EMBUDO = [
    { etiqueta: "Altas", valor: em.altas },
    { etiqueta: "Precalificados", valor: em.precalificados },
    { etiqueta: "Contratos", valor: em.contratos },
    { etiqueta: "Pagados por la Afore", valor: em.pagados, monto: veDinero ? em.retirado : null },
  ];
  const maxEmbudo = Math.max(...EMBUDO.map((e) => e.valor));
  const ingresos = dinero ? [...dinero.meses].reverse().map((m) => ({ etiqueta: m.mes.slice(2).replace("-", "/"), valor: m.total })) : [];

  const fecha = new Intl.DateTimeFormat("es-MX", { dateStyle: "full", timeZone: "America/Mexico_City" })
    .format(new Date(`${hoy}T12:00:00-06:00`));
  return (
    <>
      <Encabezado titulo={`Hola, ${usuario.nombre.split(" ")[0]}`} descripcion={fecha.charAt(0).toUpperCase() + fecha.slice(1)} />
      <section aria-label="Indicadores" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-3">
        {INDICADORES.map(({ t, v, nota, liga }) => {
          const contenido = (
            <>
              <p className="text-xs text-ink-muted">{t}</p>
              <p className="cifra mt-1 font-display text-[22px] font-semibold text-ink">{v}</p>
              {nota && <p className="text-xs text-ink-muted">{nota}</p>}
            </>
          );
          return (
            <Card key={t} className="p-0">
              {liga ? <Link href={liga} className="block h-full rounded-[inherit] p-4 hover:bg-brand-tint/40">{contenido}</Link> : <div className="p-4">{contenido}</div>}
            </Card>
          );
        })}
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader id="alertas">
            <CardTitle>Alertas de hoy</CardTitle>
            {alertas.length > 0 && <span className="cifra text-sm text-ink-muted">{alertas.length}</span>}
          </CardHeader>
          <div className="pt-3"><Bandeja alertas={alertas} esDirector={usuario.rol === "director"} /></div>
        </Card>
        <Card>
          <CardHeader><CardTitle>Próximos día 46</CardTitle></CardHeader>
          {proximos.length === 0 ? (
            <EstadoVacio icono={CalendarClock} titulo="Nadie en cuenta regresiva"
              texto="Cuando captures la fecha de baja de un prospecto, verás aquí cuántos días le faltan para poder retirar." />
          ) : (
            <ul className="divide-y divide-borde pb-2">
              {proximos.map(({ c, d }) => (
                <li key={c.id}>
                  <Link href={`/casos/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-brand-tint/40">
                    <span className={`cifra flex size-11 shrink-0 flex-col items-center justify-center rounded-lg font-display text-lg font-semibold leading-none ${d.yaPuede ? "bg-exito-tint text-exito-texto" : "bg-aviso-tint text-aviso"}`}>
                      {d.yaPuede ? "✓" : d.diasFaltan}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{nombreCompleto(c.persona)}</span>
                      <span className="block text-xs text-ink-muted">
                        {d.yaPuede ? "Ya puede retirar" : `${d.diasFaltan === 1 ? "Falta 1 día" : `Faltan ${d.diasFaltan} días`} · ${formatoFecha(d.fecha)}`}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader><CardTitle>Embudo del mes</CardTitle></CardHeader>
          {maxEmbudo === 0 ? (
            <EstadoVacio icono={Filter} titulo="Aún no hay movimiento" texto="Aquí verás las altas del mes y cuántos retiros llegan a precalificado, contrato y pago." />
          ) : (
            <div className="grid gap-3 px-5 pb-5 pt-2">
              <ul className="grid gap-2">
                {EMBUDO.map((e, i) => (
                  <li key={e.etiqueta} className="grid gap-1">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="text-ink">{e.etiqueta}</span>
                      <span className="cifra text-ink-muted">{e.valor}{e.monto ? ` · ${mxn(e.monto)}` : ""}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100" aria-hidden>
                      <div className={`h-2 rounded-full ${i === EMBUDO.length - 1 ? "bg-exito" : "bg-brand"}`} style={{ width: `${(e.valor / maxEmbudo) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              {dinero && (
                <dl className="grid grid-cols-2 gap-3 border-t border-borde pt-3 text-sm">
                  <div><dt className="text-xs text-ink-muted">Monto retirado</dt><dd className="cifra font-display text-lg font-semibold text-ink">{mxn(dinero.depositadoMes)}</dd></div>
                  <div><dt className="text-xs text-ink-muted">Honorario cobrado</dt><dd className="cifra font-display text-lg font-semibold text-exito-texto">{mxn(dinero.cobradoMes)}</dd></div>
                </dl>
              )}
              <p className="text-xs text-ink-muted">Cuenta lo que pasó este mes, aunque el caso se haya dado de alta antes.</p>
            </div>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Ingresos de los últimos 12 meses</CardTitle></CardHeader>
          {ingresos.some((m) => m.valor > 0) ? (
            <div className="px-5 pb-5 pt-2">
              <GraficaBarras formato="pesos" color="exito" datos={ingresos} />
              <p className="mt-2 text-xs text-ink-muted">Honorarios cobrados con IVA. El detalle por mes está en <Link href="/dinero" className="text-brand underline">Dinero</Link>.</p>
            </div>
          ) : (
            <EstadoVacio icono={LineChart} titulo="Sin honorarios cobrados" texto={veDinero ? "Aquí verás los honorarios cobrados por mes." : "Los ingresos solo los ven el Director, los asesores y los socios."} />
          )}
        </Card>
      </div>
    </>
  );
}
