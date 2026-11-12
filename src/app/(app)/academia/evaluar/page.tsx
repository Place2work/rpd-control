import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { exigirRol } from "@/lib/auth/sesion";
import { MODULOS, RUTAS } from "@/lib/academia/contenido";
import { Evaluacion } from "./evaluacion";

export const metadata: Metadata = { title: "Evaluación · Academia" };

type Props = { searchParams: Promise<{ tipo?: string; objetivo?: string }> };

export default async function Evaluar({ searchParams }: Props) {
  await exigirRol("director", "asesor", "socio");
  const { tipo, objetivo = "" } = await searchParams;
  if (tipo !== "quiz_modulo" && tipo !== "examen_ruta") notFound();
  const modulo = MODULOS.find((m) => m.clave === objetivo);
  const ruta = RUTAS.find((r) => r.clave === objetivo);
  if (tipo === "quiz_modulo" ? !modulo : !ruta) notFound();
  const titulo = tipo === "quiz_modulo" ? `Quiz de ${modulo!.clave} · ${modulo!.titulo}` : `Examen de ruta ${ruta!.clave} · ${ruta!.nombre}`;
  const volver = tipo === "quiz_modulo" ? `/academia/${objetivo}` : "/academia";
  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <Link href={volver} className="inline-flex w-fit items-center gap-1.5 text-sm text-brand hover:underline"><ArrowLeft className="size-4" aria-hidden /> Regresar</Link>
      <h1 className="font-display text-[22px] font-semibold text-ink md:text-[26px]">{titulo}</h1>
      <Evaluacion tipo={tipo} objetivo={objetivo} titulo={titulo} volver={volver} />
    </div>
  );
}
