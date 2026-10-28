import { MessageCircle, Search, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Encabezado } from "@/components/rpd/encabezado";
import { EstadoVacio } from "@/components/rpd/estado-vacio";
import { InsigniaDia46 } from "@/components/rpd/insignia-dia46";
import { LigasConsulta } from "@/components/rpd/ligas-consulta";
import { obtenerSesion } from "@/lib/auth/sesion";
import { ligasConsulta, parametrosFechas } from "@/lib/parametros";
import { listarProspectos, nombreCompleto } from "@/lib/prospectos/consultas";
import { ORIGENES } from "@/lib/prospectos/validacion";
import { diasEntre } from "@/lib/reglas/fechas";
import { hoyCDMX } from "@/lib/tiempo";

export const metadata: Metadata = { title: "Prospectos" };

const ETIQUETA_ORIGEN = Object.fromEntries(ORIGENES) as Record<string, string>;
const telefonoVisible = (e164: string | null) => (e164 ? e164.replace(/^\+52(\d{3})(\d{3})(\d{4})$/, "$1 $2 $3") : "—");

export default async function Prospectos({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sesion = await obtenerSesion();
  const { q = "" } = await searchParams;
  const hoy = hoyCDMX();
  const [filas, ligas, p] = await Promise.all([listarProspectos(sesion, q), ligasConsulta(), parametrosFechas(hoy)]);

  return (
    <>
      <Encabezado titulo="Prospectos" descripcion="Alta rápida, búsqueda y precalificación.">
        <Button asChild>
          <Link href="/prospectos/nuevo"><UserPlus aria-hidden /> Alta rápida</Link>
        </Button>
      </Encabezado>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="pb-2">
            <form role="search" className="relative">
              <label htmlFor="q" className="sr-only">Buscar</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
              <Input id="q" name="q" defaultValue={q} className="pl-9" placeholder="Nombre, teléfono, CURP, NSS o folio" autoComplete="off" />
            </form>
            {q && (
              <p className="mt-2 text-xs text-ink-muted">
                {filas.length} {filas.length === 1 ? "resultado" : "resultados"} para «{q}» · <Link href="/prospectos" className="text-brand underline">Limpiar</Link>
              </p>
            )}
          </CardContent>
          {filas.length === 0 ? (
            q ? (
              <EstadoVacio icono={Search} titulo="Sin resultados" texto="Revisa cómo lo escribiste. La CURP y el NSS se buscan completos." />
            ) : (
              <EstadoVacio icono={UserPlus} titulo="Aún no hay prospectos" texto="Da de alta al primero con su nombre y WhatsApp; el resto se completa después.">
                <Button asChild><Link href="/prospectos/nuevo">Alta rápida</Link></Button>
              </EstadoVacio>
            )
          ) : (
            <ul className="divide-y divide-borde">
              {filas.map((f) => {
                const ultimo = hoyCDMX(f.eventos[0]?.fecha ?? f.created_at);
                const sinContacto = diasEntre(ultimo, hoy);
                return (
                  <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 hover:bg-brand-tint/40">
                    <Link href={`/casos/${f.id}`} className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{nombreCompleto(f.persona)}</p>
                      <p className="text-xs text-ink-muted">
                        <span className="cifra">{f.folio}</span> · {f.servicio.nombre.split(" (")[0]} · {ETIQUETA_ORIGEN[f.persona.origen] ?? f.persona.origen}
                        {sinContacto > 0 && ` · ${sinContacto} ${sinContacto === 1 ? "día" : "días"} sin contacto`}
                      </p>
                    </Link>
                    {f.servicio.clave === "RETIRO_DESEMPLEO" && (
                      <InsigniaDia46 fechaBaja={f.datos_imss?.fecha_baja} hoy={hoy} diasEspera={p.DIAS_ESPERA_DESEMPLEO} />
                    )}
                    {f.persona.whatsapp && (
                      <a href={`https://wa.me/${f.persona.whatsapp.replace("+", "")}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex h-11 items-center gap-1.5 rounded-md px-2 text-sm text-ink-muted hover:bg-brand-tint hover:text-brand md:h-9"
                        title="Abrir WhatsApp">
                        <MessageCircle className="size-4" aria-hidden />
                        <span className="cifra">{telefonoVisible(f.persona.whatsapp)}</span>
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader><CardTitle>Consultas oficiales</CardTitle></CardHeader>
          <CardContent className="pt-2">
            <p className="text-sm text-ink-muted">Para confirmar la CURP o el NSS del cliente antes de capturarlos.</p>
            <LigasConsulta ligas={ligas} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
