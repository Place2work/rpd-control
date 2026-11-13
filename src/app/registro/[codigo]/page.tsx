import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Marca } from "@/components/rpd/marca";
import { prismaSistema } from "@/lib/db/prisma";
import { selloFormulario } from "@/lib/campo/formulario";
import { hoyCDMX } from "@/lib/tiempo";
import { FormularioRegistro } from "./formulario";

export const metadata: Metadata = { title: "Regístrate · Retiro por Desempleo", robots: { index: false, follow: false } };
type Props = { params: Promise<{ codigo: string }> };

// Formulario público del QR del gerente de campo: la persona deja sus datos desde su celular.
export default function Registro({ params }: Props) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 py-8">
      <Marca />
      <Suspense fallback={<div aria-busy="true" className="h-96 animate-pulse rounded-[var(--radius-tarjeta)] bg-slate-200/60" />}>
        <Contenido params={params} />
      </Suspense>
      <p className="text-center text-xs text-ink-muted">Servicio privado de asesoría. No estamos afiliados ni autorizados por CONSAR, IMSS ni ninguna Afore.</p>
    </main>
  );
}

async function Contenido({ params }: Props) {
  await connection();
  const { codigo } = await params;
  const gerente = /^[a-z0-9]{8}$/.test(codigo)
    ? await prismaSistema.usuario.findFirst({ where: { campo_codigo: codigo, rol: "campo", activo: true, archivado_at: null }, select: { id: true, nombre: true } })
    : null;
  if (!gerente) {
    return (
      <div className="rounded-[var(--radius-tarjeta)] border border-borde bg-surface p-5">
        <h1 className="font-display text-xl font-semibold text-ink">Esta liga ya no está activa</h1>
        <p className="mt-2 text-sm text-ink-muted">Escríbenos por WhatsApp al 56 6474 9567 y con gusto te atendemos.</p>
      </div>
    );
  }
  const [jornada, servicios] = await Promise.all([
    prismaSistema.campoJornada.findFirst({ where: { gerente_id: gerente.id, fecha: new Date(`${hoyCDMX()}T00:00:00Z`), estado: { not: "rechazada" } }, select: { municipio: true } }),
    prismaSistema.tipoServicio.findMany({ where: { activo: true }, orderBy: { orden: "asc" }, select: { clave: true, nombre: true } }),
  ]);
  const primerNombre = gerente.nombre.split(/\s+/)[0].toLowerCase().replace(/^./, (c) => c.toUpperCase());
  return (
    <FormularioRegistro codigo={codigo} sello={selloFormulario()} promotor={primerNombre} municipio={jornada?.municipio ?? ""}
      servicios={servicios.map((x) => [x.clave, x.nombre.split(" (")[0]] as const)} />
  );
}
