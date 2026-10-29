"use client";

// «Crear caso del servicio sugerido» (resultado NO_ELEGIBLE_DESVIO). Al crearlo, el servidor lleva al caso nuevo.
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { crearDesvio, type ResultadoDesvio } from "./acciones-desvio";

export function BotonDesvio({ casoId, sugerido, servicios }: { casoId: string; sugerido: string | null; servicios: { clave: string; nombre: string }[] }) {
  const [estado, enviar, enviando] = useActionState<ResultadoDesvio, FormData>(crearDesvio.bind(null, casoId), {});

  return (
    <form action={enviar} className="grid gap-3 rounded-md border border-brand/30 p-4">
      <p className="text-sm text-ink">Abre un caso nuevo para la misma persona, con los datos del IMSS ya capturados. Este caso pasa a «Perdido o desvío».</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="desvio-servicio">Servicio</Label>
          <select id="desvio-servicio" name="servicio" defaultValue={sugerido ?? ""} required
            className="h-11 rounded-[var(--radius-boton)] border border-borde bg-surface px-3 text-sm text-ink md:h-10">
            <option value="" disabled>Elige el servicio</option>
            {servicios.map((s) => <option key={s.clave} value={s.clave}>{s.nombre}{s.clave === sugerido ? " (sugerido)" : ""}</option>)}
          </select>
        </div>
        <Button type="submit" disabled={enviando}>{enviando ? "Creando…" : "Crear caso del servicio"}</Button>
      </div>
      {estado.error && <p role="alert" className="text-sm text-critico">{estado.error}</p>}
      {estado.aviso && (
        <p role="status" className="text-sm text-ink">
          {estado.aviso} <a href={`/casos/${estado.nuevoId}`} className="text-brand underline">Abrir el caso {estado.folio}</a>
        </p>
      )}
    </form>
  );
}
