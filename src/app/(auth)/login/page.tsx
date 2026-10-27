import type { Metadata } from "next";
import { Suspense } from "react";
import { FormularioLogin } from "./formulario";

export const metadata: Metadata = { title: "Iniciar sesión" };

const MOTIVOS: Record<string, string> = {
  inactividad: "Cerramos tu sesión tras 30 minutos sin actividad.",
  "sin-acceso": "Tu cuenta no tiene acceso activo. Pídeselo al Director.",
};

type Props = { searchParams: Promise<{ motivo?: string }> };

export default function Login({ searchParams }: Props) {
  return (
    <Suspense fallback={<div aria-busy="true" className="h-80 animate-pulse rounded-[var(--radius-tarjeta)] bg-slate-200/60" />}>
      <ConAviso searchParams={searchParams} />
    </Suspense>
  );
}

async function ConAviso({ searchParams }: Props) {
  const { motivo } = await searchParams;
  return <FormularioLogin aviso={motivo ? MOTIVOS[motivo] : undefined} />;
}
