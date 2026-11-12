import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Award, ClipboardCheck, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { ETIQUETA_ROL } from "@/components/rpd/navegacion";
import { exigirRol } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { ROLEPLAYS, RUBRICA, RUTAS } from "@/lib/academia/contenido";
import { avanceDe, estadosDe } from "@/lib/academia/motor";
import { SEVERIDADES, TIPOS_INCIDENCIA, etiquetaSeveridad, etiquetaTipo } from "@/lib/academia/incidencias";
import { CampoTexto, Casilla, Seleccion } from "../../../casos/[id]/campos";
import { FormularioAccion } from "../../../casos/[id]/formulario-accion";
import { cambiarCertificacion, evaluarRoleplay, registrarAcompanamiento, registrarEntrevista, registrarIncidencia, validarDiagnostico } from "../../acciones";

export const metadata: Metadata = { title: "Persona · Academia" };
const fecha = (d: Date) => new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "America/Mexico_City" }).format(d);
const ESTADO_CERT: Record<string, string> = { vigente: "Vigente", por_vencer: "Por vencer", vencida: "Vencida", suspendida: "Suspendida", revocada: "Revocada" };
const TIPO_SOLICITUD: Record<string, string> = { roleplay: "Juego de roles", acompanamiento: "Caso acompañado", entrevista: "Entrevista" };

