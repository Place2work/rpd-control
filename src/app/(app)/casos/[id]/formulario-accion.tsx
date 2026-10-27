"use client";

import { CheckCircle2 } from "lucide-react";
import { startTransition, useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { Resultado } from "./acciones";

type Props = {
  accion: (previo: Resultado, form: FormData) => Promise<Resultado>;
  children: React.ReactNode;
  boton?: string;
  etiquetas?: Record<string, string>;
  className?: string;
};

// Formulario genérico del expediente: los campos llegan como children (renderizados en el
// servidor) y aquí se muestra el resultado: "Guardado", errores por campo o lo que falta.
// Se envía con onSubmit (no con action=) porque React 19 vacía los campos después de cada
// envío por action: si había un error, el usuario perdía lo que acababa de escribir.
export function FormularioAccion({ accion, children, boton = "Guardar", etiquetas = {}, className }: Props) {
  const [estado, enviar, enviando] = useActionState(accion, {});
  const errores = Object.entries(estado.errores ?? {});
  return (
    <form
      className={className ?? "grid gap-4"}
      onSubmit={(e) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        startTransition(() => enviar(datos));
      }}
    >
      {children}
      {(errores.length > 0 || estado.error || estado.faltantes?.length) && (
        <div role="alert" className="rounded-[var(--radius-boton)] bg-critico-tint p-3 text-sm text-critico">
          {estado.error && <p>{estado.error}</p>}
          {estado.faltantes?.length ? (
            <>
              <p className="font-medium">Todavía no se puede:</p>
              <ul className="mt-1 list-disc pl-5">{estado.faltantes.map((f) => <li key={f}>{f}</li>)}</ul>
            </>
          ) : null}
          {errores.length > 0 && (
            <ul className="list-disc pl-5">{errores.map(([k, v]) => <li key={k}>{etiquetas[k] ?? k}: {v}</li>)}</ul>
          )}
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={enviando}>{enviando ? "Guardando…" : boton}</Button>
        {estado.ok && !enviando && (
          <span role="status" className="inline-flex items-center gap-1 text-sm text-exito-texto">
            <CheckCircle2 className="size-4" aria-hidden /> Guardado
          </span>
        )}
      </div>
    </form>
  );
}
