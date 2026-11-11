"use client";

// Fila desplegable de un asesor o referidor: al abrirla, la URL guarda cuál está abierta (?abierto=…#…)
// para que «Regresar» desde el expediente vuelva con el mismo asesor desplegado.
import { recordarUrlActual } from "@/components/rpd/regresar";

export function Desplegable({ clave, abierto, children }: { clave: string; abierto: boolean; children: React.ReactNode }) {
  const id = clave.replace(":", "-");
  return (
    <details id={id} open={abierto || undefined} className="group scroll-mt-24 rounded-[var(--radius-boton)] border border-borde"
      onToggle={(e) => {
        const url = new URL(window.location.href);
        if (e.currentTarget.open) { url.searchParams.set("abierto", clave); url.hash = id; }
        else if (url.searchParams.get("abierto") === clave) { url.searchParams.delete("abierto"); url.hash = ""; }
        else return;
        window.history.replaceState(window.history.state, "", url);
        recordarUrlActual();
      }}>
      {children}
    </details>
  );
}
