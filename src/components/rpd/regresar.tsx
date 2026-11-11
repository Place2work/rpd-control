"use client";

// «Regresar»: recuerda la última pantalla fuera de un expediente (en esta pestaña del navegador) para volver
// exactamente ahí desde el caso, aunque se haya cambiado de pestaña dentro del expediente.
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MODULOS } from "./navegacion";

const CLAVE = "rpd:volver";
const esExpediente = (ruta: string) => /^\/casos\/[^/]+/.test(ruta);
const segura = (url: string | null) => (url && url.startsWith("/") && !url.startsWith("//") && !esExpediente(url) ? url : null);

function guardar(url: string) {
  try { sessionStorage.setItem(CLAVE, url); } catch { /* sin almacenamiento: se regresa a Casos */ }
}

/** Va en el layout: guarda cada pantalla que no sea un expediente. */
export function RecordarPantalla() {
  const ruta = usePathname();
  const params = useSearchParams();
  useEffect(() => {
    if (esExpediente(ruta)) return;
    const q = params.toString();
    guardar(`${ruta}${q ? `?${q}` : ""}${window.location.hash}`);
  }, [ruta, params]);
  return null;
}

/** Para pantallas que cambian lo que se ve sin navegar (p. ej. un asesor desplegado). */
export function recordarUrlActual() {
  guardar(`${window.location.pathname}${window.location.search}${window.location.hash}`);
}

function nombreDe(url: string) {
  const ruta = url.split(/[?#]/)[0];
  const m = MODULOS.filter((x) => ruta === x.href || ruta.startsWith(`${x.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
  return m?.titulo ?? "la pantalla anterior";
}

export function BotonRegresar() {
  const [destino, setDestino] = useState("/casos");
  useEffect(() => {
    let v: string | null = null;
    try { v = segura(sessionStorage.getItem(CLAVE)); } catch { /* nada */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage solo existe en el navegador
    if (v) setDestino(v);
  }, []);
  return (
    <Link href={destino} className="mb-3 inline-flex items-center gap-1.5 rounded-[var(--radius-boton)] py-1 pr-2 text-sm text-brand hover:underline">
      <ArrowLeft className="size-4" aria-hidden /> Regresar a {nombreDe(destino)}
    </Link>
  );
}
