import { CircleAlert, FileDown, Leaf } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatoFecha, isoDe } from "@/components/rpd/insignia-dia46";
import type { Sesion } from "@/lib/auth/sesion";
import { faltantesParaCalcular } from "@/lib/calculo/entrada";
import { conUsuario } from "@/lib/db/prisma";
import type { CasoDetalle } from "@/lib/prospectos/consultas";
import type { Impacto, OpcionModalidad, Resultado } from "@/lib/reglas/retiro";
import { cn } from "@/lib/utils";
import { BotonCalcular } from "../boton-calcular";

const RESULTADO: Record<Resultado, { texto: string; tono: "pagado" | "espera" | "critico" | "tramite" | "prospecto" }> = {
  APTO: { texto: "Apto", tono: "pagado" },
  APTO_BLOQUEADO: { texto: "Apto con pendientes", tono: "tramite" },
  NO_TODAVIA: { texto: "Todavía no", tono: "espera" },
  CALIFICA_NO_CONVIENE: { texto: "Califica pero no conviene", tono: "critico" },
  NO_ELEGIBLE_DESVIO: { texto: "Le conviene otro servicio", tono: "tramite" },
  NO_ELEGIBLE_DEFINITIVO: { texto: "No elegible", tono: "prospecto" },
};
const mxn = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const sem = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 1 });

type Guardado = { impacto: Impacto | null; motivos: string[]; tareas: string[]; opciones: OpcionModalidad[]; porDefecto: "A" | "B" | null; cuestaMenos: "A" | "B" | null };

