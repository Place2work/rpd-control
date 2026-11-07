"use client";

import { CheckCircle2, Copy } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Resultado } from "./acciones";

type ConDato = Resultado & { unaVez?: { titulo: string; valor: string; nota?: string } };
type Props = {
  accion: (previo: ConDato, form: FormData) => Promise<ConDato>;
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
  const [estado, enviar, enviando] = useActionState<ConDato, FormData>(accion, {});
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
      {estado.unaVez && !enviando && <DatoUnaVez {...estado.unaVez} />}
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

// Un dato que no se guarda en ningún lado (p. ej. una contraseña temporal): se ve aquí y se copia.
function DatoUnaVez({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div role="status" className="grid gap-2 rounded-[var(--radius-boton)] border border-aviso/40 bg-aviso-tint p-3 text-sm">
      <p className="font-medium text-ink">{titulo}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="cifra rounded bg-surface px-3 py-2 font-mono text-base tracking-wide text-ink">{valor}</code>
        <Button type="button" variant="secundario" className="h-9 px-3" onClick={() => { navigator.clipboard?.writeText(valor).then(() => setCopiado(true)).catch(() => {}); }}>
          <Copy aria-hidden /> {copiado ? "Copiada" : "Copiar"}
        </Button>
      </div>
      {nota && <p className="text-xs text-ink-muted">{nota}</p>}
    </div>
  );
}
