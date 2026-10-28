"use client";

import { ArrowLeft, ArrowRight, Ban, CircleAlert, XCircle } from "lucide-react";
import { useState } from "react";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { cambiarEtapa } from "./acciones";
import { FormularioAccion } from "./formulario-accion";

export type OpcionEtapa = { destino: string; nombre: string; regreso: boolean; faltantes: string[] };

type Props = {
  casoId: string;
  opciones: OpcionEtapa[];
  esLey73: boolean;
  embudo: "retiro" | "pension";
  hoy: string;
  valores: { fecha_contrato: string; fecha_ingreso_solicitud: string; acuse_afore: string; fecha_resolucion: string; honorario_fijo: string };
};

const MOTIVOS_PERDIDA = [
  ["no_elegible", "No es elegible"], ["no_conviene", "No le conviene"], ["precio", "Precio"],
  ["no_contesta", "No contesta"], ["lo_hizo_solo", "Lo hizo por su cuenta"], ["otro", "Otro"],
] as const;
const claseSelect = "h-11 w-full rounded-[var(--radius-boton)] border border-borde bg-surface px-3 text-sm md:h-10";

// Faltantes que se resuelven capturando algo aquí mismo (no bloquean el botón).
const SE_CAPTURA_AQUI = /fecha de firma|fecha de ingreso|acuse|resolución favorable|fecha de resolución|honorario fijo|análisis de impacto/i;

export function CambiarEtapa({ casoId, opciones, esLey73, embudo, hoy, valores }: Props) {
  const [destino, setDestino] = useState<string | null>(null);
  const elegida = opciones.find((o) => o.destino === destino);
  const avance = opciones.filter((o) => !o.regreso && o.destino !== "PERDIDO" && o.destino !== "BLOQUEADO");
  const otras = opciones.filter((o) => o.regreso || o.destino === "PERDIDO" || o.destino === "BLOQUEADO");
  const pideMotivo = elegida && (elegida.regreso || elegida.destino === "PERDIDO" || elegida.destino === "BLOQUEADO");

  return (
    <div className="grid gap-4">
      <ul className="grid gap-2">
        {avance.map((o) => <Opcion key={o.destino} o={o} activa={destino === o.destino} alElegir={setDestino} />)}
        {avance.length === 0 && <li className="text-sm text-ink-muted">No hay un siguiente paso hacia adelante desde aquí.</li>}
      </ul>
      {otras.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer py-2 text-ink-muted">Otras opciones: bloquear, marcar como perdido o regresar</summary>
          <ul className="mt-2 grid gap-2">
            {otras.map((o) => <Opcion key={o.destino} o={o} activa={destino === o.destino} alElegir={setDestino} />)}
          </ul>
        </details>
      )}

      {elegida && (
        <FormularioAccion accion={cambiarEtapa.bind(null, casoId)} boton={`Pasar a «${elegida.nombre}»`} className="grid gap-4 rounded-[var(--radius-tarjeta)] border border-brand/30 bg-brand-tint/40 p-4">
          <input type="hidden" name="destino" value={elegida.destino} />

          {elegida.destino === "CONTRATO" && (
            <>
              <CampoFecha id="fecha_contrato" etiqueta="Fecha de firma del contrato" valor={valores.fecha_contrato || hoy} max={hoy} />
              {embudo === "pension" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="honorario_fijo">Honorario fijo <span className="font-normal text-ink-muted">· IVA incluido</span></Label>
                  <Input id="honorario_fijo" name="honorario_fijo" inputMode="decimal" defaultValue={valores.honorario_fijo} />
                </div>
              )}
              {esLey73 && embudo === "retiro" && (
                <fieldset className="grid gap-2 rounded-md border border-aviso/40 bg-aviso-tint/50 p-3">
                  <legend className="px-1 text-sm font-medium text-aviso">Ley 73: análisis de impacto obligatorio (2.5)</legend>
                  <textarea name="analisis_impacto_texto" rows={3} placeholder="Semanas antes y después, efecto en incrementos del art. 167 o en las 500 semanas…"
                    className="w-full rounded-[var(--radius-boton)] border border-borde bg-surface p-3 text-sm" />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="analisis_impacto_ok" value="si" className="size-5" /> Hice el análisis de impacto</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="cliente_entendio_costo" value="si" className="size-5" /> El cliente recibió y entendió el costo en semanas</label>
                </fieldset>
              )}
              {embudo === "retiro" && <p className="text-xs text-ink-muted">Al firmar, el caso pasa directo a «Armando expediente» y empieza a contar la vigencia del contrato.</p>}
            </>
          )}
          {elegida.destino === "INGRESADA" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoFecha id="fecha_ingreso_solicitud" etiqueta="Fecha de ingreso a la Afore" valor={valores.fecha_ingreso_solicitud || hoy} max={hoy} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="acuse_afore">Folio o acuse de la Afore</Label>
                <Input id="acuse_afore" name="acuse_afore" defaultValue={valores.acuse_afore} />
              </div>
            </div>
          )}
          {elegida.destino === "RESOLUCION" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="resultado_afore">Resultado</Label>
                <select id="resultado_afore" name="resultado_afore" defaultValue="aprobado" className={claseSelect}>
                  <option value="aprobado">Aprobado</option>
                </select>
                <p className="text-xs text-ink-muted">Si la Afore rechazó o pidió cita, usa «Bloqueado o rechazado».</p>
              </div>
              <CampoFecha id="fecha_resolucion" etiqueta="Fecha de resolución" valor={valores.fecha_resolucion || hoy} max={hoy} />
            </div>
          )}
          {elegida.destino === "PERDIDO" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="motivo_perdida">Motivo de pérdida</Label>
              <select id="motivo_perdida" name="motivo_perdida" defaultValue="no_contesta" className={claseSelect}>
                {MOTIVOS_PERDIDA.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </div>
          )}
          {elegida.destino === "BLOQUEADO" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="atribuible_cliente" value="si" className="size-5" />
              Es por causa del cliente (suspende el conteo de la vigencia del contrato)
            </label>
          )}
          {pideMotivo && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="motivo">Motivo</Label>
              <textarea id="motivo" name="motivo" rows={2} required placeholder={elegida.destino === "BLOQUEADO" ? "IDE sin biometría, cita en la Afore, documento rechazado…" : "¿Qué pasó?"}
                className="w-full rounded-[var(--radius-boton)] border border-borde bg-surface p-3 text-sm" />
            </div>
          )}
        </FormularioAccion>
      )}
    </div>
  );
}

