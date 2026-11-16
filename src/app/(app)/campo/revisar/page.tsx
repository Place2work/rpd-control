import type { Metadata } from "next";
import Link from "next/link";
import { Camera, MessageCircle, Phone, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { exigirRol } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { urlLectura } from "@/lib/documentos/almacen";
import { tarifasCampo } from "@/lib/campo/datos";
import { mxn } from "@/lib/formato";
import { Casilla, Seleccion, CampoTexto } from "../../casos/[id]/campos";
import { FormularioAccion } from "../../casos/[id]/formulario-accion";
import { BotonAccion } from "../../configuracion/boton-accion";
import { altaOficinaCampo, asignarGerenteCampo, quitarCampo, rechazarCampo, revisarJornada, sinRespuestaCampo, verificarCampo } from "../acciones";

export const metadata: Metadata = { title: "Prospectos de campo" };
const cuando = (d: Date) => new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).format(d);
const dia = (d: Date) => new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(d);
const MOTIVOS = [["Repetido", "Repetido (ya es cliente o ya estaba)"], ["Número que no existe", "Número que no existe"], ["No le interesa", "No le interesa"],
  ["No contestó varias veces", "No contestó varias veces"], ["Datos falsos o incompletos", "Datos falsos o incompletos"]] as const;

