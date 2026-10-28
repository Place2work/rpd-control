"use client";

import { Calculator } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { calcularPrecalificacion } from "./acciones-calculo";

export function BotonCalcular({ casoId, modalidad, texto = "Calcular" }: { casoId: string; modalidad: "A" | "B" | null; texto?: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [r, setR] = useState<{ error?: string; faltantes?: string[] }>({});
  return (
    <div className="flex flex-col gap-2">
      <Button type="button" disabled={pendiente} onClick={() => iniciar(async () => {
        const x = await calcularPrecalificacion(casoId, modalidad);
        setR(x);
        if (x.ok) router.refresh();
      })}>
        <Calculator aria-hidden /> {pendiente ? "Calculando…" : texto}
      </Button>
      {r.error && <p role="alert" className="text-sm text-critico">{r.error}</p>}
      {r.faltantes && (
        <div role="alert" className="text-sm text-critico">
          Falta capturar: <ul className="list-disc pl-5">{r.faltantes.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
