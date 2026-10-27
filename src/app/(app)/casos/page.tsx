import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Encabezado } from "@/components/rpd/encabezado";

export const metadata: Metadata = { title: "Casos" };

// Etapas del retiro (6.1) con su familia de color (11.3).
const COLUMNAS = [
  { clave: "PROSPECTO", titulo: "Prospecto", tono: "prospecto" },
  { clave: "PRECALIFICADO", titulo: "Precalificado", tono: "tramite" },
  { clave: "EN_ESPERA", titulo: "En espera", tono: "espera" },
  { clave: "CONTRATO", titulo: "Contrato firmado", tono: "tramite" },
  { clave: "EXPEDIENTE", titulo: "Armando expediente", tono: "tramite" },
  { clave: "INGRESADA", titulo: "Ingresada a Afore", tono: "tramite" },
  { clave: "RESOLUCION", titulo: "Resolución Afore", tono: "tramite" },
  { clave: "PAGADO", titulo: "Pagado por Afore", tono: "pagado" },
  { clave: "CERRADO", titulo: "Honorario cobrado", tono: "pagado" },
  { clave: "BLOQUEADO", titulo: "Bloqueado o rechazado", tono: "critico" },
  { clave: "PERDIDO", titulo: "Perdido o desvío", tono: "perdido" },
] as const;

export default function Casos() {
  return (
    <>
      <Encabezado titulo="Casos" descripcion="Retiro por desempleo · cada tarjeta cambia de etapa solo si cumple el requisito." />
      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        <div className="flex gap-3" role="list" aria-label="Etapas">
          {COLUMNAS.map((c) => (
            <section key={c.clave} role="listitem" aria-label={c.titulo} className="flex w-64 shrink-0 flex-col rounded-[var(--radius-tarjeta)] bg-slate-100/70 p-3">
              <div className="mb-3 flex items-center justify-between">
                <Badge tono={c.tono}>{c.titulo}</Badge>
                <span className="cifra text-xs text-ink-muted">0</span>
              </div>
              <p className="rounded-lg border border-dashed border-borde px-3 py-6 text-center text-xs text-ink-muted">Sin casos</p>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