// Perfil de una persona para el Director (CAPACITACION.md 9.2, 9.4, 9.5 y 12.1): califica juegos de roles con la
// rúbrica (pensado para usarse en el celular durante la sesión), registra acompañamientos, diagnósticos validados,
// la entrevista de P2 e incidencias; reactiva o revoca certificaciones. Cada registro vuelve a revisar si ya se
// certifica.
export default async function Persona({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirRol("director");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await conUsuario(sesion.claims, async (tx) => {
    const u = await tx.usuario.findUnique({ where: { id }, select: { id: true, nombre: true, rol: true } });
    if (!u) return null;
    const w = { usuario_id: id, archivado_at: null };
    return {
      u,
      certs: await tx.capCertificacion.findMany({ where: w, orderBy: { otorgada_at: "asc" }, select: { id: true, ruta: true, estado: true, vence_at: true, otorgada_at: true, motivo: true } }),
      roleplays: await tx.capEvaluacionRoleplay.findMany({ where: w, orderBy: { created_at: "desc" }, select: { id: true, roleplay: true, total: true, aprobado: true, eliminatorio_fallado: true, comentarios: true, created_at: true } }),
      shadowing: await tx.capShadowing.findMany({ where: w, orderBy: { created_at: "desc" }, select: { id: true, ruta: true, modo: true, cumple: true, notas: true, created_at: true, caso: { select: { id: true, folio: true } } } }),
      diagnosticos: await tx.capDiagnosticoValidado.findMany({ where: w, orderBy: { created_at: "desc" }, select: { id: true, correccion_grave: true, notas: true, created_at: true, caso: { select: { id: true, folio: true } } } }),
      entrevistas: await tx.capEntrevista.findMany({ where: w, orderBy: { created_at: "desc" }, select: { id: true, aprobada: true, notas: true, created_at: true } }),
      incidencias: await tx.capIncidencia.findMany({ where: w, orderBy: { created_at: "desc" }, select: { id: true, tipo: true, severidad: true, descripcion: true, accion: true, created_at: true, caso: { select: { id: true, folio: true } } } }),
      solicitudes: await tx.capSolicitud.findMany({ where: { usuario_id: id, estado: "pendiente" }, orderBy: { created_at: "asc" }, select: { id: true, tipo: true, referencia: true, created_at: true } }),
    };
  }, sesion.ip);
  if (!d) notFound();
  const estados = estadosDe(await avanceDe(id));
  const propio = id === sesion.usuario.id;

  return (
    <>
      <Encabezado titulo={d.u.nombre} descripcion={`${ETIQUETA_ROL[d.u.rol]} · Academia`}>
        <Link href="/academia/equipo" className="inline-flex items-center gap-1.5 text-sm text-brand underline"><ArrowLeft className="size-4" aria-hidden /> Avance del equipo</Link>
      </Encabezado>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Award className="size-5 text-exito" aria-hidden /> Rutas y certificaciones</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {RUTAS.map((r) => {
              const e = estados.find((x) => x.clave === r.clave)!;
              const c = d.certs.filter((x) => x.ruta === r.clave).at(-1);
              return (
                <div key={r.clave} className="grid gap-1 border-b border-borde pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span><span className="cifra font-medium text-ink">{r.clave}</span> · {r.nombre}</span>
                    {c ? <Badge tono={c.estado === "vigente" || c.estado === "por_vencer" ? "pagado" : "critico"}>{ESTADO_CERT[c.estado] ?? c.estado}</Badge>
                      : <span className="cifra text-xs text-ink-muted">{e.disponible ? `${e.avance}%` : "Bloqueada"}</span>}
                  </div>
                  {c && <p className="text-xs text-ink-muted">Otorgada {fecha(c.otorgada_at)}{c.vence_at ? ` · vence ${fecha(c.vence_at)}` : ""}{c.motivo ? ` · ${c.motivo}` : ""}</p>}
                  {!c && e.disponible && e.pendientes.length > 0 && <p className="text-xs text-ink-muted">Le falta: {e.pendientes.join(" · ")}</p>}
                  {c && (c.estado === "suspendida" || c.estado === "vigente" || c.estado === "por_vencer") && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-brand">{c.estado === "suspendida" ? "Reactivar o revocar" : "Revocar"}</summary>
                      <div className="mt-2 grid gap-2">
                        {c.estado === "suspendida" && (
                          <FormularioAccion accion={cambiarCertificacion.bind(null, c.id, "vigente")} boton="Reactivar" etiquetas={{ motivo: "Motivo" }}>
                            <CampoTexto id="motivo" etiqueta="Motivo" placeholder="Revisé el caso con la persona y corrigió" />
                          </FormularioAccion>
                        )}
                        <FormularioAccion accion={cambiarCertificacion.bind(null, c.id, "revocada")} boton="Revocar" etiquetas={{ motivo: "Motivo" }} confirmar="¿Revocar esta certificación? Tendrá que volver a certificarse.">
                          <CampoTexto id="motivo" etiqueta="Motivo" placeholder="Reincidencia en una línea roja" />
                        </FormularioAccion>
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className={d.solicitudes.length ? "border-brand/40" : ""}>
          <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="size-5 text-brand" aria-hidden /> Por evaluar</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {d.solicitudes.length === 0 ? <p className="text-ink-muted">No tiene solicitudes pendientes.</p> : (
              <ul className="grid gap-1">
                {d.solicitudes.map((s) => (
                  <li key={s.id}><span className="font-medium text-ink">{TIPO_SOLICITUD[s.tipo] ?? s.tipo} {s.referencia}</span> <span className="text-xs text-ink-muted">· pedido el {fecha(s.created_at)}</span></li>
                ))}
              </ul>
            )}
            <p className="text-xs text-ink-muted">Al registrar la evaluación, la solicitud queda atendida.</p>
          </CardContent>
        </Card>
      </div>

      {propio ? <p className="mt-4 text-sm text-ink-muted">Las evaluaciones humanas no se registran para ti mismo.</p> : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Juego de roles (rúbrica 9.2)</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <p className="text-ink-muted">Marca lo que sí cumplió. Aprueba con {RUBRICA.minimo} puntos y sin fallar ningún criterio eliminatorio.</p>
              <FormularioAccion accion={evaluarRoleplay.bind(null, id)} boton="Registrar calificación" etiquetas={{ roleplay: "Juego de roles" }} limpiar>
                <Seleccion id="roleplay" etiqueta="Juego de roles" vacia="Elige…" opciones={ROLEPLAYS.map((r) => [r.clave, `${r.clave} (${r.ruta}) · ${r.escenario}`] as const)} />
                <details className="text-xs text-ink-muted"><summary className="cursor-pointer text-brand">Ver escenarios y objeciones</summary>
                  <ul className="mt-2 grid gap-2">{ROLEPLAYS.map((r) => <li key={r.clave}><strong className="text-ink">{r.clave}</strong> · {r.perfil}. Objeción: {r.objecion}</li>)}</ul>
                </details>
                <fieldset className="grid gap-1">
                  <legend className="mb-1 text-xs font-medium text-ink">Criterios</legend>
                  {RUBRICA.criterios.map((c) => <Casilla key={c.clave} id={c.clave} etiqueta={`${c.criterio} · ${c.peso} pts${c.eliminatorio ? " · eliminatorio" : ""}`} />)}
                </fieldset>
                <CampoTexto id="comentarios" etiqueta="Retroalimentación (la verá la persona)" />
              </FormularioAccion>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card>
              <CardHeader><CardTitle>Caso acompañado</CardTitle></CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <p className="text-ink-muted">R1: 3 casos de retiro. R2: 2 casos Ley 73 (el régimen debe estar capturado en el expediente).</p>
                <FormularioAccion accion={registrarAcompanamiento.bind(null, id)} boton="Registrar" etiquetas={{ folio: "Folio", ruta: "Ruta", modo: "Modo" }} limpiar>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <CampoTexto id="folio" etiqueta="Folio del caso" placeholder="RP-0001" />
                    <Seleccion id="ruta" etiqueta="Ruta" vacia="Elige…" opciones={[["R1", "R1 · Retiro"], ["R2", "R2 · Ley 73"]]} />
                    <Seleccion id="modo" etiqueta="Modo" vacia="Elige…" opciones={[["observa", "Observó al Director"], ["observado", "Lo llevó él, observado"]]} />
                  </div>
                  <Casilla id="cumple" etiqueta="Lo hizo bien (cuenta para su certificación)" />
                  <CampoTexto id="notas" etiqueta="Notas" />
                </FormularioAccion>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Diagnóstico inicial validado (P2)</CardTitle></CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <p className="text-ink-muted">Necesita 10 sin correcciones graves. Llevas {d.diagnosticos.filter((x) => !x.correccion_grave).length}.</p>
                <FormularioAccion accion={validarDiagnostico.bind(null, id)} boton="Validar" etiquetas={{ folio: "Folio" }} limpiar>
                  <CampoTexto id="folio" etiqueta="Folio del caso" placeholder="RP-0001" />
                  <Casilla id="correccion_grave" etiqueta="Tuve que hacer una corrección grave (no cuenta)" />
                  <CampoTexto id="notas" etiqueta="Notas" />
                </FormularioAccion>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Entrevista P2</CardTitle></CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <FormularioAccion accion={registrarEntrevista.bind(null, id)} boton="Registrar entrevista" limpiar>
                  <Casilla id="aprobada" etiqueta="Aprobada" />
                  <CampoTexto id="notas" etiqueta="Notas" />
                </FormularioAccion>
              </CardContent>
            </Card>
          </div>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="size-5 text-critico" aria-hidden /> Registrar incidencia</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <p className="text-ink-muted">Una de línea roja suspende al momento todas sus certificaciones; las reactivas tú después de revisarlo con la persona.</p>
              <FormularioAccion accion={registrarIncidencia.bind(null, null)} boton="Registrar incidencia" etiquetas={{ tipo: "Tipo", severidad: "Severidad", descripcion: "Qué pasó" }} limpiar
                confirmar="¿Registrar la incidencia? Si es de línea roja, sus certificaciones se suspenden al momento.">
                <input type="hidden" name="usuario_id" value={id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Seleccion id="tipo" etiqueta="Tipo" vacia="Elige…" opciones={TIPOS_INCIDENCIA} />
                  <Seleccion id="severidad" etiqueta="Severidad" vacia="Elige…" opciones={SEVERIDADES} />
                  <CampoTexto id="descripcion" etiqueta="Qué pasó" className="sm:col-span-2" />
                  <CampoTexto id="accion" etiqueta="Acción tomada (opcional)" className="sm:col-span-2" placeholder="Repasar R1-03 y presentar de nuevo RP-01" />
                </div>
              </FormularioAccion>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="mt-4">
        <CardHeader><CardTitle>Historial</CardTitle></CardHeader>
        <CardContent className="grid gap-4 text-sm">
          <Historial titulo="Juegos de roles" vacio="Sin juegos de roles." items={d.roleplays.map((r) => ({ id: r.id, fecha: r.created_at,
            texto: `${r.roleplay} · ${r.total} pts · ${r.aprobado ? "aprobado" : r.eliminatorio_fallado ? "no aprobado (eliminatorio)" : "no aprobado"}`, nota: r.comentarios }))} />
          <Historial titulo="Casos acompañados" vacio="Sin casos acompañados." items={d.shadowing.map((x) => ({ id: x.id, fecha: x.created_at, casoId: x.caso.id, folio: x.caso.folio,
            texto: `${x.ruta} · ${x.modo === "observa" ? "observó" : "observado"} · ${x.cumple ? "cuenta" : "no cuenta"}`, nota: x.notas }))} />
          <Historial titulo="Diagnósticos validados" vacio="Sin diagnósticos validados." items={d.diagnosticos.map((x) => ({ id: x.id, fecha: x.created_at, casoId: x.caso.id, folio: x.caso.folio,
            texto: x.correccion_grave ? "Con corrección grave (no cuenta)" : "Válido", nota: x.notas }))} />
          <Historial titulo="Entrevistas" vacio="Sin entrevista." items={d.entrevistas.map((x) => ({ id: x.id, fecha: x.created_at, texto: x.aprobada ? "Aprobada" : "No aprobada", nota: x.notas }))} />
          <Historial titulo="Incidencias" vacio="Sin incidencias." items={d.incidencias.map((x) => ({ id: x.id, fecha: x.created_at, casoId: x.caso?.id, folio: x.caso?.folio,
            texto: `${etiquetaSeveridad(x.severidad)} · ${etiquetaTipo(x.tipo)} · ${x.descripcion}`, nota: x.accion, critico: x.severidad === "linea_roja" }))} />
        </CardContent>
      </Card>
    </>
  );
}

type Item = { id: string; fecha: Date; texto: string; nota?: string | null; casoId?: string; folio?: string; critico?: boolean };
function Historial({ titulo, vacio, items }: { titulo: string; vacio: string; items: Item[] }) {
  return (
    <section>
      <h3 className="text-xs font-medium text-ink">{titulo}</h3>
      {items.length === 0 ? <p className="mt-1 text-xs text-ink-muted">{vacio}</p> : (
        <ul className="mt-1 grid gap-1">
          {items.map((i) => (
            <li key={i.id} className={i.critico ? "text-critico" : "text-ink"}>
              <span className="text-xs text-ink-muted">{fecha(i.fecha)}</span> · {i.texto}
              {i.casoId && <> · <Link href={`/casos/${i.casoId}`} className="cifra text-brand underline">{i.folio}</Link></>}
              {i.nota && <span className="block text-xs text-ink-muted">{i.nota}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
