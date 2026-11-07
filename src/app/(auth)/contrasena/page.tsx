import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { modoDemo } from "@/lib/auth/demo";
import { debeCambiarClave } from "@/lib/auth/sesion";
import type { ClaimsUsuario } from "@/lib/db/prisma";
import { crearClienteServidor } from "@/lib/supabase/server";
import { DefinirContrasena } from "./definir-contrasena";

export const metadata: Metadata = { title: "Define tu contraseña" };

export default function Contrasena() {
  return (
    <Suspense fallback={<div aria-busy="true" className="h-80 animate-pulse rounded-[var(--radius-tarjeta)] bg-slate-200/60" />}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  await connection();
  let temporal = false;
  if (!modoDemo()) {
    const { data } = await (await crearClienteServidor()).auth.getClaims();
    const claims = data?.claims as ClaimsUsuario | undefined;
    temporal = Boolean(claims && debeCambiarClave(claims));
    // Con contraseña temporal, primero el segundo factor; después la contraseña propia.
    if (temporal && claims?.aal !== "aal2") redirect("/mfa");
  }
  return <DefinirContrasena temporal={temporal} />;
}
