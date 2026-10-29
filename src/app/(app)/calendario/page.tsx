import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { mesValido, moverMes, nombreMes } from "@/components/rpd/selector-mes";
import { obtenerSesion } from "@/lib/auth/sesion";
import { eventosUsuario } from "@/lib/calendario/consultas";
import { conUsuario, prismaSistema } from "@/lib/db/prisma";
import { NOMBRE_EVENTO, type Evento, type TipoEvento } from "@/lib/reglas/calendario";
import { sumarDias } from "@/lib/reglas/fechas";
import { hoyCDMX } from "@/lib/tiempo";
import { cn } from "@/lib/utils";
import { LigaCalendario } from "./liga";

export const metadata: Metadata = { title: "Calendario" };

// Color por tipo (10.5). Los críticos en rojo; plazos en ámbar; dinero/M40 en verde; personas en azul.
const COLOR: Record<TipoEvento, string> = {
  DIA46: "bg-brand-tint text-brand", CANDADO: "bg-brand-tint text-brand",
  SLA_LIMITE: "bg-critico-tint text-critico", AFORE_RESOLUCION: "bg-aviso-tint text-aviso", CONTRATO_VENCE: "bg-aviso-tint text-aviso",
  PAGO_M40: "bg-exito-tint text-exito-texto", M40_DERECHO: "bg-critico-tint text-critico", CONSERVACION: "bg-critico-tint text-critico",
  CUMPLE_60: "bg-slate-100 text-ink", CUMPLE_65: "bg-slate-100 text-ink",
};
const CORTO: Record<TipoEvento, string> = {
  DIA46: "Día 46", CANDADO: "Fin candado", SLA_LIMITE: "Límite ingreso", AFORE_RESOLUCION: "Resolución Afore", CONTRATO_VENCE: "Vence contrato",
  PAGO_M40: "Pago M40", M40_DERECHO: "Derecho M40", CONSERVACION: "Conservación", CUMPLE_60: "Cumple 60", CUMPLE_65: "Cumple 65",
};
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const diaSemana = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7; // lunes = 0

