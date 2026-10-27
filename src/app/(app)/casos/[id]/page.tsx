import { CheckCircle2, MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { obtenerSesion } from "@/lib/auth/sesion";
import { nombreCompleto, obtenerCaso } from "@/lib/prospectos/consultas";
import { cn } from "@/lib/utils";
import { PestanaDatos } from "./pestanas/datos";
import { PestanaImss } from "./pestanas/imss";
import { PestanaResumen } from "./pestanas/resumen";
import { PestanaSeguimiento } from "./pestanas/seguimiento";

export const metadata: Metadata = { title: "Expediente" };

// 10.4. Pestañas listas: Resumen, Datos personales, IMSS y Afore, Seguimiento. El resto llega en las siguientes.
const PESTANAS = [
  ["resumen", "Resumen"],
  ["datos", "Datos personales"],
  ["imss", "IMSS y Afore"],
  ["calculo", "Cálculo"],
  ["documentos", "Documentos"],
  ["seguimiento", "Seguimiento"],
  ["dinero", "Dinero"],
  ["contrato", "Contrato"],
] as const;
const LISTAS = new Set(["resumen", "datos", "imss", "seguimiento"]);

const ETAPA: Record<string, { texto: string; tono: "prospecto" | "espera" | "tramite" | "pagado" | "perdido" | "critico" }> = {
  PROSPECTO: { texto: "Prospecto", tono: "prospecto" },
  PRECALIFICADO: { texto: "Precalificado", tono: "tramite" },
  EN_ESPERA: { texto: "En espera", tono: "espera" },
  CONTRATO: { texto: "Contrato firmado", tono: "tramite" },
  EXPEDIENTE: { texto: "Armando expediente", tono: "tramite" },
  INGRESADA: { texto: "Ingresada a Afore", tono: "tramite" },
  RESOLUCION: { texto: "Resolución Afore", tono: "tramite" },
  PAGADO: { texto: "Pagado por Afore", tono: "pagado" },
  CERRADO: { texto: "Honorario cobrado", tono: "pagado" },
  BLOQUEADO: { texto: "Bloqueado", tono: "critico" },
  PERDIDO: { texto: "Perdido", tono: "perdido" },
};
const REGIMEN: Record<string, string> = { L73: "Ley 73", L97: "Ley 97", por_definir: "Régimen por definir" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; nuevo?: string }> };

export default async function Expediente({ params, searchParams }: Props) {
  const sesion = await obtenerSesion();
  const [{ id }, { tab = "resumen", nuevo }] = await Promise.all([params, searchParams]);
  const caso = await obtenerCaso(sesion, id);
  if (!caso) notFound();

  const pestana = LISTAS.has(tab) ? tab : "resumen";
  const nombre = nombreCompleto(caso.persona);
  const etapa = ETAPA[caso.etapa] ?? { texto: caso.etapa, tono: "prospecto" as const };
  const wa = caso.persona.whatsapp?.replace("+", "");
  const saludo = encodeURIComponent(`Hola ${caso.persona.nombre}, te escribimos de RetiroPorDesempleo.com.`);

  return (
    <>
      {nuevo && (
        <div role="status" className="mb-4 flex items-center gap-2 rounded-[var(--radius-tarjeta)] bg-exito-tint px-4 py-3 text-sm text-exito-texto">
          <CheckCircle2 className="size-5" aria-hidden /> Alta lista. Folio <span className="cifra font-semibold">{caso.folio}</span>.
        </div>
      )}

      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[22px] font-semibold text-ink md:text-[28px]">{nombre}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <span className="cifra font-medium text-ink">{caso.folio}</span>
            <span>·</span> {caso.servicio.nombre.split(" (")[0]}
            <Badge tono={etapa.tono}>{etapa.texto}</Badge>
            {caso.datos_imss && <span>· {REGIMEN[caso.datos_imss.regimen]}</span>}
            <span>· {caso.asignado ? `Asignado a ${caso.asignado.nombre}` : "Bandeja general"}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {wa && (
            <a href={`https://wa.me/${wa}?text=${saludo}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-boton)] bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark md:h-10">
              <MessageCircle className="size-4" aria-hidden /> WhatsApp
            </a>
          )}
          {caso.persona.telefono && (
            <a href={`tel:${caso.persona.telefono}`}
              className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-boton)] border border-brand px-4 text-sm font-medium text-brand hover:bg-brand-tint md:h-10">
              <Phone className="size-4" aria-hidden /> Llamar
            </a>
          )}
        </div>
      </header>

      <nav aria-label="Secciones del expediente" className="-mx-4 mb-4 overflow-x-auto border-b border-borde px-4 md:mx-0 md:px-0">
        <ul className="flex gap-1">
          {PESTANAS.map(([clave, texto]) => {
            const activa = clave === pestana;
            const lista = LISTAS.has(clave);
            return (
              <li key={clave}>
                {lista ? (
                  <Link href={`/casos/${caso.id}?tab=${clave}`} aria-current={activa ? "page" : undefined}
                    className={cn("inline-block whitespace-nowrap border-b-2 px-3 py-3 text-sm",
                      activa ? "border-brand font-medium text-brand" : "border-transparent text-ink-muted hover:text-ink")}>
                    {texto}
                  </Link>
                ) : (
                  <span className="inline-block cursor-not-allowed whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm text-ink-muted/50"
                    title="Llega en la siguiente entrega">{texto}</span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {pestana === "resumen" && <PestanaResumen caso={caso} sesion={sesion} />}
      {pestana === "datos" && <PestanaDatos caso={caso} puedeVer={sesion.usuario.rol !== "vendedor"} />}
      {pestana === "imss" && <PestanaImss caso={caso} sesion={sesion} />}
      {pestana === "seguimiento" && <PestanaSeguimiento caso={caso} />}
    </>
  );
}
