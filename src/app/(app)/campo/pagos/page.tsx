import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { exigirRol } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { liquidacionesDe, tarifasCampo } from "@/lib/campo/datos";
import { semanaCerrada } from "@/lib/reglas/campo";
import { mxn } from "@/lib/formato";
import { hoyCDMX } from "@/lib/tiempo";
import { CampoTexto } from "../../casos/[id]/campos";
import { FormularioAccion } from "../../casos/[id]/formulario-accion";
import { ajustarPagoDia, pagarSemanaCampo } from "../acciones";

const plural = (k: number, uno: string, varios: string) => `${k} ${k === 1 ? uno : varios}`;
export const metadata: Metadata = { title: "Pagos de campo" };
const pesos = (cent: number) => mxn(cent / 100);
const dia = (iso: string) => new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const isoDb = (d: Date) => d.toISOString().slice(0, 10);

// Pagos semanales del gerente de campo: lo verificado y aprobado de lunes a domingo se paga el miércoles siguiente.
export default async function PagosCampo() {
  const s = await exigirRol("director");
  const hoy = hoyCDMX();
  const tarifa = await tarifasCampo(hoy);
  const d = await conUsuario(s.claims, async (tx) => {
    const gerentes = await tx.usuario.findMany({ where: { OR: [
      { rol: "campo", archivado_at: null },
      // Quien dejó de ser gerente de campo pero tiene algo verificado o aprobado sin pagar: no se pierde su dinero.
      { campo_prospectos: { some: { estado: "verificado", pago_id: null, archivado_at: null } } },
      { campo_jornadas: { some: { estado: "aprobada", pago_id: null } } },
    ] }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, activo: true } });
    return {
      gerentes: await Promise.all(gerentes.map(async (g) => ({
        ...g,
        liquidaciones: await liquidacionesDe(tx, g.id, tarifa.diasParaPago),
        dias: await tx.campoJornada.findMany({ where: { gerente_id: g.id, estado: "aprobada", pago_id: null }, orderBy: { fecha: "asc" },
          select: { id: true, fecha: true, municipio: true, lugar: true, monto_cent: true } }),
        pendientes: await tx.campoProspecto.count({ where: { gerente_id: g.id, estado: "pendiente", archivado_at: null } }),
        totales: await tx.campoProspecto.groupBy({ by: ["estado"], where: { gerente_id: g.id, archivado_at: null }, _count: { _all: true } }),
      }))),
      pagos: await tx.campoPago.findMany({ orderBy: { fecha_pago: "desc" }, take: 30, select: { id: true, fecha_pago: true, semana_inicio: true, semana_fin: true, prospectos: true, dias: true, total_cent: true, referencia: true, gerente: { select: { nombre: true } } } }),
    };
  }, s.ip);

  return (
    <>
      <Encabezado titulo="Pagos de campo" descripcion={`Tarifas vigentes: ${pesos(tarifa.prospectoCent)} por prospecto verificado y ${pesos(tarifa.diaCent)} por día con foto aprobada. Lo de lunes a domingo se paga el miércoles siguiente.`}>
        <Link href="/campo/revisar" className="inline-flex items-center gap-1.5 text-sm text-brand underline"><ArrowLeft className="size-4" aria-hidden /> Prospectos de campo</Link>
        <Link href="/configuracion" className="text-sm text-brand underline">Cambiar tarifas</Link>
      </Encabezado>
      <div className="grid gap-4">
        {d.gerentes.length === 0 && <Card><CardContent className="pt-5 text-sm text-ink-muted">Todavía no hay gerentes de campo. Dalos de alta en Configuración → Usuarios con el rol «Gerente de campo».</CardContent></Card>}
        {d.gerentes.map((g) => {
          const porEstado = (e: string) => g.totales.find((t) => t.estado === e)?._count._all ?? 0;
          return (
            <Card key={g.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Wallet className="size-5 text-brand" aria-hidden /> {g.nombre}</CardTitle>
                {!g.activo && <Badge tono="critico">Inactivo</Badge>}
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <p className="text-ink-muted">{porEstado("verificado")} verificados · {g.pendientes} por verificar · {porEstado("rechazado")} no cuentan</p>
                {g.liquidaciones.length === 0 ? <p className="text-ink-muted">Nada pendiente de pago.</p> : g.liquidaciones.map((l) => {
                  const cerrada = semanaCerrada(l, hoy);
                  return (
                    <div key={l.semanaFin} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-boton)] border border-borde p-3">
                      <div>
                        <p className="font-medium text-ink">Semana del {dia(l.semanaInicio)} al {dia(l.semanaFin)} · se paga el {dia(l.fechaPago)}</p>
                        <p className="text-xs text-ink-muted">{plural(l.prospectos.length, "prospecto", "prospectos")} ({pesos(l.montoProspectosCent)}) · {plural(l.dias.length, "día", "días")} ({pesos(l.montoDiasCent)})</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-display text-xl font-semibold text-ink">{pesos(l.totalCent)}</span>
                        {cerrada ? (
                          <FormularioAccion accion={pagarSemanaCampo.bind(null, g.id, l.semanaFin)} boton="Marcar como pagado" confirmar={`¿Registrar el pago de ${pesos(l.totalCent)} a ${g.nombre}?`} className="flex flex-wrap items-end gap-2">
                            <CampoTexto id="referencia" etiqueta="Referencia (opcional)" placeholder="Transferencia 123456" />
                          </FormularioAccion>
                        ) : <Badge tono="espera">Semana en curso</Badge>}
                      </div>
                      {l.dias.length > 0 && (
                        <div className="grid w-full gap-2 border-t border-borde pt-3">
                          <p className="text-xs text-ink-muted">Pago por día (puedes cambiarlo según la ubicación antes de pagar):</p>
                          {g.dias.filter((x) => l.dias.includes(x.id)).map((x) => (
                            <FormularioAccion key={x.id} accion={ajustarPagoDia.bind(null, x.id)} boton="Guardar" etiquetas={{ monto: "Pago" }} className="flex flex-wrap items-end gap-2">
                              <span className="min-w-48 self-center text-sm text-ink">{dia(isoDb(x.fecha))} · {x.lugar}, {x.municipio}</span>
                              <CampoTexto id="monto" etiqueta="Pago (pesos)" inputMode="decimal" valor={(Number(x.monto_cent ?? 0) / 100).toFixed(2)} />
                            </FormularioAccion>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}

        <Card>
          <CardHeader><CardTitle>Pagos registrados</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {d.pagos.length === 0 ? <p className="text-ink-muted">Todavía no hay pagos.</p> : (
              <ul className="divide-y divide-borde">
                {d.pagos.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span><span className="font-medium text-ink">{p.gerente.nombre}</span> <span className="text-xs text-ink-muted">· semana del {dia(isoDb(p.semana_inicio))} al {dia(isoDb(p.semana_fin))} · pagado el {dia(isoDb(p.fecha_pago))}{p.referencia ? ` · ${p.referencia}` : ""}</span>
                      <span className="block text-xs text-ink-muted">{plural(p.prospectos, "prospecto", "prospectos")} · {plural(p.dias, "día", "días")}</span></span>
                    <span className="cifra font-medium text-ink">{pesos(Number(p.total_cent))}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
