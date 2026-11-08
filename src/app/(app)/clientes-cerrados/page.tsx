import { CalendarClock, CheckCircle2, FileSpreadsheet, Paperclip } from "lucide-react";
import { InsigniaAfore } from "@/components/rpd/insignia-afore";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { Encabezado } from "@/components/rpd/encabezado";
import { EstadoVacio } from "@/components/rpd/estado-vacio";
import { formatoFecha } from "@/components/rpd/insignia-dia46";
import { obtenerSesion } from "@/lib/auth/sesion";
import { listarCerrados, vendedoresParaFiltro } from "@/lib/cerrados/consultas";
import { mxn } from "@/lib/formato";
import { filtrarCerrados, resumenCerrados } from "@/lib/reglas/cerrados";
import { diasEntre } from "@/lib/reglas/fechas";
import { hoyCDMX } from "@/lib/tiempo";

export const metadata: Metadata = { title: "Clientes cerrados" };

const select = "h-11 w-full rounded-[var(--radius-boton)] border border-borde bg-surface px-3 text-sm text-ink md:h-10";
type Q = { mes?: string; vendedor?: string; proximos?: string };

// Clientes que ya retiraron (o recibieron su servicio) y ya pagaron el honorario: el caso entra solo
// cuando el honorario queda cobrado. Sirve para la cartera y para volver a contactarlos en 5 años.
export default async function ClientesCerrados({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const sesion = await obtenerSesion();
  const hoy = hoyCDMX();
  const veDinero = sesion.usuario.rol !== "vendedor";
  const [todas, vendedores] = await Promise.all([listarCerrados(sesion), vendedoresParaFiltro(sesion)]);
  const filtros = {
    mes: /^\d{4}-\d{2}$/.test(q.mes ?? "") ? q.mes : undefined,
    vendedor: q.vendedor || undefined,
    proximos: Number(q.proximos) > 0 ? Number(q.proximos) : undefined,
  };
  const filas = filtrarCerrados(todas, filtros, hoy);
  const r = resumenCerrados(todas, hoy);
  const conFiltros = Boolean(filtros.mes || filtros.vendedor || filtros.proximos);
  const exportar = `/api/exportar/cerrados?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])}`;

  const CIFRAS: [string, string, string?][] = [
    ["Cerrados este mes", String(r.delMes)],
    ["Cerrados este año", String(r.delAnio)],
    ["Total de clientes cerrados", String(r.total)],
    ...(veDinero ? [["Honorario cobrado", mxn(r.honorario), r.sinComprobante ? `${r.sinComprobante} sin comprobante` : "todos con comprobante"] as [string, string, string]] : []),
  ];

  return (
    <>
      <Encabezado titulo="Clientes cerrados" descripcion="Ya retiraron y ya pagaron el honorario. Aquí ves cuándo pueden volver a retirar.">
        {veDinero && (
          <a href={exportar} className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-boton)] border border-brand px-4 text-sm font-medium text-brand hover:bg-brand-tint">
            <FileSpreadsheet className="size-4" aria-hidden /> Excel
          </a>
        )}
      </Encabezado>

      <section aria-label="Resumen" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {CIFRAS.map(([t, v, nota]) => (
          <Card key={t} className="p-4">
            <p className="text-xs text-ink-muted">{t}</p>
            <p className="cifra mt-1 font-display text-[22px] font-semibold text-ink">{v}</p>
            {nota && <p className={`text-xs ${nota.includes("sin") ? "text-aviso" : "text-ink-muted"}`}>{nota}</p>}
          </Card>
        ))}
      </section>

      <Card className="mb-4">
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-1.5"><Label htmlFor="mes">Mes de cierre</Label>
              <input id="mes" name="mes" type="month" defaultValue={filtros.mes ?? ""} max={hoy.slice(0, 7)} className={select} /></div>
            {vendedores.length > 0 && (
              <div className="grid gap-1.5"><Label htmlFor="vendedor">Asesor de pensiones</Label>
                <select id="vendedor" name="vendedor" defaultValue={filtros.vendedor ?? ""} className={select}>
                  <option value="">Todos</option><option value="sin">Sin asesor</option>
                  {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                </select></div>
            )}
            <div className="grid gap-1.5"><Label htmlFor="proximos">Próximo retiro</Label>
              <select id="proximos" name="proximos" defaultValue={q.proximos ?? ""} className={select}>
                <option value="">Cualquier fecha</option><option value="30">En los siguientes 30 días</option>
                <option value="90">En los siguientes 90 días</option><option value="365">En el siguiente año</option>
              </select></div>
            <div className="flex items-end gap-2">
              <Button type="submit">Filtrar</Button>
              {conFiltros && <Button asChild variant="secundario"><Link href="/clientes-cerrados">Quitar filtros</Link></Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      {filas.length === 0 ? (
        <Card>
          <EstadoVacio icono={CheckCircle2} titulo={conFiltros ? "Nadie coincide con los filtros" : "Aún no hay clientes cerrados"}
            texto={conFiltros ? "Prueba con otro mes o quita los filtros." : "Un caso llega aquí solo cuando se registra el pago de la Afore y se cobra el honorario."} />
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-tarjeta)] border border-borde bg-surface">
          <table className="w-full min-w-[820px] text-left text-sm">
            <caption className="sr-only">Clientes cerrados</caption>
            <thead className="border-b border-borde text-xs text-ink-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Cliente</th>
                <th scope="col" className="px-3 py-2 font-medium">Servicio</th>
                <th scope="col" className="px-3 py-2 font-medium">Cerrado</th>
                {veDinero && <th scope="col" className="px-3 py-2 font-medium">Retiró</th>}
                {veDinero && <th scope="col" className="px-3 py-2 font-medium">Honorario</th>}
                {veDinero && <th scope="col" className="px-3 py-2 font-medium">Comprobante</th>}
                <th scope="col" className="px-3 py-2 font-medium">Próximo retiro</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((c) => {
                const faltan = c.proximoRetiro ? diasEntre(hoy, c.proximoRetiro) : null;
                return (
                  <tr key={c.id} className="border-b border-borde last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">{c.afore && <InsigniaAfore clave={c.afore} tamano="sm" sinNombre />}<Link href={`/casos/${c.id}?tab=dinero`} className="font-medium text-ink hover:text-brand">{c.nombre}</Link></span>
                      <span className="block text-xs text-ink-muted"><span className="cifra">{c.folio}</span>{c.vendedor ? ` · ${c.vendedor}` : ""}</span>
                    </td>
                    <td className="px-3 py-2 text-ink-muted">{c.servicio}</td>
                    <td className="cifra px-3 py-2">{formatoFecha(c.cerradoEl)}</td>
                    {veDinero && <td className="cifra px-3 py-2">{c.deposito ? <>{mxn(c.deposito.neto)}<span className="block text-xs text-ink-muted">{formatoFecha(c.deposito.fecha)}</span></> : "—"}</td>}
                    {veDinero && <td className="cifra px-3 py-2 font-medium">{mxn(c.honorario)}</td>}
                    {veDinero && (
                      <td className="px-3 py-2">
                        {c.comprobantes.de > 0 && c.comprobantes.con === c.comprobantes.de
                          ? <Badge tono="pagado"><Paperclip className="size-3.5" aria-hidden /> Sí</Badge>
                          : <Link href={`/casos/${c.id}?tab=dinero`}><Badge tono="espera">Falta</Badge></Link>}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      {c.proximoRetiro ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock className="size-4 text-brand" aria-hidden />
                          <span className="cifra">{formatoFecha(c.proximoRetiro, { dateStyle: "medium" })}</span>
                          {faltan !== null && faltan <= 90 && <Badge tono={faltan <= 0 ? "pagado" : "espera"}>{faltan <= 0 ? "Ya puede" : `en ${faltan} días`}</Badge>}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-ink-muted">{filas.length} de {todas.length} {todas.length === 1 ? "cliente" : "clientes"}. El próximo retiro es 5 años después del depósito de la Afore (art. 191-II); te avisamos un mes antes.</p>
    </>
  );
}