export default async function Calendario({ searchParams }: { searchParams: Promise<{ mes?: string; vista?: string; semana?: string }> }) {
  const sesion = await obtenerSesion();
  const hoy = hoyCDMX();
  const q = await searchParams;
  const vista = q.vista === "semana" ? "semana" : "mes";
  const mes = mesValido(q.mes, hoy.slice(0, 7));
  const lunes = (iso: string) => sumarDias(iso, -diaSemana(iso));
  const inicioSemana = q.semana && /^\d{4}-\d{2}-\d{2}$/.test(q.semana) ? lunes(q.semana) : lunes(hoy);
  const desde = vista === "mes" ? lunes(`${mes}-01`) : inicioSemana;
  const hasta = vista === "mes" ? sumarDias(lunes(sumarDias(`${moverMes(mes, 1)}-01`, -1)), 6) : sumarDias(inicioSemana, 6);

  const [eventos, inhabiles, liga] = await Promise.all([
    eventosUsuario(sesion.claims, sesion.ip, desde, hasta, hoy),
    prismaSistema.diaInhabil.findMany({ where: { activo: true, fecha: { gte: new Date(`${desde}T00:00:00Z`), lte: new Date(`${hasta}T00:00:00Z`) } } }),
    conUsuario(sesion.claims, (tx) => tx.calendarioToken.findFirst({ where: { usuario_id: sesion.usuario.id, revocado_at: null }, select: { id: true } }), sesion.ip),
  ]);
  const feriado = new Map(inhabiles.map((d) => [d.fecha.toISOString().slice(0, 10), d.descripcion]));
  const porDia = new Map<string, Evento[]>();
  for (const e of eventos) porDia.set(e.fecha, [...(porDia.get(e.fecha) ?? []), e]);
  const dias: string[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) dias.push(d);

  const nav = vista === "mes"
    ? { atras: `/calendario?mes=${moverMes(mes, -1)}`, adelante: `/calendario?mes=${moverMes(mes, 1)}`, titulo: nombreMes(mes) }
    : { atras: `/calendario?vista=semana&semana=${sumarDias(inicioSemana, -7)}`, adelante: `/calendario?vista=semana&semana=${sumarDias(inicioSemana, 7)}`,
        titulo: `Semana del ${new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${inicioSemana}T00:00:00Z`))}` };
  const flecha = "inline-flex size-10 items-center justify-center rounded-[var(--radius-boton)] border border-borde text-ink hover:bg-brand-tint";
  const pestana = (activa: boolean) => cn("rounded-[var(--radius-boton)] px-3 py-2 text-sm", activa ? "bg-brand-tint font-medium text-brand" : "text-ink-muted hover:text-ink");

  return (
    <>
      <Encabezado titulo="Calendario" descripcion="Día 46, límites de ingreso y de la Afore, vencimientos de contrato, pagos M40 y cumpleaños 60/65.">
        <nav aria-label="Vista" className="flex gap-1">
          <Link href={`/calendario?mes=${mes}`} className={pestana(vista === "mes")}>Mes</Link>
          <Link href="/calendario?vista=semana" className={pestana(vista === "semana")}>Semana</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href={nav.atras} className={flecha} aria-label="Anterior"><ChevronLeft className="size-4" aria-hidden /></Link>
          <span className="min-w-40 text-center text-sm font-medium text-ink">{nav.titulo}</span>
          <Link href={nav.adelante} className={flecha} aria-label="Siguiente"><ChevronRight className="size-4" aria-hidden /></Link>
        </div>
      </Encabezado>

      {vista === "mes" ? (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-borde bg-slate-50 text-center text-xs font-medium text-ink-muted">
            {DIAS.map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {dias.map((iso) => {
              const lista = porDia.get(iso) ?? [];
              const otroMes = iso.slice(0, 7) !== mes;
              return (
                <div key={iso} className={cn("min-h-20 border-b border-r border-borde p-1 text-xs md:min-h-28 md:p-1.5", otroMes && "bg-slate-50/60 text-ink-muted/60")}>
                  <span className={cn("cifra inline-flex size-6 items-center justify-center rounded-full", iso === hoy && "bg-brand text-white")}>{Number(iso.slice(8))}</span>
                  {feriado.get(iso) && <p className="mt-0.5 truncate rounded bg-aviso-tint px-1 text-[11px] text-aviso" title={feriado.get(iso)}>Inhábil</p>}
                  <ul className="mt-0.5 grid gap-0.5">
                    {lista.slice(0, 3).map((e) => (
                      <li key={`${e.tipo}-${e.casoId}`}>
                        <Link href={`/casos/${e.casoId}`} title={e.titulo} className={cn("block truncate rounded px-1 py-0.5 text-[11px] hover:underline", COLOR[e.tipo])}>
                          <span className="hidden md:inline">{CORTO[e.tipo]} · </span>{e.folio}
                        </Link>
                      </li>
                    ))}
                    {lista.length > 3 && (
                      <li><Link href={`/calendario?vista=semana&semana=${iso}`} className="px-1 text-[11px] text-brand">+{lista.length - 3} más</Link></li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-7">
          {dias.map((iso, i) => {
            const lista = porDia.get(iso) ?? [];
            return (
              <Card key={iso} className={cn(iso === hoy && "border-2 border-brand")}>
                <CardContent className="grid gap-2 py-3">
                  <p className="text-xs text-ink-muted">{DIAS[i]} <span className="cifra font-medium text-ink">{Number(iso.slice(8))}</span>{feriado.get(iso) ? " · inhábil" : ""}</p>
                  {lista.length === 0 && <p className="text-xs text-ink-muted/70">Sin fechas</p>}
                  {lista.map((e) => (
                    <Link key={`${e.tipo}-${e.casoId}`} href={`/casos/${e.casoId}`} className={cn("block rounded px-2 py-1 text-xs hover:underline", COLOR[e.tipo])}>
                      <span className="block font-medium">{NOMBRE_EVENTO[e.tipo]}</span>{e.folio} · {e.nombre}
                    </Link>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Colores</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-xs">
            {(Object.keys(NOMBRE_EVENTO) as TipoEvento[]).map((t) => <span key={t} className={cn("rounded px-2 py-1", COLOR[t])}>{NOMBRE_EVENTO[t]}</span>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Verlo en Google Calendar</CardTitle></CardHeader>
          <CardContent><LigaCalendario activa={Boolean(liga)} /></CardContent>
        </Card>
      </div>
    </>
  );
}