function Opcion({ o, activa, alElegir }: { o: OpcionEtapa; activa: boolean; alElegir: (d: string) => void }) {
  const bloqueantes = o.faltantes.filter((f) => !SE_CAPTURA_AQUI.test(f));
  const Icono = o.regreso ? ArrowLeft : o.destino === "PERDIDO" ? XCircle : o.destino === "BLOQUEADO" ? Ban : ArrowRight;
  return (
    <li>
      <button type="button" onClick={() => alElegir(o.destino)} aria-pressed={activa}
        className={cn("flex w-full items-start gap-3 rounded-[var(--radius-boton)] border p-3 text-left text-sm transition-colors",
          activa ? "border-brand bg-brand-tint" : "border-borde bg-surface hover:border-brand/60")}>
        <Icono className={cn("mt-0.5 size-4 shrink-0", bloqueantes.length ? "text-ink-muted" : "text-brand")} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="font-medium text-ink">{o.regreso ? `Regresar a «${o.nombre}»` : o.nombre}</span>
          {o.faltantes.length > 0 && (
            <ul className="mt-1 grid gap-0.5 text-xs text-ink-muted">
              {o.faltantes.map((f) => (
                <li key={f} className="flex gap-1">
                  <CircleAlert className={cn("mt-0.5 size-3 shrink-0", SE_CAPTURA_AQUI.test(f) ? "text-brand" : "text-aviso")} aria-hidden />
                  {f}{SE_CAPTURA_AQUI.test(f) ? " (se captura aquí)" : ""}
                </li>
              ))}
            </ul>
          )}
        </span>
      </button>
    </li>
  );
}

function CampoFecha({ id, etiqueta, valor, max }: { id: string; etiqueta: string; valor: string; max: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input id={id} name={id} type="date" defaultValue={valor} max={max} />
    </div>
  );
}
