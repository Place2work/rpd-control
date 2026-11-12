import type { Metadata } from "next";
import Link from "next/link";
import { Award, CheckCircle2, Circle, Lock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { exigirRol } from "@/lib/auth/sesion";
import { ACUSES, EVALUACION, MODULOS, PREGUNTAS, RUTAS } from "@/lib/academia/contenido";
import { avanceDe, estadosDe } from "@/lib/academia/motor";
import { puedeIntentar } from "@/lib/reglas/capacitacion";
import { Casilla } from "../casos/[id]/campos";
import { FormularioAccion } from "../casos/[id]/formulario-accion";
import { firmarAcuses } from "./acciones";

export const metadata: Metadata = { title: "Academia" };
const fecha = (iso: string) => new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date(iso));

export default async function Academia() {
  const sesion = await exigirRol("director", "asesor", "socio");
  const ahora = new Date();
  const a = await avanceDe(sesion.usuario.id, ahora);
  const estados = estadosDe(a);
  const faltanAcuses = ACUSES.filter((x) => !a.acuses.has(x.clave));
  const obligatoria = sesion.usuario.rol === "socio";

  return (
    <>
      <Encabezado titulo="Academia" descripcion={obligatoria
        ? "Tu ruta de capacitación como asesor de pensiones: lecciones, exámenes y certificaciones."
        : "Las rutas de capacitación del equipo. Para ti son de repaso: no cambian tus permisos."}>
        {sesion.usuario.rol === "director" && (
          <Link href="/academia/equipo" className="inline-flex items-center gap-1.5 text-sm text-brand underline"><Users className="size-4" aria-hidden /> Avance del equipo</Link>
        )}
      </Encabezado>

      <div className="grid gap-4">
        {faltanAcuses.length > 0 && (
          <Card className="border-aviso/40">
            <CardHeader><CardTitle>Antes de empezar: firma tus acuses</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <p className="text-ink-muted">Léelos con calma. Al firmarlos queda registro con fecha y versión.</p>
              <FormularioAccion accion={firmarAcuses} boton="Firmar">
                {ACUSES.map((x) => (
                  <details key={x.clave} className="rounded-[var(--radius-boton)] border border-borde p-3" open>
                    <summary className="cursor-pointer font-medium text-ink">{x.titulo} <span className="text-xs font-normal text-ink-muted">· versión {x.version}</span></summary>
                    <div className="mt-2 grid gap-2 whitespace-pre-line text-ink-muted">{x.texto}</div>
                    <Casilla id={x.clave} etiqueta={`Leí y acepto: ${x.titulo}`} />
                  </details>
                ))}
              </FormularioAccion>
            </CardContent>
          </Card>
        )}

        {a.certificadas.size > 0 && (
          <div className="flex flex-wrap gap-2">
            {RUTAS.filter((r) => a.certificadas.has(r.clave)).map((r) => (
              <span key={r.clave} className="inline-flex items-center gap-1.5 rounded-full bg-exito-tint px-3 py-1 text-sm font-medium text-exito-texto">
                <Award className="size-4" aria-hidden /> {r.clave} · {r.nombre}
              </span>
            ))}
          </div>
        )}

        {RUTAS.map((r) => {
          const e = estados.find((x) => x.clave === r.clave)!;
          const mods = MODULOS.filter((m) => m.ruta === r.clave).sort((x, y) => x.orden - y.orden);
          const certificada = a.certificadas.has(r.clave);
          const intentos = a.intentos.filter((i) => i.tipo === "examen_ruta" && i.objetivo === r.clave && i.fin);
          const ultimo = intentos.at(-1);
          const espera = e.puedeExamen ? puedeIntentar(a.intentos.filter((i) => i.tipo === "examen_ruta" && i.objetivo === r.clave), EVALUACION.examen_ruta, ahora.toISOString()) : null;
          const nPreg = PREGUNTAS.filter((p) => p.clave.startsWith(`${r.clave}-`)).length;
          return (
            <Card key={r.clave} className={e.disponible ? "" : "opacity-70"}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {e.disponible ? null : <Lock className="size-4 text-ink-muted" aria-hidden />}
                  <span className="cifra">{r.clave}</span> · {r.nombre}
                </CardTitle>
                <Badge tono={certificada ? "pagado" : e.disponible ? (e.avance > 0 ? "tramite" : "prospecto") : "prospecto"}>
                  {certificada ? "Certificada" : e.disponible ? (e.avance > 0 ? "En curso" : "Sin iniciar") : "Bloqueada"}
                </Badge>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={e.avance} aria-valuemin={0} aria-valuemax={100} aria-label={`Avance ${r.clave}`}>
                    <div className="h-full rounded-full bg-brand" style={{ width: `${e.avance}%` }} />
                  </div>
                  <span className="cifra text-xs text-ink-muted">{e.avance}%</span>
                </div>
                {e.bloqueo && <p className="text-ink-muted">{e.bloqueo}.</p>}
                {e.disponible && (
                  <ul className="grid gap-1">
                    {mods.map((m) => (
                      <li key={m.clave}>
                        <Link href={`/academia/${m.clave}`} className="flex items-center gap-2 rounded-md py-1.5 hover:text-brand">
                          {a.leidos.has(m.clave) ? <CheckCircle2 className="size-4 shrink-0 text-exito" aria-label="Leído" /> : <Circle className="size-4 shrink-0 text-ink-muted" aria-label="Pendiente" />}
                          <span className="cifra text-xs text-ink-muted">{m.clave}</span>
                          <span className="min-w-0 flex-1 text-ink">{m.titulo}</span>
                          <span className="text-xs text-ink-muted">{m.duracion_min} min</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {!certificada && e.disponible && e.pendientes.length > 0 && (
                  <div><p className="text-xs font-medium text-ink">Te falta</p><ul className="mt-1 list-disc pl-5 text-ink-muted">{e.pendientes.map((p) => <li key={p}>{p}</li>)}</ul></div>
                )}
                {!certificada && e.disponible && e.proximamente.length > 0 && (
                  <div><p className="text-xs font-medium text-ink">Para certificarte, además (se habilita en las siguientes fases)</p>
                    <ul className="mt-1 list-disc pl-5 text-ink-muted">{e.proximamente.map((p) => <li key={p}>{p}</li>)}</ul></div>
                )}
                {ultimo && (
                  <p className="text-xs text-ink-muted">Último examen: {fecha(ultimo.fin!)} · {Math.round((ultimo.calificacion ?? 0) * 100)}% · {ultimo.aprobado ? "aprobado" : "no aprobado"}</p>
                )}
                {e.puedeExamen && (
                  espera && !espera.ok
                    ? <p className="text-xs text-aviso">{espera.motivo === "bloqueo" ? "Usaste tus 3 intentos." : "Espera para el siguiente intento."} {espera.desde ? `Desde el ${fecha(espera.desde)}.` : ""}</p>
                    : <Link href={`/academia/evaluar?tipo=examen_ruta&objetivo=${r.clave}`}
                        className="inline-flex h-11 w-fit items-center rounded-[var(--radius-boton)] bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark md:h-10">
                        Presentar examen {r.clave} · {Math.min(nPreg, r.requisitos.examen.n)} preguntas
                      </Link>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
