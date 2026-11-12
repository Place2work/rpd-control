import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Leccion } from "@/components/rpd/leccion";
import { exigirRol } from "@/lib/auth/sesion";
import { MODULOS, PREGUNTAS, RUTAS } from "@/lib/academia/contenido";
import { bloquesMarkdown } from "@/lib/academia/markdown";
import { avanceDe, estadosDe } from "@/lib/academia/motor";
import { FormularioAccion } from "../../casos/[id]/formulario-accion";
import { marcarLeido } from "../acciones";

type Props = { params: Promise<{ modulo: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { modulo } = await params;
  const m = MODULOS.find((x) => x.clave === modulo);
  return { title: m ? `${m.clave} · ${m.titulo}` : "Academia" };
}

export default async function LeccionPagina({ params }: Props) {
  const sesion = await exigirRol("director", "asesor", "socio");
  const { modulo } = await params;
  const m = MODULOS.find((x) => x.clave === modulo);
  if (!m) notFound();
  const ruta = RUTAS.find((r) => r.clave === m.ruta)!;
  const a = await avanceDe(sesion.usuario.id);
  const estado = estadosDe(a).find((e) => e.clave === ruta.clave)!;
  const hermanos = MODULOS.filter((x) => x.ruta === m.ruta).sort((x, y) => x.orden - y.orden);
  const siguiente = hermanos[hermanos.findIndex((x) => x.clave === m.clave) + 1];
  const leido = a.leidos.has(m.clave);
  const nQuiz = PREGUNTAS.filter((p) => p.modulo === m.clave).length;

  return (
    <article className="mx-auto grid max-w-3xl gap-4">
      <Link href="/academia" className="inline-flex w-fit items-center gap-1.5 text-sm text-brand hover:underline"><ArrowLeft className="size-4" aria-hidden /> Regresar a Academia</Link>
      <header>
        <p className="cifra text-xs font-medium text-brand">{ruta.clave} · {ruta.nombre} · {m.clave}</p>
        <h1 className="mt-1 font-display text-[22px] font-semibold text-ink md:text-[28px]">{m.titulo}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted"><Clock className="size-4" aria-hidden /> {m.duracion_min} min</p>
      </header>
      {!estado.disponible ? (
        <Card><CardContent className="text-sm text-ink-muted">{estado.bloqueo}. Termina primero la Inducción.</CardContent></Card>
      ) : (
        <>
          <Card><CardContent className="pt-5"><Leccion bloques={bloquesMarkdown(m.contenido)} /></CardContent></Card>
          {m.fuentes.length > 0 && <p className="text-xs text-ink-muted">Fuentes internas: {m.fuentes.join(" · ")}</p>}
          <div className="flex flex-wrap items-center gap-3">
            {leido ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-exito-texto"><CheckCircle2 className="size-5" aria-hidden /> Leída</span>
            ) : (
              <FormularioAccion accion={marcarLeido.bind(null, m.clave)} boton="Marcar como leída"><span className="sr-only">Marcar {m.clave} como leída</span></FormularioAccion>
            )}
            {nQuiz > 0 && (
              <Link href={`/academia/evaluar?tipo=quiz_modulo&objetivo=${m.clave}`}
                className="inline-flex h-11 items-center rounded-[var(--radius-boton)] border border-brand px-4 text-sm font-medium text-brand hover:bg-brand-tint md:h-10">
                Practicar con el quiz ({nQuiz} {nQuiz === 1 ? "pregunta" : "preguntas"})
              </Link>
            )}
            {siguiente && <Link href={`/academia/${siguiente.clave}`} className="text-sm text-brand underline">Siguiente: {siguiente.clave} · {siguiente.titulo}</Link>}
          </div>
        </>
      )}
    </article>
  );
}
