import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, FlaskConical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { exigirRol } from "@/lib/auth/sesion";
import { CASOS, RUTAS } from "@/lib/academia/contenido";
import { avanceDe, estadosDe } from "@/lib/academia/motor";
import type { CasoServido } from "@/lib/academia/tipos";
import { Simulador } from "./simulador";

export const metadata: Metadata = { title: "Simulador · Academia" };

export default async function CasoPagina({ params }: { params: Promise<{ clave: string }> }) {
  const sesion = await exigirRol("director", "asesor", "socio");
  const { clave } = await params;
  const caso = CASOS.find((c) => c.clave === clave);
  if (!caso) notFound();
  const ruta = RUTAS.find((r) => r.clave === caso.ruta)!;
  const a = await avanceDe(sesion.usuario.id);
  const estado = estadosDe(a).find((e) => e.clave === ruta.clave)!;
  // Al navegador solo va lo necesario: nunca la respuesta.
  const servido: CasoServido = { clave: caso.clave, ruta: caso.ruta, titulo: caso.titulo, narrativa: caso.narrativa, tipo: caso.tipo,
    captura: caso.tipo === "retiro" ? caso.captura : undefined, opciones: caso.tipo === "opcion" ? caso.opciones : undefined };
  return (
    <article className="mx-auto grid max-w-2xl gap-4">
      <Link href="/academia" className="inline-flex w-fit items-center gap-1.5 text-sm text-brand hover:underline"><ArrowLeft className="size-4" aria-hidden /> Regresar a Academia</Link>
      <header>
        <p className="flex items-center gap-1.5 text-xs font-medium text-brand"><FlaskConical className="size-4" aria-hidden /> Simulador · {ruta.clave} · <span className="cifra">{caso.clave}</span></p>
        <h1 className="mt-1 font-display text-[22px] font-semibold text-ink md:text-[26px]">{caso.titulo}</h1>
        {a.casosAprobados?.has(caso.clave) && <p className="mt-1 flex items-center gap-1.5 text-sm text-exito-texto"><CheckCircle2 className="size-4" aria-hidden /> Ya lo resolviste bien</p>}
      </header>
      {!estado.disponible ? (
        <Card><CardContent className="text-sm text-ink-muted">{estado.bloqueo}.</CardContent></Card>
      ) : (
        <>
          <Card><CardContent className="grid gap-2 pt-5 text-[15px] leading-relaxed text-ink-muted">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Caso ficticio · hoy es {caso.tipo === "retiro" ? new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${caso.hoy}T00:00:00Z`)) : "la fecha de hoy"}</p>
            <p className="text-ink">{caso.narrativa}</p>
          </CardContent></Card>
          <Simulador caso={servido} volver="/academia" />
        </>
      )}
    </article>
  );
}
