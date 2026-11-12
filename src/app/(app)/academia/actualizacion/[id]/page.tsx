import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Leccion } from "@/components/rpd/leccion";
import { exigirRol } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { bloquesMarkdown } from "@/lib/academia/markdown";
import { MODULOS } from "@/lib/academia/contenido";
import { MICROLECCIONES } from "@/lib/academia/contenido";

export const metadata: Metadata = { title: "Actualización · Academia" };
const fecha = (d: Date) => new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "UTC" }).format(d);

// Microlección de actualización (CAPACITACION.md 9.5): se lee y se aprueba con un quiz de 5 preguntas.
export default async function Actualizacion({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirRol("director", "asesor", "socio");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await conUsuario(sesion.claims, async (tx) => ({
    act: await tx.capActualizacion.findFirst({ where: { id, archivado_at: null }, select: { id: true, titulo: true, contenido: true, estado: true, fecha_limite: true, plantilla: true } }),
    aprobada: await tx.capActualizacionUsuario.findFirst({ where: { actualizacion_id: id, usuario_id: sesion.usuario.id }, select: { aprobada_at: true } }),
  }), sesion.ip);
  if (!d.act) notFound();
  const relacionados = MICROLECCIONES.find((m) => m.clave === d.act!.plantilla)?.modulos ?? [];
  return (
    <article className="mx-auto grid max-w-2xl gap-4">
      <Link href={sesion.usuario.rol === "director" ? "/academia/contenido" : "/academia"} className="inline-flex w-fit items-center gap-1.5 text-sm text-brand hover:underline"><ArrowLeft className="size-4" aria-hidden /> Regresar</Link>
      <header>
        <p className="flex items-center gap-1.5 text-xs font-medium text-brand"><RefreshCw className="size-4" aria-hidden /> Microlección de actualización{d.act.estado === "borrador" ? " · vista previa (sin publicar)" : ""}</p>
        <h1 className="mt-1 font-display text-[22px] font-semibold text-ink md:text-[26px]">{d.act.titulo}</h1>
        {d.act.fecha_limite && <p className="mt-1 text-sm text-ink-muted">Apruébala a más tardar el {fecha(d.act.fecha_limite)}; si no, tus certificaciones se suspenden hasta que la apruebes.</p>}
      </header>
      <Card><CardContent className="pt-5"><Leccion bloques={bloquesMarkdown(d.act.contenido)} /></CardContent></Card>
      {relacionados.length > 0 && (
        <p className="text-sm text-ink-muted">Lección relacionada: {relacionados.map((m, i) => <span key={m}>{i ? ", " : ""}<Link href={`/academia/${m}`} className="text-brand underline">{m} · {MODULOS.find((x) => x.clave === m)?.titulo}</Link></span>)}</p>
      )}
      {d.aprobada ? (
        <p className="inline-flex items-center gap-2 text-sm font-medium text-exito-texto"><CheckCircle2 className="size-5" aria-hidden /> Aprobada</p>
      ) : d.act.estado === "publicada" ? (
        <Link href={`/academia/evaluar?tipo=actualizacion&objetivo=${d.act.id}`}
          className="inline-flex h-11 w-fit items-center rounded-[var(--radius-boton)] bg-brand px-5 text-sm font-medium text-white hover:bg-brand-dark">Presentar el quiz · 5 preguntas</Link>
      ) : null}
    </article>
  );
}
