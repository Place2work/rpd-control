import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileQuestion, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { exigirRol } from "@/lib/auth/sesion";
import { conUsuario, prismaSistema } from "@/lib/db/prisma";
import { PREGUNTAS } from "@/lib/academia/contenido";
import { obligadosDe } from "@/lib/academia/vigencia";
import { parametrosVigentes } from "@/lib/parametros";
import { CampoTexto } from "../../casos/[id]/campos";
import { FormularioAccion } from "../../casos/[id]/formulario-accion";
import { BotonAccion } from "../../configuracion/boton-accion";
import { confirmarPregunta, procesarCambiosAhora, publicarMicroleccion } from "../acciones";

export const metadata: Metadata = { title: "Contenido · Academia" };
const fecha = (d: Date) => new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "UTC" }).format(d);

// Contenido (CAPACITACION.md 9.6 y 12.1): preguntas en revisión por un cambio de parámetro y microlecciones de
// actualización. Solo el Director.
export default async function Contenido() {
  const sesion = await exigirRol("director");
  const d = await conUsuario(sesion.claims, async (tx) => ({
    revisar: await tx.capPreguntaRevision.findMany({ where: { estado: "revisar" }, orderBy: { created_at: "asc" },
      select: { id: true, pregunta: true, version: true, cambio: { select: { parametro_clave: true, anterior: true, valor: true, vigente_desde: true } } } }),
    acts: await tx.capActualizacion.findMany({ where: { archivado_at: null }, orderBy: { vigente_desde: "desc" }, take: 20,
      select: { id: true, titulo: true, estado: true, vigente_desde: true, publicada_at: true, fecha_limite: true, parametro_clave: true } }),
  }), sesion.ip);
  // Avance de cada microlección publicada: aprobaron / deben tomarla (el motor sabe quién está obligado).
  const avance = new Map(await Promise.all(d.acts.filter((a) => a.publicada_at).map(async (a) => {
    const [obligados, aprobaron] = await Promise.all([obligadosDe(a.publicada_at!), prismaSistema.capActualizacionUsuario.count({ where: { actualizacion_id: a.id } })]);
    return [a.id, { obligados: obligados.length, aprobaron }] as const;
  })));
  const plazo = (await parametrosVigentes(["CAP_ACTUALIZACION_DIAS"])).CAP_ACTUALIZACION_DIAS ?? "—";
  // Una pregunta puede estar en revisión por varios cambios: se muestra una vez.
  const preguntas = [...new Map(d.revisar.map((r) => [`${r.pregunta}:${r.version}`, r])).values()];

  return (
    <>
      <Encabezado titulo="Contenido de la Academia" descripcion="Cuando cambia un parámetro (UMA, honorario, plazos…), las preguntas que dependen de él dejan de servirse hasta que confirmes que siguen correctas, y se prepara una microlección.">
        <Link href="/academia/equipo" className="inline-flex items-center gap-1.5 text-sm text-brand underline"><ArrowLeft className="size-4" aria-hidden /> Avance del equipo</Link>
      </Encabezado>
      <div className="grid gap-4">
        <Card className={preguntas.length ? "border-aviso/40" : ""}>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileQuestion className="size-5 text-aviso" aria-hidden /> Preguntas en revisión</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm">
            {preguntas.length === 0 ? <p className="text-ink-muted">No hay preguntas en revisión.</p> : preguntas.map((r) => {
              const p = PREGUNTAS.find((x) => x.clave === r.pregunta && x.version === r.version);
              return (
                <div key={r.id} className="grid gap-2 border-b border-borde pb-4 last:border-0 last:pb-0">
                  <p className="text-xs text-ink-muted"><span className="cifra">{r.pregunta}</span> · cambió {r.cambio.parametro_clave}: {r.cambio.anterior} → <strong className="text-ink">{r.cambio.valor}</strong> desde el {fecha(r.cambio.vigente_desde)}</p>
                  {p ? (
                    <>
                      <p className="font-medium text-ink">{p.enunciado}</p>
                      {p.tipo === "opcion_multiple"
                        ? <ul className="list-disc pl-5 text-ink-muted">{p.opciones.map((o, i) => <li key={i} className={i === p.correcta ? "font-medium text-exito-texto" : ""}>{o}{i === p.correcta ? " ← correcta" : ""}</li>)}</ul>
                        : <p className="text-ink-muted">Respuesta: <strong className="text-exito-texto">{p.correcta.toLocaleString("es-MX")}</strong>{p.tolerancia ? ` (±${p.tolerancia})` : ""}</p>}
                      {p.explicacion && <p className="text-xs text-ink-muted">{p.explicacion}</p>}
                    </>
                  ) : <p className="text-ink-muted">Esta versión ya no existe en el contenido.</p>}
                  <FormularioAccion accion={confirmarPregunta.bind(null, r.pregunta, r.version)} boton="Sigue correcta" className="grid gap-2">
                    <CampoTexto id="nota" etiqueta="Nota (opcional)" placeholder="El ejemplo usa la UMA de 2026 a propósito" />
                  </FormularioAccion>
                </div>
              );
            })}
            {preguntas.length > 0 && <p className="text-xs text-ink-muted">Si una pregunta ya no es correcta, pide que se corrija en el contenido (content/academia): al subir de versión deja de estar en revisión.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><RefreshCw className="size-5 text-brand" aria-hidden /> Microlecciones de actualización</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p className="text-ink-muted">Se preparan solas con los valores nuevos y se publican el día que entra en vigor el parámetro; puedes publicarlas antes. Desde la publicación, el asesor de pensiones tiene {plazo} días para aprobar el quiz de 5 preguntas o sus certificaciones se suspenden.</p>
            {d.acts.length === 0 ? <p className="text-ink-muted">Todavía no hay microlecciones.</p> : (
              <ul className="grid gap-3">
                {d.acts.map((a) => {
                  const av = avance.get(a.id);
                  return (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-3 last:border-0 last:pb-0">
                      <span>
                        <Link href={`/academia/actualizacion/${a.id}`} className="font-medium text-brand hover:underline">{a.titulo}</Link>
                        <span className="block text-xs text-ink-muted">{a.parametro_clave} · vigente desde {fecha(a.vigente_desde)}{a.fecha_limite ? ` · límite ${fecha(a.fecha_limite)}` : ""}{av ? ` · aprobaron ${av.aprobaron} de ${av.obligados}` : ""}</span>
                      </span>
                      {a.estado === "borrador"
                        ? <span className="flex items-center gap-2"><Badge tono="espera">Preparada</Badge><BotonAccion accion={publicarMicroleccion.bind(null, a.id)} texto="Publicar ahora" confirmar="¿Publicarla ya? Corre el plazo para que la aprueben." /></span>
                        : <Badge tono="pagado">Publicada</Badge>}
                    </li>
                  );
                })}
              </ul>
            )}
            <div><BotonAccion accion={procesarCambiosAhora} texto="Revisar cambios de parámetros ahora" variante="fantasma" /></div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