export async function PestanaCalculo({ caso, sesion }: { caso: CasoDetalle; sesion: Sesion }) {
  if (caso.servicio.clave !== "RETIRO_DESEMPLEO") {
    return <Card><CardContent className="text-sm text-ink-muted">La calculadora es para el retiro por desempleo. La de pensiones llega en la fase 4.</CardContent></Card>;
  }
  const calculos = await conUsuario(sesion.claims, (tx) => tx.calculo.findMany({ where: { caso_id: caso.id }, orderBy: { created_at: "desc" }, take: 10 }), sesion.ip);
  const faltantes = faltantesParaCalcular(caso);
  const ultimo = calculos[0];
  const g = ultimo?.impacto_pension as Guardado | null | undefined;
  const elegida = ultimo?.modalidad_elegida as "A" | "B" | null | undefined;

  return (
    <div className="grid gap-4">
      {faltantes.length > 0 && (
        <Card>
          <CardContent className="flex gap-3 text-sm">
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-aviso" aria-hidden />
            <div>
              <p className="font-medium text-ink">Para calcular falta capturar en <Link href={`/casos/${caso.id}?tab=imss`} className="text-brand underline">IMSS y Afore</Link>:</p>
              <ul className="mt-1 list-disc pl-5 text-ink-muted">{faltantes.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Precalificación</CardTitle>
          {ultimo && <Badge tono={RESULTADO[ultimo.resultado].tono}>{RESULTADO[ultimo.resultado].texto}</Badge>}
        </CardHeader>
        <CardContent className="grid gap-4">
          {!ultimo ? (
            <p className="text-sm text-ink-muted">Aún no hay cálculo. Con los datos de la constancia de semanas y del estado de cuenta Afore, calcula cuánto puede retirar y cuántas semanas pierde.</p>
          ) : (
            <>
              <p className="rounded-md bg-brand-tint p-4 text-[15px] leading-relaxed text-ink">{ultimo.explicacion}</p>
              {ultimo.dictamen_manual && ultimo.resultado !== ultimo.resultado_automatico && (
                <p className="text-xs text-ink-muted">El motor dio «{RESULTADO[ultimo.resultado_automatico].texto}»; prevalece el dictamen manual «{ultimo.dictamen_manual === "APTO" ? "Apto" : "No apto"}».</p>
              )}
              {ultimo.fecha_elegibilidad && <p className="text-sm text-ink">Fecha estimada para poder retirar: <strong>{formatoFecha(isoDe(ultimo.fecha_elegibilidad)!, { dateStyle: "long" })}</strong></p>}
              {!!g?.motivos.length && <Lista titulo="Por qué" items={g.motivos} />}
              {!!g?.tareas.length && <Lista titulo="Pendientes antes de ingresar" items={g.tareas} />}
            </>
          )}
          <div className="flex flex-wrap items-start gap-3">
            <BotonCalcular casoId={caso.id} modalidad={elegida ?? null} texto={ultimo ? "Calcular de nuevo" : "Calcular"} />
            {ultimo && (
              <a href={`/api/casos/${caso.id}/hoja`} target="_blank" rel="noopener"
                className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-boton)] border border-brand px-4 text-sm font-medium text-brand hover:bg-brand-tint md:h-10">
                <FileDown className="size-4" aria-hidden /> Hoja de precalificación (PDF)
              </a>
            )}
            {ultimo && <p className="text-xs text-ink-muted">Calculado el {formatoFecha(isoDe(ultimo.fecha_calculo)!, { dateStyle: "long" })} con UMA mensual {mxn(Number(ultimo.uma_mensual))}. Todos los montos son estimados.</p>}
          </div>
        </CardContent>
      </Card>

      {g && g.opciones.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {(["A", "B"] as const).map((m) => {
            const o = g.opciones.find((x) => x.modalidad === m);
            const esElegida = (elegida ?? g.porDefecto) === m;
            return (
              <Card key={m} className={cn(esElegida && "border-2 border-brand")}>
                <CardHeader>
                  <CardTitle>Modalidad {m}</CardTitle>
                  <div className="flex gap-2">
                    {g.cuestaMenos === m && <Badge tono="pagado"><Leaf className="size-3.5" aria-hidden /> Cuesta menos semanas</Badge>}
                    {esElegida && <Badge tono="tramite">Elegida</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  {!o ? (
                    <p className="text-sm text-ink-muted">{m === "A" ? "No califica: requiere 3 años de cuenta y 12 bimestres cotizados." : "No califica: requiere 5 años de cuenta."}</p>
                  ) : (
                    <div className="grid gap-3">
                      <p className="cifra font-display text-[28px] font-semibold text-ink">{mxn(o.monto)} <span className="text-sm font-normal text-ink-muted">estimado</span></p>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <Fila t="Semanas que pierde" v={sem(o.semanasPerdidas)} />
                        <Fila t="Quedaría con" v={`${sem(o.semanasDespues)} semanas`} />
                        <Fila t="% del saldo RCV" v={`${o.pctSaldo.toLocaleString("es-MX")}%`} />
                        <Fila t="Honorario (IVA incluido)" v={mxn(o.honorario)} />
                        <Fila t="Subtotal + IVA" v={`${mxn(o.subtotal)} + ${mxn(o.iva)}`} />
                        <Fila t="Recibe el cliente" v={mxn(o.netoCliente)} fuerte />
                      </dl>
                      <p className="text-xs text-ink-muted">
                        {m === "A" ? `Menor entre 30 días de SBC (${mxn(o.detalle.dias_sbc)}), 10 UMA (${mxn(o.detalle.tope_uma)}) y el saldo.`
                          : `Menor entre 90 días de SBC promedio (${mxn(o.detalle.dias_sbc)}) y 11.5% del RCV (${mxn(o.detalle.pct_saldo)}). Hasta 6 mensualidades.`}
                      </p>
                      {!esElegida && g.opciones.length === 2 && <BotonCalcular casoId={caso.id} modalidad={m} texto={`Elegir modalidad ${m}`} />}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {g?.impacto && g.impacto.mensajes.length > 0 && (
        <Card className={cn(g.impacto.severidad === "critica" ? "border-critico/40" : "border-aviso/40")}>
          <CardHeader><CardTitle>Impacto en la pensión</CardTitle>
            <Badge tono={g.impacto.severidad === "critica" ? "critico" : "espera"}>{g.impacto.severidad === "critica" ? "Crítico" : "Aviso"}</Badge>
          </CardHeader>
          <CardContent><ul className="list-disc pl-5 text-sm text-ink">{g.impacto.mensajes.map((x) => <li key={x}>{x}</li>)}</ul></CardContent>
        </Card>
      )}

      {calculos.length > 1 && (
        <Card>
          <CardHeader><CardTitle>Cálculos anteriores</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-borde text-sm">
              {calculos.slice(1).map((c) => (
                <li key={c.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>{new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).format(c.created_at)}</span>
                  <span className="text-ink-muted">{RESULTADO[c.resultado].texto}{c.monto_estimado ? ` · ${c.modalidad_elegida} ${mxn(Number(c.monto_estimado))}` : ""}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Lista({ titulo, items }: { titulo: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-muted">{titulo}</p>
      <ul className="mt-1 list-disc pl-5 text-sm text-ink">{items.map((x) => <li key={x}>{x}</li>)}</ul>
    </div>
  );
}

function Fila({ t, v, fuerte }: { t: string; v: string; fuerte?: boolean }) {
  return (
    <>
      <dt className="text-ink-muted">{t}</dt>
      <dd className={cn("cifra text-right", fuerte ? "font-semibold text-exito-texto" : "text-ink")}>{v}</dd>
    </>
  );
}
