"use client";

import { AlertTriangle, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { LigasConsulta } from "@/components/rpd/ligas-consulta";
import type { LigasConsulta as Ligas } from "@/lib/parametros";
import { ORIGENES } from "@/lib/prospectos/validacion";
import { cn } from "@/lib/utils";
import { crearProspecto, type EstadoAlta } from "../acciones";

type Props = {
  servicios: { clave: string; nombre: string }[];
  referidores: { id: string; nombre: string }[];
  ligas: Ligas;
  hoy: string;
};

const CAMPO_DUPLICADO = { telefono: "WhatsApp", curp: "CURP", nss: "NSS" } as const;
const claseSelect =
  "h-11 w-full rounded-[var(--radius-boton)] border border-borde bg-surface px-3 text-sm text-ink md:h-10";

export function FormularioAlta({ servicios, referidores, ligas, hoy }: Props) {
  const [estado, accion, enviando] = useActionState<EstadoAlta, FormData>(crearProspecto, {});
  const v = estado.valores ?? {};
  const e = estado.errores ?? {};
  const [masDatos, setMasDatos] = useState(Boolean(v.curp || v.nss || v.apellido_paterno));
  const soloTelefono = estado.duplicados?.length && estado.duplicados.every((d) => d.campo === "telefono");

  return (
    <form action={accion} className="grid max-w-2xl gap-4" noValidate>
      {estado.mensaje && (
        <div role="alert" className="flex gap-3 rounded-[var(--radius-tarjeta)] border border-aviso/30 bg-aviso-tint p-4 text-sm text-aviso">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="flex flex-col gap-2">
            <p className="font-medium">{estado.mensaje}</p>
            {estado.duplicados?.map((d, i) => (
              <p key={i}>
                Coincide el {CAMPO_DUPLICADO[d.campo]}.{" "}
                {d.visible && d.persona_id ? (
                  <Link href={`/prospectos?q=${encodeURIComponent(v.whatsapp ?? "")}`} className="underline">Ver registro</Link>
                ) : (
                  "Lo trae otra persona del equipo; pídele al Director que lo revise."
                )}
              </p>
            ))}
            {soloTelefono && (
              <label className="flex items-center gap-2 font-medium text-ink">
                <input type="checkbox" name="confirmar_duplicado" value="si" className="size-5" />
                Es otra persona, darla de alta de todos modos
              </label>
            )}
          </div>
        </div>
      )}

      <Card>
        <CardContent className="grid gap-4">
          <Campo id="nombre" etiqueta="Nombre" error={e.nombre}>
            <Input id="nombre" name="nombre" defaultValue={v.nombre} autoComplete="off" autoFocus required aria-invalid={!!e.nombre} />
          </Campo>
          <Campo id="whatsapp" etiqueta="WhatsApp" ayuda="10 dígitos" error={e.whatsapp}>
            <Input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" defaultValue={v.whatsapp} placeholder="777 123 4567"
              autoComplete="off" required aria-invalid={!!e.whatsapp} />
          </Campo>
          <Campo id="tipo_servicio" etiqueta="Servicio de interés" error={e.tipo_servicio}>
            <select id="tipo_servicio" name="tipo_servicio" defaultValue={v.tipo_servicio ?? "RETIRO_DESEMPLEO"} className={claseSelect}>
              {servicios.map((s) => <option key={s.clave} value={s.clave}>{s.nombre.split(" (")[0]}</option>)}
            </select>
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="fecha_baja" etiqueta="Fecha de baja" ayuda="Si la sabe" error={e.fecha_baja}>
              <Input id="fecha_baja" name="fecha_baja" type="date" max={hoy} defaultValue={v.fecha_baja} />
            </Campo>
            <Campo id="origen" etiqueta="¿Cómo llegó?" error={e.origen}>
              <select id="origen" name="origen" defaultValue={v.origen ?? "whatsapp"} className={claseSelect}>
                {ORIGENES.map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
              </select>
            </Campo>
          </div>
          {referidores.length > 0 && (
            <Campo id="referidor_id" etiqueta="Referidor" ayuda="Opcional">
              <select id="referidor_id" name="referidor_id" defaultValue={v.referidor_id ?? ""} className={claseSelect}>
                <option value="">Sin referidor</option>
                {referidores.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </Campo>
          )}
        </CardContent>
      </Card>

      <Card>
        <button type="button" onClick={() => setMasDatos(!masDatos)} aria-expanded={masDatos}
          className="flex h-14 w-full items-center justify-between px-5 text-left font-medium text-ink">
          Apellidos, CURP y NSS <span className="text-sm font-normal text-ink-muted">opcional</span>
          <ChevronDown className={cn("size-5 text-ink-muted transition-transform", masDatos && "rotate-180")} aria-hidden />
        </button>
        <CardContent className={cn("grid gap-4 pt-0", !masDatos && "hidden")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="apellido_paterno" etiqueta="Apellido paterno">
              <Input id="apellido_paterno" name="apellido_paterno" defaultValue={v.apellido_paterno} autoComplete="off" />
            </Campo>
            <Campo id="apellido_materno" etiqueta="Apellido materno">
              <Input id="apellido_materno" name="apellido_materno" defaultValue={v.apellido_materno} autoComplete="off" />
            </Campo>
          </div>
          <Campo id="curp" etiqueta="CURP" ayuda="18 caracteres; se guarda cifrada" error={e.curp}>
            <Input id="curp" name="curp" defaultValue={v.curp} maxLength={18} autoCapitalize="characters" autoComplete="off"
              className="font-mono uppercase" aria-invalid={!!e.curp} />
          </Campo>
          <Campo id="nss" etiqueta="NSS" ayuda="11 dígitos; se guarda cifrado" error={e.nss}>
            <Input id="nss" name="nss" defaultValue={v.nss} inputMode="numeric" maxLength={13} autoComplete="off"
              className="font-mono" aria-invalid={!!e.nss} />
          </Campo>
          <div>
            <p className="text-xs font-medium text-ink-muted">¿No los tiene a la mano? Consúltalos en:</p>
            <LigasConsulta ligas={ligas} />
          </div>
        </CardContent>
      </Card>

      <label className="flex items-start gap-3 text-sm text-ink">
        <input type="checkbox" name="privacidad" value="si" defaultChecked={v.privacidad === "si"} className="mt-0.5 size-5" />
        El cliente recibió y aceptó el aviso de privacidad
      </label>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={enviando} className="min-w-40">{enviando ? "Guardando…" : "Dar de alta"}</Button>
        <Button type="button" variant="fantasma" asChild><Link href="/prospectos">Cancelar</Link></Button>
      </div>
    </form>
  );
}

function Campo({ id, etiqueta, ayuda, error, children }: { id: string; etiqueta: string; ayuda?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {etiqueta} {ayuda && <span className="font-normal text-ink-muted">· {ayuda}</span>}
      </Label>
      {children}
      {error && <p className="text-sm text-critico" id={`${id}-error`}>{error}</p>}
    </div>
  );
}
