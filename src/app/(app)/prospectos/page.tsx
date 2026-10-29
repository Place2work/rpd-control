import { MessageCircle, Search, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Encabezado } from "@/components/rpd/encabezado";
import { EstadoVacio } from "@/components/rpd/estado-vacio";
import { InsigniaDia46 } from "@/components/rpd/insignia-dia46";
import { LigasConsulta } from "@/components/rpd/ligas-consulta";
import { obtenerSesion } from "@/lib/auth/sesion";
import { ligasConsulta, parametrosFechas } from "@/lib/parametros";
import { listarProspectos, nombreCompleto, opcionesFiltrosProspecto } from "@/lib/prospectos/consultas";
import { ORIGENES } from "@/lib/prospectos/validacion";
import { diasEntre } from "@/lib/reglas/fechas";
import { hoyCDMX } from "@/lib/tiempo";

export const metadata: Metadata = { title: "Prospectos" };

const ETIQUETA_ORIGEN = Object.fromEntries(ORIGENES) as Record<string, string>;
const telefonoVisible = (e164: string | null) => (e164 ? e164.replace(/^\+52(\d{3})(\d{3})(\d{4})$/, "$1 $2 $3") : "—");

const select = "h-11 w-full rounded-[var(--radius-boton)] border border-borde bg-surface px-3 text-sm text-ink md:h-10";
const SIN_CONTACTO = [["3", "3 días o más"], ["7", "7 días o más"], ["15", "15 días o más"], ["30", "30 días o más"]] as const;

type Q = { q?: string; origen?: string; servicio?: string; vendedor?: string; regimen?: string; sin_contacto?: string };

export default async function Prospectos({ searchParams }: { searchParams: Promise<Q> }) {
  const sesion = await obtenerSesion();
  const filtro = await searchParams;
  const q = filtro.q ?? "";
  const hoy = hoyCDMX();
  const [todas, ligas, p, opciones] = await Promise.all([
    listarProspectos(sesion, q, filtro), ligasConsulta(), parametrosFechas(hoy), opcionesFiltrosProspecto(sesion),
  ]);
  const minimoSinContacto = Number(filtro.sin_contacto) > 0 ? Number(filtro.sin_contacto) : 0;
  const diasSinContacto = (x: (typeof todas)[number]) => diasEntre(hoyCDMX(x.eventos[0]?.fecha ?? x.created_at), hoy);
  const filas = minimoSinContacto ? todas.filter((x) => diasSinContacto(x) >= minimoSinContacto) : todas;
  const conFiltros = Boolean(filtro.origen || filtro.servicio || filtro.vendedor || filtro.regimen || minimoSinContacto);

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
            <form role="search" className="grid gap-3">
              <div className="relative">
                <label htmlFor="q" className="sr-only">Buscar</label>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
                <Input id="q" name="q" defaultValue={q} className="pl-9" placeholder="Nombre, teléfono, CURP, NSS o folio" autoComplete="off" />
              </div>
              <details open={conFiltros} className="group">
                <summary className="cursor-pointer text-sm text-brand">Filtros{conFiltros ? " (activos)" : ""}</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="grid gap-1.5"><Label htmlFor="f-origen">Origen</Label>
                    <select id="f-origen" name="origen" defaultValue={filtro.origen ?? ""} className={select}>
                      <option value="">Todos</option>{ORIGENES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select></div>
                  <div className="grid gap-1.5"><Label htmlFor="f-servicio">Servicio</Label>
                    <select id="f-servicio" name="servicio" defaultValue={filtro.servicio ?? ""} className={select}>
                      <option value="">Todos</option>{opciones.servicios.map((s) => <option key={s.clave} value={s.clave}>{s.nombre}</option>)}
                    </select></div>
                  <div className="grid gap-1.5"><Label htmlFor="f-vendedor">Vendedor</Label>
                    <select id="f-vendedor" name="vendedor" defaultValue={filtro.vendedor ?? ""} className={select}>
                      <option value="">Todos</option><option value="sin">Sin vendedor</option>
                      {opciones.vendedores.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                    </select></div>
                  <div className="grid gap-1.5"><Label htmlFor="f-regimen">Régimen</Label>
                    <select id="f-regimen" name="regimen" defaultValue={filtro.regimen ?? ""} className={select}>
                      <option value="">Todos</option><option value="L73">Ley 73</option><option value="L97">Ley 97</option><option value="por_definir">Por definir</option>
                    </select></div>
                  <div className="grid gap-1.5"><Label htmlFor="f-sin">Sin contacto</Label>
                    <select id="f-sin" name="sin_contacto" defaultValue={filtro.sin_contacto ?? ""} className={select}>
                      <option value="">Cualquiera</option>{SIN_CONTACTO.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select></div>
                  <div className="flex items-end gap-2">
                    <Button type="submit">Filtrar</Button>
                    {conFiltros && <Button asChild variant="secundario"><Link href={q ? `/prospectos?q=${encodeURIComponent(q)}` : "/prospectos"}>Quitar filtros</Link></Button>}
                  </div>
                </div>
              </details>
            </form>
            {(q || conFiltros) && (
              <p className="mt-2 text-xs text-ink-muted">
                {filas.length} {filas.length === 1 ? "resultado" : "resultados"}{q ? ` para «${q}»` : ""} · <Link href="/prospectos" className="text-brand underline">Limpiar</Link>
              </p>
            )}
          </CardContent>
          {filas.length === 0 ? (
            q || conFiltros ? (
              <EstadoVacio icono={Search} titulo="Sin resultados" texto={q ? "Revisa cómo lo escribiste. La CURP y el NSS se buscan completos." : "Ningún prospecto coincide con los filtros."} />
            ) : (
              <EstadoVacio icono={UserPlus} titulo="Aún no hay prospectos" texto="Da de alta al primero con su nombre y WhatsApp; el resto se completa después.">
                <Button asChild><Link href="/prospectos/nuevo">Alta rápida</Link></Button>
              </EstadoVacio>
            )
          ) : (
            <ul className="divide-y divide-borde">
              {filas.map((f) => {
                const sinContacto = diasSinContacto(f);
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
