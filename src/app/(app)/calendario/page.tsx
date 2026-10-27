import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { obtenerSesion } from "@/lib/auth/sesion";
import { prismaSistema } from "@/lib/db/prisma";
import { hoyCDMX } from "@/lib/tiempo";

export const metadata: Metadata = { title: "Calendario" };

// 10.5: vista mensual. En fase 0 solo muestra los días inhábiles cargados.
export default async function Calendario() {
  await obtenerSesion();
  const hoy = hoyCDMX();
  const base = new Date(`${hoy}T12:00:00`);
  const inicio = startOfWeek(startOfMonth(base), { weekStartsOn: 1 });
  const fin = endOfWeek(endOfMonth(base), { weekStartsOn: 1 });
  const inhabiles = await prismaSistema.diaInhabil.findMany({
    where: { fecha: { gte: new Date(`${format(inicio, "yyyy-MM-dd")}T00:00:00Z`), lte: new Date(`${format(fin, "yyyy-MM-dd")}T00:00:00Z`) } },
  });
  const porFecha = new Map(inhabiles.map((d) => [d.fecha.toISOString().slice(0, 10), d.descripcion]));
  const dias: Date[] = [];
  for (let d = inicio; d <= fin; d = addDays(d, 1)) dias.push(d);
  const mes = format(base, "MMMM yyyy", { locale: es });

  return (
    <>
      <Encabezado titulo="Calendario" descripcion={mes.charAt(0).toUpperCase() + mes.slice(1)} />
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-borde bg-slate-50 text-center text-xs font-medium text-ink-muted">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {dias.map((d) => {
            const iso = format(d, "yyyy-MM-dd");
            const feriado = porFecha.get(iso);
            const otroMes = d.getMonth() !== base.getMonth();
            return (
              <div key={iso} className={`min-h-16 border-b border-r border-borde p-1.5 text-xs md:min-h-24 ${otroMes ? "bg-slate-50/60 text-ink-muted/60" : ""}`}>
                <span className={`cifra inline-flex size-6 items-center justify-center rounded-full ${iso === hoy ? "bg-brand text-white" : ""}`}>{d.getDate()}</span>
                {feriado && <p className="mt-1 truncate rounded bg-aviso-tint px-1 py-0.5 text-[11px] text-aviso" title={feriado}>Inhábil · {feriado}</p>}
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}
