import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/rpd/encabezado";
import { obtenerSesion } from "@/lib/auth/sesion";
import { parametrosFechas } from "@/lib/parametros";
import { listarCasos, nombreCompleto } from "@/lib/prospectos/consultas";
import { isoDe } from "@/components/rpd/insignia-dia46";
import { NOMBRE_ETAPA, ETAPAS_LATERALES, ETAPAS_PENSION, ETAPAS_RETIRO, type Etapa } from "@/lib/reglas/etapas";
import { diasEntre, fechaElegibleDesempleo } from "@/lib/reglas/fechas";
import { hoyCDMX } from "@/lib/tiempo";
import { cn } from "@/lib/utils";
import { TablaCasos, type FilaCaso } from "./tabla-casos";
import { Tablero, type Columna, type Tarjeta } from "./tablero";

export const metadata: Metadata = { title: "Casos" };

// Familia de color de cada etapa (11.3).
const TONO: Partial<Record<Etapa, Columna["tono"]>> = {
  PROSPECTO: "prospecto", EN_ESPERA: "espera", PAGADO: "pagado", PENSION_OTORGADA: "pagado", CERRADO: "pagado",
  SEGUIMIENTO: "pagado", BLOQUEADO: "critico", PERDIDO: "perdido",
};
const columnasDe = (etapas: readonly Etapa[]): Columna[] =>
  [...etapas, ...ETAPAS_LATERALES].map((e) => ({ clave: e, titulo: NOMBRE_ETAPA[e], tono: TONO[e] ?? "tramite" }));

type Q = { vista?: string; embudo?: string };

export default async function Casos({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const vista = q.vista === "tabla" ? "tabla" : "tablero";
  const embudo = q.embudo === "pension" ? "pension" : "retiro";
  const sesion = await obtenerSesion();
  const hoy = hoyCDMX();
  const [casos, p] = await Promise.all([listarCasos(sesion), parametrosFechas(hoy)]);
  const delEmbudo = casos.filter((c) => c.servicio.embudo === embudo);
  const cuenta = (e: string) => casos.filter((c) => c.servicio.embudo === e).length;
  const columnas = columnasDe(embudo === "retiro" ? ETAPAS_RETIRO : ETAPAS_PENSION);
  const liga = (cambio: Q) => {
    const u = new URLSearchParams({ vista, embudo, ...cambio });
    return `/casos?${u}`;
  };

  const dia46 = (baja: Date | null | undefined): Tarjeta["dia46"] => {
    if (embudo !== "retiro") return null;
    if (!baja) return { texto: "Sin fecha de baja", tono: "espera" };
    const r = fechaElegibleDesempleo(isoDe(baja)!, hoy, p);
    return r.yaPuede ? { texto: "Ya puede retirar", tono: "pagado" } : { texto: `Día 46 en ${r.diasFaltan} ${r.diasFaltan === 1 ? "día" : "días"}`, tono: "espera" };
  };

  const tarjetas: Tarjeta[] = delEmbudo.map((c) => ({
    id: c.id, folio: c.folio, nombre: nombreCompleto(c.persona), etapa: c.etapa, diasEtapa: diasEntre(hoyCDMX(c.etapa_desde), hoy),
    dia46: dia46(c.datos_imss?.fecha_baja), servicio: embudo === "pension" ? c.servicio.nombre : null,
  }));
  const filas: FilaCaso[] = delEmbudo.map((c) => ({
    id: c.id, folio: c.folio, nombre: nombreCompleto(c.persona), servicio: c.servicio.nombre, etapa: c.etapa,
    diasEtapa: diasEntre(hoyCDMX(c.etapa_desde), hoy), asignado: c.asignado?.nombre ?? "Sin asignar", vendedor: c.vendedor?.nombre ?? "—",
    alta: hoyCDMX(c.created_at),
  }));

  const pestana = (activo: boolean) => cn("rounded-[var(--radius-boton)] px-3 py-2 text-sm", activo ? "bg-brand-tint font-medium text-brand" : "text-ink-muted hover:text-ink");

  return (
    <>
      <Encabezado titulo="Casos" descripcion={`${delEmbudo.length} ${delEmbudo.length === 1 ? "caso" : "casos"} de ${embudo === "retiro" ? "retiro por desempleo" : "pensión y otros servicios"}`} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Embudo" className="flex gap-1">
          <Link href={liga({ embudo: "retiro" })} aria-current={embudo === "retiro" ? "page" : undefined} className={pestana(embudo === "retiro")}>Retiro ({cuenta("retiro")})</Link>
          <Link href={liga({ embudo: "pension" })} aria-current={embudo === "pension" ? "page" : undefined} className={pestana(embudo === "pension")}>Pensión ({cuenta("pension")})</Link>
        </nav>
        <nav aria-label="Vista" className="flex gap-1">
          <Link href={liga({ vista: "tablero" })} aria-current={vista === "tablero" ? "page" : undefined} className={pestana(vista === "tablero")}>Tablero</Link>
          <Link href={liga({ vista: "tabla" })} aria-current={vista === "tabla" ? "page" : undefined} className={pestana(vista === "tabla")}>Tabla</Link>
        </nav>
      </div>
      {vista === "tablero" ? <Tablero columnas={columnas} tarjetas={tarjetas} /> : <TablaCasos filas={filas} columnas={columnas} />}
    </>
  );
}