// El analista (o el Director) llama a cada prospecto de campo: si es real, lo verifica (se vuelve prospecto normal y
// se asigna); si no, lo rechaza con motivo. También aprueba la foto del día del gerente de campo.
export default async function RevisarCampo() {
  const s = await exigirRol("director", "asesor");
  const tarifa = await tarifasCampo();
  const d = await conUsuario(s.claims, async (tx) => ({
    pendientes: await tx.campoProspecto.findMany({ where: { estado: "pendiente", archivado_at: null }, orderBy: { created_at: "asc" },
      select: { id: true, nombre: true, whatsapp: true, municipio: true, lugar: true, tipo_servicio: true, fecha_baja: true, notas: true, intentos: true, ultimo_intento_at: true, created_at: true, origen: true, curp_parcial: true, gerente_id: true, gerente: { select: { nombre: true } } } }),
    jornadas: await tx.campoJornada.findMany({ where: { estado: "pendiente" }, orderBy: { fecha: "asc" },
      select: { id: true, fecha: true, municipio: true, lugar: true, foto_path: true, gerente: { select: { nombre: true } } } }),
    recientes: await tx.campoProspecto.findMany({ where: { estado: { not: "pendiente" }, archivado_at: null }, orderBy: { verificado_at: "desc" }, take: 15,
      select: { id: true, nombre: true, estado: true, motivo_rechazo: true, caso_id: true, municipio: true, pago_id: true, gerente_id: true, gerente: { select: { nombre: true } }, caso: { select: { socio_asignado_at: true, socio: { select: { nombre: true } }, vendedor_asignado_at: true, vendedor: { select: { nombre: true } } } } } }),
    servicios: await tx.tipoServicio.findMany({ where: { activo: true }, orderBy: { orden: "asc" }, select: { clave: true, nombre: true } }),
    socios: await tx.socio.findMany({ where: { archivado_at: null }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    gerentes: await tx.usuario.findMany({ where: { rol: "campo", activo: true, archivado_at: null }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    vendedores: await tx.usuario.findMany({ where: { rol: "vendedor", activo: true, archivado_at: null }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  }), s.ip);
  const fotos = await Promise.all(d.jornadas.map((j) => urlLectura(j.foto_path, "campo").catch(() => null)));
  const wa = (n: string) => `https://wa.me/${n.replace(/\D/g, "")}`;

  return (
    <>
      <Encabezado titulo="Prospectos de campo" descripcion={`Llama a cada uno: si es real, verifícalo y asígnalo a un asesor de pensiones o a un vendedor; si no, recházalo con motivo. Cada verificado se le paga al gerente de campo (${mxn(tarifa.prospectoCent / 100)}).`}>
        {s.usuario.rol === "director" && <Link href="/campo/pagos" className="text-sm text-brand underline">Pagos del gerente de campo</Link>}
      </Encabezado>
      <div className="grid gap-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="size-5 text-brand" aria-hidden /> Agregar prospecto de campo</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <details>
              <summary className="cursor-pointer text-brand underline">Capturar un prospecto (llamada, recomendación o que te pasó un gerente)</summary>
              <FormularioAccion accion={altaOficinaCampo} boton="Guardar prospecto" limpiar etiquetas={{ nombre: "Nombre", whatsapp: "WhatsApp", curp: "CURP", municipio: "Municipio", gerente_id: "Gerente" }} className="mt-3 grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <CampoTexto id="nombre" etiqueta="Nombre completo" placeholder="Juan Pérez López" required />
                  <CampoTexto id="whatsapp" etiqueta="WhatsApp (10 dígitos)" inputMode="tel" placeholder="55 1234 5678" required />
                  <CampoTexto id="curp" etiqueta="CURP" maxLength={18} placeholder="18 caracteres" className="uppercase" required />
                  <CampoTexto id="municipio" etiqueta="Municipio" placeholder="Jiutepec" required />
                  <CampoTexto id="lugar" etiqueta="Lugar (opcional)" placeholder="Plaza principal" />
                  <Seleccion id="tipo_servicio" etiqueta="¿Qué le interesa? (opcional)" vacia="No sabe todavía" opciones={d.servicios.map((x) => [x.clave, x.nombre.split(" (")[0]] as const)} />
                  <Seleccion id="gerente_id" etiqueta="Gerente de campo (opcional)" vacia="Sin gerente por ahora" opciones={d.gerentes.map((g) => [g.id, g.nombre] as const)} />
                  <CampoTexto id="notas" etiqueta="Notas (opcional)" placeholder="Mejor hora para llamarle" className="lg:col-span-2" />
                </div>
                <p className="text-xs text-ink-muted">Queda «por verificar» con el mismo flujo. El gerente lo puedes asignar ahora o después; se le paga solo si se verifica, en la semana en que se verificó o se le asignó (la más tardía).</p>
              </FormularioAccion>
            </details>
          </CardContent>
        </Card>
        <Card className={d.pendientes.length ? "border-brand/40" : ""}>
          <CardHeader><CardTitle>Por verificar ({d.pendientes.length})</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm">
            {d.pendientes.length === 0 ? <p className="text-ink-muted">No hay prospectos de campo por verificar.</p> : d.pendientes.map((p) => (
              <div key={p.id} className="grid gap-3 border-b border-borde pb-4 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">{p.nombre}</p>
                    <p className="text-xs text-ink-muted">{p.municipio}{p.lugar ? ` · ${p.lugar}` : ""} · {p.origen === "formulario" ? `se registró con el QR de ${p.gerente?.nombre ?? "—"}` : p.origen === "oficina" ? `capturado en oficina · ${p.gerente ? `gerente: ${p.gerente.nombre}` : "sin gerente"}` : `lo levantó ${p.gerente?.nombre ?? "—"}`} · {cuando(p.created_at)}{p.curp_parcial ? ` · CURP ${p.curp_parcial}` : ""}</p>
                    {(p.fecha_baja || p.notas) && <p className="text-xs text-ink-muted">{p.fecha_baja ? `Baja: ${dia(p.fecha_baja)}` : ""}{p.fecha_baja && p.notas ? " · " : ""}{p.notas ?? ""}</p>}
                    {p.intentos > 0 && <p className="text-xs text-aviso">{p.intentos} {p.intentos === 1 ? "llamada" : "llamadas"} sin respuesta · última {cuando(p.ultimo_intento_at!)}</p>}
                  </div>
                  <div className="flex gap-2">
                    <a href={`tel:${p.whatsapp}`} className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-boton)] border border-brand px-3 text-sm text-brand"><Phone className="size-4" aria-hidden /> Llamar</a>
                    <a href={wa(p.whatsapp)} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-boton)] border border-brand px-3 text-sm text-brand"><MessageCircle className="size-4" aria-hidden /> WhatsApp</a>
                  </div>
                </div>
                <FormularioAccion accion={asignarGerenteCampo.bind(null, p.id)} boton={p.gerente_id ? "Cambiar gerente" : "Asignar gerente"} etiquetas={{ gerente_id: "Gerente" }} className="flex flex-wrap items-end gap-2">
                  <Seleccion id="gerente_id" etiqueta="Gerente de campo (a quien se le paga)" valor={p.gerente_id} vacia="Sin gerente" opciones={d.gerentes.map((g) => [g.id, g.nombre] as const)} />
                </FormularioAccion>
                {s.usuario.rol === "director" && <Quitar id={p.id} conCaso={false} />}
                <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
                  <FormularioAccion accion={verificarCampo.bind(null, p.id)} boton="Verificar y dar de alta" etiquetas={{ tipo_servicio: "Servicio", socio_id: "Asesor de pensiones", vendedor_id: "Vendedor" }} className="grid gap-2 rounded-[var(--radius-boton)] bg-exito-tint p-3">
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Seleccion id="tipo_servicio" etiqueta="Servicio" valor={p.tipo_servicio} vacia="Elige…" opciones={d.servicios.map((x) => [x.clave, x.nombre.split(" (")[0]] as const)} />
                      <Seleccion id="socio_id" etiqueta="Asesor de pensiones (opcional)" vacia="Sin asignar todavía" opciones={d.socios.map((x) => [x.id, x.nombre] as const)} />
                      <Seleccion id="vendedor_id" etiqueta="Vendedor (opcional)" vacia={d.vendedores.length ? "Sin vendedor" : "No hay vendedores activos"} opciones={d.vendedores.map((x) => [x.id, x.nombre] as const)} />
                    </div>
                  </FormularioAccion>
                  <div className="grid content-start gap-2">
                    <BotonAccion accion={sinRespuestaCampo.bind(null, p.id)} texto="No contestó (intentar después)" variante="secundario" />
                    <FormularioAccion accion={rechazarCampo.bind(null, p.id)} boton="No cuenta" etiquetas={{ motivo: "Motivo" }} confirmar="¿Rechazar este prospecto? No se le paga al gerente de campo." className="grid gap-2 [&_button]:bg-critico">
                      <Seleccion id="motivo" etiqueta="Motivo" vacia="Elige…" opciones={MOTIVOS} />
                    </FormularioAccion>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Camera className="size-5 text-brand" aria-hidden /> Días por aprobar ({d.jornadas.length})</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm">
            {d.jornadas.length === 0 ? <p className="text-ink-muted">No hay fotos del módulo por aprobar.</p> : d.jornadas.map((j, i) => (
              <div key={j.id} className="grid gap-3 border-b border-borde pb-4 last:border-0 last:pb-0 sm:grid-cols-[220px_1fr]">
                {fotos[i] ? <a href={fotos[i]!} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- liga firmada de 10 min del almacén privado */}
                  <img src={fotos[i]!} alt={`Módulo en ${j.lugar}, ${j.municipio}`} className="h-40 w-full rounded-[var(--radius-boton)] border border-borde object-cover" /></a>
                  : <div className="flex h-40 items-center justify-center rounded-[var(--radius-boton)] border border-borde text-xs text-ink-muted">No se pudo abrir la foto</div>}
                <div className="grid content-start gap-2">
                  <p className="font-medium text-ink">{j.gerente.nombre} · {dia(j.fecha)}</p>
                  <p className="text-ink-muted">{j.lugar}, {j.municipio}</p>
                  <div className="flex flex-wrap items-start gap-3">
                    {s.usuario.rol === "director" ? (
                      <FormularioAccion accion={revisarJornada.bind(null, j.id, true)} boton="Aprobar día" etiquetas={{ monto: "Pago de este día" }} className="grid gap-2">
                        <CampoTexto id="monto" etiqueta="Pago de este día (pesos)" inputMode="decimal" valor={(tarifa.diaCent / 100).toFixed(2)} />
                      </FormularioAccion>
                    ) : (
                      <FormularioAccion accion={revisarJornada.bind(null, j.id, true)} boton={`Aprobar día${tarifa.diaCent ? ` (${mxn(tarifa.diaCent / 100)})` : ""}`} className="grid gap-2"><span className="sr-only">Aprobar</span></FormularioAccion>
                    )}
                    <FormularioAccion accion={revisarJornada.bind(null, j.id, false)} boton="No cuenta" etiquetas={{ motivo: "Motivo" }} className="grid gap-2 [&_button]:bg-critico">
                      <CampoTexto id="motivo" etiqueta="Motivo" placeholder="No se ve el módulo" />
                    </FormularioAccion>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {d.recientes.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Revisados recientemente</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <ul className="divide-y divide-borde">
                {d.recientes.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span><span className="font-medium text-ink">{p.nombre}</span> <span className="text-xs text-ink-muted">· {p.municipio} · {p.gerente?.nombre ?? "sin gerente"}</span></span>
                    {p.estado === "verificado" && p.caso_id ? <span className="text-xs text-ink-muted">{[p.caso?.socio && p.caso.socio_asignado_at ? `Asesor: ${p.caso.socio.nombre} (${cuando(p.caso.socio_asignado_at)})` : null,
                      p.caso?.vendedor && p.caso.vendedor_asignado_at ? `Vendedor: ${p.caso.vendedor.nombre} (${cuando(p.caso.vendedor_asignado_at)})` : null].filter(Boolean).join(" · ") || "Sin asignar todavía"} · <Link href={`/casos/${p.caso_id}`} className="text-brand underline">abrir caso</Link></span>
                      : <span className="text-xs text-critico">No cuenta · {p.motivo_rechazo}</span>}
                    {s.usuario.rol === "director" && !p.pago_id && <Quitar id={p.id} conCaso={Boolean(p.caso_id)} />}
                    {p.estado === "verificado" && !p.pago_id && (
                      <FormularioAccion accion={asignarGerenteCampo.bind(null, p.id)} boton={p.gerente_id ? "Cambiar gerente" : "Asignar gerente"} etiquetas={{ gerente_id: "Gerente" }} className="flex w-full flex-wrap items-end justify-end gap-2 [&_select]:h-9 [&_select]:w-56">
                        <Seleccion id="gerente_id" etiqueta="Gerente de campo" valor={p.gerente_id} vacia="Sin gerente" opciones={d.gerentes.map((g) => [g.id, g.nombre] as const)} />
                      </FormularioAccion>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

/** Director: quitar un prospecto de campo (archivado con motivo; deja de contar para el pago). */
function Quitar({ id, conCaso }: { id: string; conCaso: boolean }) {
  return (
    <details className="w-full text-xs">
      <summary className="cursor-pointer text-critico underline">Quitar (prueba o error)</summary>
      <FormularioAccion accion={quitarCampo.bind(null, id)} boton="Quitar prospecto" etiquetas={{ motivo: "Motivo" }} confirmar="¿Quitar este prospecto de campo? Se archiva con el motivo y ya no cuenta para el pago del gerente."
        className="mt-2 grid max-w-xl gap-2 rounded-[var(--radius-boton)] bg-critico-tint p-3 [&_button]:bg-critico">
        <CampoTexto id="motivo" etiqueta="Motivo" placeholder="Fue una prueba" required />
        {conCaso && <Casilla id="archivar_caso" etiqueta="También archivar el caso que se creó al verificarlo" marcada />}
      </FormularioAccion>
    </details>
  );
}
