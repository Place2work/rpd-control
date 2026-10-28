import { CircleAlert, FileSpreadsheet, FileWarning } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { GraficaBarras } from "@/components/rpd/grafica-barras";
import { mesValido, nombreMes, SelectorMes } from "@/components/rpd/selector-mes";
import { formatoFecha, isoDe } from "@/components/rpd/insignia-dia46";
import { exigirRol } from "@/lib/auth/sesion";
import { resumenDinero } from "@/lib/dinero/consultas";
import { mxn } from "@/lib/formato";
import { diasEntre } from "@/lib/reglas/fechas";
import { hoyCDMX } from "@/lib/tiempo";

export const metadata: Metadata = { title: "Dinero" };

const nombre = (p: { nombre: string; apellido_paterno: string | null }) => [p.nombre, p.apellido_paterno].filter(Boolean).join(" ");

// 10.6: pagos de Afore, cobros pendientes y cobrados, conciliación y resumen mensual (RESICO).
export default async function Dinero({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sesion = await exigirRol("director", "asesor", "socio");
  const hoy = hoyCDMX();
  const mes = mesValido((await searchParams).mes, hoy.slice(0, 7));
  const d = await resumenDinero(sesion, mes);
  const n = (v: unknown) => Number(v ?? 0);
  const totalPorCobrar = d.porCobrar.reduce((a, c) => a + n(c.honorario_total), 0);

  return (
    <>
      <Encabezado titulo="Dinero" descripcion="Depósitos de la Afore, honorarios por cobrar y cobrados, y el resumen para la contabilidad.">
        <SelectorMes mes={mes} base="/dinero" maximo={hoy.slice(0, 7)} />
        <a href={`/api/exportar/dinero?mes=${mes}`} className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-boton)] border border-brand px-4 text-sm font-medium text-brand hover:bg-brand-tint">
          <FileSpreadsheet className="size-4" aria-hidden /> Excel
        </a>
      </Encabezado>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra titulo="Depositado por la Afore" valor={mxn(n(d.depositos._sum.monto_neto))} nota={`${d.depositos._count} ${d.depositos._count === 1 ? "pago" : "pagos"} · ISR retenido ${mxn(n(d.depositos._sum.isr_retenido))}`} />
        <Cifra titulo="Honorario cobrado" valor={mxn(n(d.cobrado._sum.honorario_total))} nota={`${d.cobrado._count} ${d.cobrado._count === 1 ? "cobro" : "cobros"} en el mes`} />
        <Cifra titulo="Subtotal · IVA" valor={mxn(n(d.cobrado._sum.subtotal))} nota={`IVA trasladado ${mxn(n(d.cobrado._sum.iva))}`} />
        <Cifra titulo="Por cobrar hoy" valor={mxn(totalPorCobrar)} nota={`${d.porCobrar.length} pendientes`} alerta={d.porCobrar.length > 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Por cobrar</CardTitle><CircleAlert className="size-5 text-aviso" aria-hidden /></CardHeader>
          <CardContent>
            {d.porCobrar.length === 0 ? <p className="text-sm text-ink-muted">Todo cobrado. Cada pago de Afore registrado aparece aquí hasta que se cobre su honorario.</p> : (
              <ul className="divide-y divide-borde text-sm">
                {d.porCobrar.map((c) => {
                  const desde = isoDe(c.pago_afore?.fecha_deposito ?? c.created_at)!;
                  const dias = diasEntre(desde, hoy);
                  return (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <Link href={`/casos/${c.caso.id}?tab=dinero`} className="min-w-0 text-ink hover:text-brand">
                        <span className="font-medium">{nombre(c.caso.persona)}</span> <span className="cifra text-ink-muted">{c.caso.folio}</span>
                        <span className="block text-xs text-ink-muted">{c.pago_afore ? `Pago ${c.pago_afore.numero} de la Afore · ` : ""}{dias === 0 ? "hoy" : `hace ${dias} ${dias === 1 ? "día" : "días"}`}</span>
                      </Link>
                      <span className={`cifra font-medium ${dias >= 2 ? "text-critico" : "text-ink"}`}>{mxn(c.honorario_total)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Cobrados sin factura</CardTitle><FileWarning className="size-5 text-ink-muted" aria-hidden /></CardHeader>
          <CardContent>
            {d.sinFactura.length === 0 ? <p className="text-sm text-ink-muted">Todos los cobros tienen folio de factura.</p> : (
              <ul className="divide-y divide-borde text-sm">
                {d.sinFactura.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <Link href={`/casos/${c.caso.id}?tab=dinero`} className="text-ink hover:text-brand">
                      <span className="font-medium">{nombre(c.caso.persona)}</span> <span className="cifra text-ink-muted">{c.caso.folio}</span>
                      <span className="block text-xs text-ink-muted">Cobrado el {c.fecha_cobro ? formatoFecha(isoDe(c.fecha_cobro)!, { dateStyle: "medium" }) : "—"}</span>
                    </Link>
                    <span className="cifra">{mxn(c.honorario_total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Honorario cobrado por mes</CardTitle><span className="text-sm text-ink-muted">Últimos 12 meses hasta {nombreMes(mes)}</span></CardHeader>
        <CardContent className="grid gap-4">
          <GraficaBarras formato="pesos" datos={[...d.meses].reverse().map((m) => ({ etiqueta: m.mes.slice(2).replace("-", "/"), valor: m.total }))} />
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="text-left text-xs text-ink-muted">{["Mes", "Cobros", "Honorario", "Subtotal", "IVA", "Depositado Afore"].map((t) => <th key={t} className="pb-2 pr-3 font-medium">{t}</th>)}</tr></thead>
              <tbody>
                {d.meses.map((m) => (
                  <tr key={m.mes} className="border-t border-borde">
                    <td className="py-2 pr-3"><Link href={`/dinero?mes=${m.mes}`} className="hover:text-brand">{nombreMes(m.mes)}</Link></td>
                    <td className="cifra py-2 pr-3">{m.cobros}</td>
                    <td className="cifra py-2 pr-3 font-medium">{mxn(m.total)}</td>
                    <td className="cifra py-2 pr-3">{mxn(m.subtotal)}</td>
                    <td className="cifra py-2 pr-3">{mxn(m.iva)}</td>
                    <td className="cifra py-2 pr-3">{mxn(m.depositado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function Cifra({ titulo, valor, nota, alerta }: { titulo: string; valor: string; nota: string; alerta?: boolean }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-ink-muted">{titulo}</p>
        <p className={`cifra font-display text-2xl font-semibold ${alerta ? "text-aviso" : "text-ink"}`}>{valor}</p>
        <p className="text-xs text-ink-muted">{nota}</p>
      </CardContent>
    </Card>
  );
}
