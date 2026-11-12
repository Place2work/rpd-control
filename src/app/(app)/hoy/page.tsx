import { CalendarClock, Filter, LineChart } from "lucide-react";
import { GraficaBarras } from "@/components/rpd/grafica-barras";
import { GraficaCascada, GraficaFlujo } from "@/components/rpd/grafica-finanzas";
import { cascadaGanancia, flujoHonorarios } from "@/lib/reglas/finanzas";
import { movimientosDelMes } from "@/lib/cerrados/consultas";
import { cifrasHoy, proyecciones } from "@/lib/dinero/consultas";
import { altasYCostos } from "@/lib/dinero/costo-alta";
import { comisionesProyectadas } from "@/lib/comisiones/proyectadas";
import { costoAdministrativo } from "@/lib/reglas/costo-alta";
import { gananciaProyectada } from "@/lib/reglas/comisiones";
import { embudoDelMes } from "@/lib/reglas/cerrados";
import { mxn } from "@/lib/formato";
import type { Metadata } from "next";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { EstadoVacio } from "@/components/rpd/estado-vacio";
import Link from "next/link";
import { conUsuario } from "@/lib/db/prisma";
import { avanceDe } from "@/lib/academia/motor";
import { formatoFecha } from "@/components/rpd/insignia-dia46";
import { misAlertas } from "@/lib/alertas/consultas";
import { obtenerSesion } from "@/lib/auth/sesion";
import { parametrosDinero, parametrosFechas } from "@/lib/parametros";
import { ETAPAS_PROSPECTO, listarCasos, nombreCompleto } from "@/lib/prospectos/consultas";
import { diasEntre, fechasRetiroDesempleo } from "@/lib/reglas/fechas";
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
  const [costos, proy, comProy, pDinero] = veDinero ? await Promise.all([altasYCostos(sesion), proyecciones(sesion), comisionesProyectadas(sesion), parametrosDinero(hoy)]) : [null, null, null, null];
  // Correos del IMSS que no se pudieron ligar solos a un caso (bandeja para el Director y el analista).
  const correosImss = usuario.rol === "director" || usuario.rol === "asesor"
    ? await conUsuario(sesion.claims, (tx) => tx.correoEntrante.count({ where: { estado: "sin_caso", archivado_at: null } }), sesion.ip).catch(() => 0) : 0;
  // Academia: obligatoria para el asesor de pensiones; se le recuerda hasta que termine la Inducción (N0).
  const sinInduccion = usuario.rol === "socio" ? !(await avanceDe(usuario.id).then((a) => a.certificadas.has("N0")).catch(() => true)) : false;
  const costoAlta = costos ? costoAdministrativo(costos.altas, costos.vigencias, { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy }) : null;
  // Total de todas las altas (cada una con el costo vigente el día de su alta); no baja aunque el cliente pague.
  const costoTotal = costos ? costoAdministrativo(costos.altas, costos.vigencias) : null;

  // Próximos día 46 (10.1): retiros que aún no se ingresan, con fecha de baja, en los próximos 14 días.
  const proximos = casos
    .filter((c) => c.servicio.clave === "RETIRO_DESEMPLEO" && ANTES_DE_INGRESAR.has(c.etapa) && c.datos_imss?.fecha_baja)
    .map((c) => {
      const f = fechasRetiroDesempleo(c.datos_imss!.fecha_baja!.toISOString().slice(0, 10), hoy, p);
      return { c, d: f.legal, f };
    })
    // Hasta que el trámite quede listo (46 + días administrativos) y una semana después.
    .filter(({ d, f }) => d.diasFaltan <= 14 && diasEntre(f.tramite.fecha, hoy) <= 7)
    .sort((a, b) => a.d.fecha.localeCompare(b.d.fecha));

  // Ganancia proyectada: lo ya cobrado (desde el inicio, p. ej. clientes cerrados) + lo por cobrar + lo proyectado
  // − comisiones (pagadas y proyectadas por pagar) − costo administrativo total de las altas.
  const cents = (x: number) => Math.round(x * 100);
  const honorariosProy = dinero && proy ? (cents(proy.total) + cents(dinero.porCobrar)) / 100 : 0;
  const honorariosTodos = dinero ? (cents(honorariosProy) + cents(dinero.cobradoTotal)) / 100 : 0;
  const comisionesTodas = dinero && comProy ? (cents(comProy.total) + cents(dinero.comisionesPagadas)) / 100 : 0;
  const ganancia = dinero && comProy && costoTotal ? gananciaProyectada({ honorarios: honorariosTodos, comisiones: comisionesTodas, costoAltas: costoTotal.total, iva: pDinero?.IVA ?? 0,
    comisionesAsesor: (comProy.filas.filter((f) => f.tipo === "socio").reduce((a, f) => a + cents(f.monto), 0) + cents(dinero.comisionesPagadasAsesor)) / 100 }) : null;
  // Gráficas de finanzas (Director): cascada de la ganancia y honorarios por mes (cobrados y proyectados).
  const cascada = dinero && ganancia ? cascadaGanancia({ cobrado: dinero.cobradoTotal, proyectado: honorariosProy, comisiones: comisionesTodas, altas: costoTotal?.total ?? 0 }) : null;
  const flujo = dinero && proy ? flujoHonorarios({ hoy, cobradosPorMes: dinero.meses.map((m) => ({ mes: m.mes, total: m.total })), porCobrar: dinero.porCobrar,
    proyectados: proy.filas.map((f) => ({ fecha: f.fechaEstimada, honorario: f.honorario })) }) : null;
  // Tabla por beneficiario: casos por familia de servicio (retiro, pensiones, otros) + montos de los retiros.
  const filasBenef = comProy ? [...new Set([...comProy.conteos.map((c) => c.clave), ...comProy.porBeneficiario.map((b) => b.clave)])].map((clave) => {
    const c = comProy.conteos.find((x) => x.clave === clave);
    const b = comProy.porBeneficiario.find((x) => x.clave === clave);
    const devengado = comProy.filas.filter((f) => f.clave === clave && f.origen === "devengada").reduce((a, f) => a + Math.round(f.monto * 100), 0) / 100;
    const total = b?.monto ?? 0;
    return { clave, nombre: c?.nombre ?? b!.nombre, tipo: c?.tipo ?? b!.tipo, retiro: c?.retiro ?? 0, pensiones: c?.pensiones ?? 0, otros: c?.otros ?? 0,
      devengado, proyectado: (Math.round(total * 100) - Math.round(devengado * 100)) / 100, total };
  }).sort((x, y) => y.total - x.total || y.retiro + y.pensiones - (x.retiro + x.pensiones)) : [];
  const conOtros = filasBenef.some((f) => f.otros > 0);
  const esAsesor = usuario.rol === "socio";
  const misPensiones = comProy?.conteos.reduce((a, c) => a + c.pensiones, 0) ?? 0;
  // 10.1: fila de indicadores. Cada uno lleva a la pantalla donde se trabaja.
  const slaEnRiesgo = new Set(alertas.filter((a) => a.regla.startsWith("SLA_15")).map((a) => a.casoId)).size;
  const INDICADORES: { t: string; v: string; nota?: string; liga?: string; destacado?: boolean }[] = [
    { t: esAsesor ? "Mis prospectos activos" : "Prospectos activos", v: String(casos.filter((c) => ETAPAS_PROSPECTO.includes(c.etapa)).length), liga: "/prospectos" },
    { t: esAsesor ? "Mis casos en trámite" : "Casos en trámite", v: String(casos.filter((c) => EN_TRAMITE.has(c.etapa)).length), liga: "/casos" },
    { t: "Listos para retirar esta semana", v: String(proximos.filter(({ d }) => d.diasFaltan <= 7).length) },
    { t: esAsesor ? "Mis clientes cerrados del mes" : "Clientes cerrados del mes", v: String(casos.filter((c) => c.etapa === "CERRADO" && hoyCDMX(c.etapa_desde).slice(0, 7) === hoy.slice(0, 7)).length),
      nota: `${casos.filter((c) => c.etapa === "CERRADO").length} en total`, liga: "/clientes-cerrados" },
    { t: "SLA en riesgo", v: String(slaEnRiesgo), nota: "casos con alerta de 15 días hábiles", liga: "#alertas" },
    // Asesor de pensiones: su pantalla habla de SUS comisiones, no de los honorarios de la empresa.
    ...(dinero && esAsesor ? [
      { t: "Retiros de mis clientes del mes", v: mxn(dinero.depositadoMes), nota: "depósitos netos de la Afore", liga: "/clientes-cerrados" },
      { t: "Mis comisiones por cobrar", v: mxn(comProy?.devengado ?? 0), liga: "/comisiones",
        nota: "ya entró el dinero del cliente; se te paga en la liquidación del mes" },
      { t: "Mis comisiones proyectadas", v: mxn(comProy ? (Math.round(comProy.total * 100) - Math.round(comProy.devengado * 100)) / 100 : 0), liga: "/comisiones#proyectadas",
        nota: comProy && comProy.casos ? `${comProy.casos} ${comProy.casos === 1 ? "caso" : "casos"} · se confirman cuando se cobra el honorario` : "Aparecen cuando tus clientes tengan monto de la Afore" },
      { t: "Comisiones cobradas", v: mxn(dinero.comisionesPagadas), nota: "pagadas por RetiroPorDesempleo desde el inicio", liga: "/comisiones" },
      ...(misPensiones > 0 ? [{ t: "Mis casos de pensión", v: String(misPensiones), nota: "monto por definir hasta que el IMSS resuelva", liga: "/casos" }] : []),
    ] : []),
    ...(dinero && !esAsesor ? [
      { t: "Monto retirado del mes", v: mxn(dinero.depositadoMes), nota: "depósitos netos de la Afore", liga: "/dinero" },
      { t: "Honorarios cobrados del mes", v: mxn(dinero.cobradoMes), nota: "con IVA", liga: "/dinero" },
      { t: "Por cobrar", v: mxn(dinero.porCobrar), liga: "/dinero",
        nota: `${dinero.cobrosPendientes} ${dinero.cobrosPendientes === 1 ? "cobro" : "cobros"} · la Afore ya depositó` },
      // Honorario de los retiros con el monto de la Afore ya capturado, antes del depósito.
      { t: "Proyectado por cobrar", v: mxn(proy?.total ?? 0), liga: "/dinero",
        nota: proy && proy.filas.length
          ? `${proy.filas.length} ${proy.filas.length === 1 ? "prospecto" : "prospectos"} · con lo ya cobrable: ${mxn((Math.round(proy.total * 100) + Math.round(dinero.porCobrar * 100)) / 100)}`
          : "Captura el pago esperado de la Afore en cada caso" },
      { t: "Costo administrativo del mes", v: mxn(costoAlta?.total ?? 0), nota: `${costoAlta?.altas ?? 0} ${costoAlta?.altas === 1 ? "alta" : "altas"} de prospectos`, liga: "/prospectos" },
      { t: "Costo administrativo total", v: mxn(costoTotal?.total ?? 0), nota: `${costoTotal?.altas ?? 0} ${costoTotal?.altas === 1 ? "alta" : "altas"} desde el inicio`, liga: "/prospectos" },
      { t: "Comisiones por pagar", v: mxn(dinero.comisionesPorPagar), nota: `${dinero.comisionesPendientes} devengadas`, liga: "/comisiones" },
      // Todo lo que falta pagar a asesores de pensiones y referidores: devengadas + estimadas + proyección.
      { t: "Comisiones proyectadas por pagar", v: mxn(comProy?.total ?? 0), liga: "/comisiones#proyectadas",
        nota: comProy && comProy.casos ? `${comProy.casos} ${comProy.casos === 1 ? "caso" : "casos"} · ${mxn(comProy.devengado)} ya devengadas` : "Elige asesor o referidor en el Canal de cada caso" },
      ...(usuario.rol === "director" && ganancia ? [{ t: "Ganancia proyectada", v: mxn(ganancia.ganancia), liga: "/dinero", destacado: true,
        nota: `Cobrado ${mxn(dinero.cobradoTotal)} + por cobrar y proyectado ${mxn(honorariosProy)} − comisiones ${mxn(comisionesTodas)} − altas ${mxn(costoTotal?.total ?? 0)} · sin IVA: ${mxn(ganancia.gananciaSinIva)}` }] : []),
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
      {sinInduccion && (
        <Link href="/academia" className="mb-4 flex items-center justify-between gap-2 rounded-[var(--radius-tarjeta)] border border-brand/30 bg-brand-tint px-4 py-3 text-sm text-brand hover:underline">
          <span><span className="font-semibold">Tu capacitación:</span> termina la Inducción (N0) en la Academia. Son 4 lecciones y un examen corto.</span><span aria-hidden>→</span>
        </Link>
      )}
      {correosImss > 0 && (
        <Link href="/correos-imss" className="mb-4 flex items-center justify-between gap-2 rounded-[var(--radius-tarjeta)] border border-aviso/30 bg-aviso-tint px-4 py-3 text-sm text-aviso hover:underline">
          <span><span className="font-semibold">{correosImss} {correosImss === 1 ? "correo del IMSS" : "correos del IMSS"}</span> por asignar a un caso</span><span aria-hidden>→</span>
        </Link>
      )}
      <section aria-label="Indicadores" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-3">
        {INDICADORES.map(({ t, v, nota, liga, destacado }) => {
          const contenido = (
            <>
              {/* Ganancia: cuadro amarillo y «proyectada» en verde de la marca. */}
              {destacado
                ? <p className="text-xs font-semibold text-ink">{t.replace(/ proyectada$/, "")} <span className="text-exito-texto">proyectada</span></p>
                : <p className="text-xs text-ink-muted">{t}</p>}
              <p className="cifra mt-1 font-display text-[22px] font-semibold text-ink">{v}</p>
              {nota && <p className={destacado ? "text-xs text-ink" : "text-xs text-ink-muted"}>{nota}</p>}
            </>
          );
          return (
            <Card key={t} className={destacado ? "border-yellow-300 bg-yellow-100 p-0" : "p-0"}>
              {liga ? <Link href={liga} className={`block h-full rounded-[inherit] p-4 ${destacado ? "hover:bg-yellow-200/60" : "hover:bg-brand-tint/40"}`}>{contenido}</Link> : <div className="p-4">{contenido}</div>}
            </Card>
          );
        })}
      </section>
      {usuario.rol === "director" && cascada && flujo && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>De dónde sale la ganancia</CardTitle></CardHeader>
            <div className="px-5 pb-5 pt-2">
              <GraficaCascada pasos={cascada} />
              <p className="mt-2 text-xs text-ink-muted">Azul: lo que entra (cobrado; por cobrar y proyectado) · magenta: comisiones y costo de altas · verde: ganancia proyectada con IVA (sin IVA: {mxn(ganancia!.gananciaSinIva)}).</p>
            </div>
          </Card>
          <Card>
            <CardHeader><CardTitle>Honorarios por mes</CardTitle></CardHeader>
            <div className="px-5 pb-5 pt-2">
              <GraficaFlujo meses={flujo} />
              <p className="mt-2 text-xs text-ink-muted">Cobrados y proyectados por la fecha estimada del depósito de la Afore. Lo que no tiene fecha y lo por cobrar va en el mes actual.</p>
            </div>
          </Card>
        </div>
      )}
      {/* Comisiones proyectadas por asesor de pensiones y referidor (Director). */}
      {usuario.rol === "director" && comProy && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Comisiones proyectadas por pagar</CardTitle>
            <Link href="/comisiones#proyectadas" className="text-sm font-medium text-brand hover:underline">Ver detalle</Link>
          </CardHeader>
          {comProy.porBeneficiario.length === 0 && comProy.conteos.length === 0 ? (
            <p className="px-5 pb-5 pt-2 text-sm text-ink-muted">Sin comisiones por pagar. Elige el asesor de pensiones o el referidor en el Canal de cada caso.</p>
          ) : (
            <div className="overflow-x-auto px-5 pb-5 pt-2">
              {comProy.porBeneficiario.length > 1 && (
                <div className="mb-3"><GraficaBarras horizontal formato="pesos" datos={comProy.porBeneficiario.map((b) => ({ etiqueta: b.nombre, valor: b.monto }))} alto={120} /></div>
              )}
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="text-left text-xs text-ink-muted">{["Beneficiario", "Tipo", "Retiro", "Pensiones", ...(conOtros ? ["Otros"] : []), "Ya devengado", "Proyectado y estimado", "Total"].map((t) => <th key={t} className="pb-2 pr-3 font-medium">{t}</th>)}</tr></thead>
                <tbody>
                  {filasBenef.map((b) => (
                    <tr key={b.clave} className="border-t border-borde align-middle">
                      <td className="py-2 pr-3 font-medium text-ink">{b.nombre}</td>
                      <td className="py-2 pr-3 text-ink-muted">{b.tipo === "socio" ? "Asesor de pensiones" : "Referidor"}</td>
                      <td className="cifra py-2 pr-3">{b.retiro}</td>
                      <td className="cifra whitespace-nowrap py-2 pr-3">{b.pensiones}{b.pensiones > 0 && <span className="ml-2 font-sans text-xs text-ink-muted">· monto por definir</span>}</td>
                      {conOtros && <td className="cifra py-2 pr-3">{b.otros}</td>}
                      <td className="cifra py-2 pr-3">{mxn(b.devengado)}</td>
                      <td className="cifra py-2 pr-3">{mxn(b.proyectado)}</td>
                      <td className="cifra py-2 pr-3 font-semibold text-brand">{mxn(b.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-ink-muted">Montos de retiro por desempleo. Las pensiones se cuentan y su comisión se calcula cuando el IMSS resuelva y registres el cobro.</p>
              {comProy.sinMonto > 0 && <p className="mt-1 text-xs text-aviso">{comProy.sinMonto} {comProy.sinMonto === 1 ? "retiro con asesor no tiene" : "retiros con asesor no tienen"} monto: captura el pago esperado de la Afore.</p>}
            </div>
          )}
        </Card>
      )}
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
              {proximos.map(({ c, d, f }) => (
                <li key={c.id}>
                  <Link href={`/casos/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-brand-tint/40">
                    <span className={`cifra flex size-11 shrink-0 flex-col items-center justify-center rounded-lg font-display text-lg font-semibold leading-none ${d.yaPuede ? "bg-exito-tint text-exito-texto" : "bg-aviso-tint text-aviso"}`}>
                      {d.yaPuede ? "✓" : d.diasFaltan}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{nombreCompleto(c.persona)}</span>
                      <span className="block text-xs text-ink-muted">
                        {d.yaPuede ? `Ya cumplió ${p.DIAS_ESPERA_DESEMPLEO} días` : `${d.diasFaltan === 1 ? "Falta 1 día" : `Faltan ${d.diasFaltan} días`} para el día ${p.DIAS_ESPERA_DESEMPLEO} · ${formatoFecha(d.fecha)}`}
                        {f.diasAdmin > 0 && <span className="block">{f.tramite.listo ? "Listo para ingresar el trámite" : `Trámite: ${formatoFecha(f.tramite.fecha)} (+${f.diasAdmin} días administrativos)`}</span>}
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
                  {esAsesor
                    ? <div><dt className="text-xs text-ink-muted">Mis comisiones proyectadas</dt><dd className="cifra font-display text-lg font-semibold text-exito-texto">{mxn(comProy?.total ?? 0)}</dd></div>
                    : <div><dt className="text-xs text-ink-muted">Honorario cobrado</dt><dd className="cifra font-display text-lg font-semibold text-exito-texto">{mxn(dinero.cobradoMes)}</dd></div>}
                </dl>
              )}
              <p className="text-xs text-ink-muted">Cuenta lo que pasó este mes, aunque el caso se haya dado de alta antes.</p>
            </div>
          )}
        </Card>
        {esAsesor ? (
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Mis comisiones por caso</CardTitle><Link href="/comisiones" className="text-sm font-medium text-brand hover:underline">Estado de cuenta</Link></CardHeader>
            {comProy && comProy.filas.length > 0 ? (
              <div className="overflow-x-auto px-5 pb-5 pt-2">
                <table className="w-full min-w-[520px] text-sm">
                  <thead><tr className="text-left text-xs text-ink-muted">{["Caso", "Cliente", "Estado", "Comisión"].map((t) => <th key={t} className="pb-2 pr-3 font-medium">{t}</th>)}</tr></thead>
                  <tbody>
                    {comProy.filas.map((f, i) => (
                      <tr key={`${f.casoId}-${i}`} className="border-t border-borde align-middle">
                        <td className="cifra py-2 pr-3"><Link href={`/casos/${f.casoId}`} className="text-brand hover:underline">{f.folio}</Link></td>
                        <td className="py-2 pr-3">{f.cliente}</td>
                        <td className="py-2 pr-3 text-ink-muted">{f.origen === "devengada" ? "Por cobrar" : f.origen === "estimada" ? "Estimada (contrato firmado)" : "Proyectada"}</td>
                        <td className="cifra py-2 pr-3 font-medium">{mxn(f.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-ink-muted">Tu comisión es el total de tu factura, con IVA incluido: (honorario − costo administrativo del alta) × tu %.{misPensiones > 0 ? ` Además tienes ${misPensiones} ${misPensiones === 1 ? "caso" : "casos"} de pensión con monto por definir.` : ""}</p>
              </div>
            ) : (
              <EstadoVacio icono={LineChart} titulo="Sin comisiones todavía" texto={misPensiones > 0 ? `Tienes ${misPensiones} ${misPensiones === 1 ? "caso" : "casos"} de pensión con monto por definir. Las comisiones de retiro aparecen cuando el cliente tenga monto de la Afore.` : "Aparecen cuando tus clientes de retiro tengan monto de la Afore."} />
            )}
          </Card>
        ) : (
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Ingresos de los últimos 12 meses</CardTitle></CardHeader>
            {ingresos.some((m) => m.valor > 0) ? (
              <div className="px-5 pb-5 pt-2">
                <GraficaBarras formato="pesos" color="exito" datos={ingresos} />
                <p className="mt-2 text-xs text-ink-muted">Honorarios cobrados con IVA. El detalle por mes está en <Link href="/dinero" className="text-brand underline">Dinero</Link>.</p>
              </div>
            ) : (
              <EstadoVacio icono={LineChart} titulo="Sin honorarios cobrados" texto={veDinero ? "Aquí verás los honorarios cobrados por mes." : "Los ingresos solo los ven el Director y los analistas de expedientes."} />
            )}
          </Card>
        )}
      </div>
    </>
  );
}
