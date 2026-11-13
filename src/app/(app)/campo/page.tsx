import type { Metadata } from "next";
import { CalendarCheck, Clock, Coins, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { exigirRol } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { mxn } from "@/lib/formato";
import { liquidacionesDe, tarifasCampo } from "@/lib/campo/datos";
import { resumenGerente } from "@/lib/reglas/campo";
import { hoyCDMX } from "@/lib/tiempo";
import { CampoTexto, Seleccion } from "../casos/[id]/campos";
import { FormularioAccion } from "../casos/[id]/formulario-accion";
import { altaCampo } from "./acciones";
import { FotoDelDia } from "./foto-del-dia";

const plural = (k: number, uno: string, varios: string) => `${k} ${k === 1 ? uno : varios}`;
export const metadata: Metadata = { title: "Campo" };
const pesos = (cent: number) => mxn(cent / 100);
const fecha = (iso: string) => new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const corta = (d: Date) => new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" }).format(d);
const ESTADO: Record<string, { texto: string; tono: "pagado" | "espera" | "critico" }> = {
  verificado: { texto: "Verificado", tono: "pagado" }, pendiente: { texto: "En revisión", tono: "espera" }, rechazado: { texto: "No cuenta", tono: "critico" },
  aprobada: { texto: "Aprobado", tono: "pagado" }, rechazada: { texto: "No cuenta", tono: "critico" },
};

// Panel del gerente de campo: alta de prospectos en la calle, foto del día y lo que lleva por cobrar.
export default async function Campo() {
  const s = await exigirRol("campo");
  const hoy = hoyCDMX();
  const tarifa = await tarifasCampo(hoy);
  const d = await conUsuario(s.claims, async (tx) => ({
    prospectos: await tx.campoProspecto.findMany({ where: { gerente_id: s.usuario.id, archivado_at: null }, orderBy: { created_at: "desc" },
      select: { id: true, nombre: true, municipio: true, estado: true, motivo_rechazo: true, monto_cent: true, pago_id: true, created_at: true } }),
    jornadas: await tx.campoJornada.findMany({ where: { gerente_id: s.usuario.id }, orderBy: { fecha: "desc" }, take: 30,
      select: { id: true, fecha: true, municipio: true, lugar: true, estado: true, motivo: true, monto_cent: true, pago_id: true } }),
    pagos: await tx.campoPago.findMany({ where: { gerente_id: s.usuario.id }, orderBy: { fecha_pago: "desc" }, take: 12,
      select: { id: true, semana_inicio: true, semana_fin: true, fecha_pago: true, prospectos: true, dias: true, total_cent: true } }),
    liquidaciones: await liquidacionesDe(tx, s.usuario.id, tarifa.diasParaPago),
    servicios: await tx.tipoServicio.findMany({ where: { activo: true }, orderBy: { orden: "asc" }, select: { clave: true, nombre: true } }),
  }), s.ip);
  const pagado = d.pagos.reduce((a, p) => a + Number(p.total_cent), 0);
  const r = resumenGerente(
    d.prospectos.map((p) => ({ estado: p.estado, montoCent: p.monto_cent === null ? null : Number(p.monto_cent), pagada: !!p.pago_id })),
    d.jornadas.map((j) => ({ estado: j.estado, montoCent: j.monto_cent === null ? null : Number(j.monto_cent), pagada: !!j.pago_id })),
    d.liquidaciones, tarifa.prospectoCent, pagado, hoy);
  const hoyRegistrado = d.jornadas.find((j) => j.fecha.toISOString().slice(0, 10) === hoy && j.estado !== "rechazada");
  const deHoy = d.prospectos.filter((p) => hoyCDMX(p.created_at) === hoy).length;

  return (
    <>
      <Encabezado titulo="Campo" descripcion={`Hola, ${s.usuario.nombre.split(" ")[0]}. Registra a cada persona interesada y sube la foto de tu módulo del día.`} />
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card><CardContent className="grid gap-1 pt-5">
            <p className="flex items-center gap-1.5 text-xs text-ink-muted"><Coins className="size-4" aria-hidden /> Por cobrar (ya verificado)</p>
            <p className="font-display text-3xl font-semibold text-exito-texto">{pesos(r.porCobrarCent)}</p>
            <p className="text-xs text-ink-muted">{plural(r.verificados.n, "prospecto", "prospectos")} × {pesos(tarifa.prospectoCent)}{r.dias.aprobados ? ` + ${r.dias.aprobados} ${r.dias.aprobados === 1 ? "día" : "días"}` : ""}</p>
          </CardContent></Card>
          <Card><CardContent className="grid gap-1 pt-5">
            <p className="flex items-center gap-1.5 text-xs text-ink-muted"><Clock className="size-4" aria-hidden /> En revisión</p>
            <p className="font-display text-3xl font-semibold text-ink">{pesos(r.enRevision.centEstimado)}</p>
            <p className="text-xs text-ink-muted">{plural(r.enRevision.n, "prospecto", "prospectos")}, si se verifican{r.dias.enRevision ? ` · ${plural(r.dias.enRevision, "día", "días")} por aprobar` : ""}</p>
          </CardContent></Card>
          <Card><CardContent className="grid gap-1 pt-5">
            <p className="flex items-center gap-1.5 text-xs text-ink-muted"><CalendarCheck className="size-4" aria-hidden /> Próximo pago</p>
            {r.proximoPago ? <>
              <p className="font-display text-3xl font-semibold text-brand">{pesos(r.proximoPago.totalCent)}</p>
              <p className="text-xs text-ink-muted">El {fecha(r.proximoPago.fechaPago)} · lo verificado del {fecha(r.proximoPago.semanaInicio)} al {fecha(r.proximoPago.semanaFin)}</p>
            </> : <p className="text-sm text-ink-muted">Todavía no hay nada verificado por pagar.</p>}
          </CardContent></Card>
        </div>
        <p className="text-xs text-ink-muted">Se te paga {pesos(tarifa.prospectoCent)} por prospecto verificado{tarifa.diaCent ? ` y ${pesos(tarifa.diaCent)} por día con foto aprobada` : ""}. Lo que se verifica de lunes a domingo se paga el miércoles siguiente. Hoy llevas {deHoy} {deHoy === 1 ? "prospecto" : "prospectos"}.</p>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Registrar prospecto</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <FormularioAccion accion={altaCampo} boton="Guardar prospecto" limpiar etiquetas={{ nombre: "Nombre", whatsapp: "WhatsApp", municipio: "Municipio", fecha_baja: "Fecha de baja" }}>
                <CampoTexto id="nombre" etiqueta="Nombre completo" placeholder="Juan Pérez López" autoComplete="off" />
                <CampoTexto id="whatsapp" etiqueta="WhatsApp (10 dígitos)" inputMode="tel" placeholder="55 1234 5678" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <CampoTexto id="municipio" etiqueta="Municipio" placeholder="Jiutepec" valor={hoyRegistrado?.municipio ?? ""} />
                  <CampoTexto id="lugar" etiqueta="Lugar (opcional)" placeholder="Plaza principal" valor={hoyRegistrado?.lugar ?? ""} />
                </div>
                <Seleccion id="tipo_servicio" etiqueta="¿Qué le interesa? (opcional)" vacia="No sabe todavía" opciones={d.servicios.map((x) => [x.clave, x.nombre.split(" (")[0]] as const)} />
                <CampoTexto id="fecha_baja" etiqueta="Fecha de baja, si la sabe (opcional)" tipo="date" max={hoy} />
                <CampoTexto id="notas" etiqueta="Notas (opcional)" placeholder="Mejor hora para llamarle" />
              </FormularioAccion>
              <p className="text-xs text-ink-muted">Solo nombre, WhatsApp y municipio. No pidas NSS, CURP ni documentos: eso lo hace el asesor después, con el aviso de privacidad.</p>
            </CardContent>
          </Card>

          <Card className={hoyRegistrado ? "" : "border-brand/40"}>
            <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="size-5 text-brand" aria-hidden /> Foto del módulo de hoy</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {hoyRegistrado
                ? <p className="text-ink">Ya registraste hoy: <b>{hoyRegistrado.lugar}</b>, {hoyRegistrado.municipio} · <Badge tono={ESTADO[hoyRegistrado.estado].tono}>{ESTADO[hoyRegistrado.estado].texto}</Badge></p>
                : <><p className="text-ink-muted">Toma una foto donde se vea tu módulo, banner y el lugar. Con ella cuenta tu día de trabajo.</p><FotoDelDia /></>}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Mis prospectos ({d.prospectos.length})</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {d.prospectos.length === 0 ? <p className="text-ink-muted">Todavía no registras prospectos.</p> : (
              <ul className="divide-y divide-borde">
                {d.prospectos.slice(0, 100).map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span><span className="font-medium text-ink">{p.nombre}</span> <span className="text-xs text-ink-muted">· {p.municipio} · {corta(p.created_at)}</span>
                      {p.estado === "rechazado" && p.motivo_rechazo && <span className="block text-xs text-critico">{p.motivo_rechazo}</span>}</span>
                    <span className="flex items-center gap-2">{p.monto_cent !== null && <span className="cifra text-xs text-ink-muted">{pesos(Number(p.monto_cent))}{p.pago_id ? " · pagado" : ""}</span>}
                      <Badge tono={ESTADO[p.estado].tono}>{ESTADO[p.estado].texto}</Badge></span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Mis días</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {d.jornadas.length === 0 ? <p className="text-ink-muted">Todavía no registras días.</p> : (
                <ul className="divide-y divide-borde">
                  {d.jornadas.map((j) => (
                    <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span><span className="font-medium text-ink">{fecha(j.fecha.toISOString().slice(0, 10))}</span> <span className="text-xs text-ink-muted">· {j.lugar}, {j.municipio}</span>
                        {j.estado === "rechazada" && j.motivo && <span className="block text-xs text-critico">{j.motivo}</span>}</span>
                      <Badge tono={ESTADO[j.estado].tono}>{ESTADO[j.estado].texto}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Mis pagos</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {d.liquidaciones.length > 0 && (
                <div className="grid gap-1 rounded-[var(--radius-boton)] bg-exito-tint p-3">
                  {d.liquidaciones.map((l) => (
                    <p key={l.semanaFin} className="text-exito-texto"><b>{pesos(l.totalCent)}</b> el {fecha(l.fechaPago)} <span className="text-xs">({plural(l.prospectos.length, "prospecto", "prospectos")}{l.dias.length ? `, ${plural(l.dias.length, "día", "días")}` : ""})</span></p>
                  ))}
                </div>
              )}
              {d.pagos.length === 0 ? <p className="text-ink-muted">Todavía no hay pagos registrados.</p> : (
                <ul className="divide-y divide-borde">
                  {d.pagos.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                      <span>Pagado el {fecha(p.fecha_pago.toISOString().slice(0, 10))} <span className="block text-xs text-ink-muted">{plural(p.prospectos, "prospecto", "prospectos")} · {plural(p.dias, "día", "días")}</span></span>
                      <span className="cifra font-medium text-ink">{pesos(Number(p.total_cent))}</span>
                    </li>
                  ))}
                </ul>
              )}
              {pagado > 0 && <p className="text-xs text-ink-muted">Total pagado: {pesos(pagado)}</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
