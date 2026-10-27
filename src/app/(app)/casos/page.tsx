import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Encabezado } from "@/components/rpd/encabezado";
import { InsigniaDia46, isoDe } from "@/components/rpd/insignia-dia46";
import { obtenerSesion } from "@/lib/auth/sesion";
import { parametrosFechas } from "@/lib/parametros";
import { listarCasos, nombreCompleto } from "@/lib/prospectos/consultas";
import { diasEntre } from "@/lib/reglas/fechas";
import { hoyCDMX } from "@/lib/tiempo";

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

export default async function Casos() {
  const sesion = await obtenerSesion();
  const hoy = hoyCDMX();
  const [casos, p] = await Promise.all([listarCasos(sesion), parametrosFechas(hoy)]);
  const retiro = casos.filter((c) => c.servicio.clave === "RETIRO_DESEMPLEO");
  const otros = casos.length - retiro.length;

  return (
    <>
      <Encabezado titulo="Casos"
        descripcion={`Retiro por desempleo · ${retiro.length} ${retiro.length === 1 ? "caso" : "casos"}${otros ? ` · ${otros} de pensión y otros servicios (tablero propio en la siguiente entrega)` : ""}`} />
      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        <div className="flex gap-3" role="list" aria-label="Etapas">
          {COLUMNAS.map((col) => {
            const tarjetas = retiro.filter((c) => c.etapa === col.clave);
            return (
              <section key={col.clave} role="listitem" aria-label={col.titulo} className="flex w-72 shrink-0 flex-col rounded-[var(--radius-tarjeta)] bg-slate-100/70 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <Badge tono={col.tono}>{col.titulo}</Badge>
                  <span className="cifra text-xs text-ink-muted">{tarjetas.length}</span>
                </div>
                {tarjetas.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-borde px-3 py-6 text-center text-xs text-ink-muted">Sin casos</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {tarjetas.map((c) => {
                      const dias = diasEntre(isoDe(c.etapa_desde)!, hoy);
                      return (
                        <li key={c.id}>
                          <Link href={`/casos/${c.id}`} className="block rounded-lg border border-borde bg-surface p-3 shadow-[var(--shadow-tarjeta)] hover:border-brand">
                            <p className="truncate text-sm font-medium text-ink">{nombreCompleto(c.persona)}</p>
                            <p className="mb-2 text-xs text-ink-muted">
                              <span className="cifra">{c.folio}</span> · {dias === 0 ? "hoy en esta etapa" : `${dias} ${dias === 1 ? "día" : "días"} en la etapa`}
                            </p>
                            <InsigniaDia46 fechaBaja={c.datos_imss?.fecha_baja} hoy={hoy} diasEspera={p.DIAS_ESPERA_DESEMPLEO} />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-muted">Mover casos entre etapas, con la validación de cada requisito, llega en la siguiente entrega.</p>
    </>
  );
}
