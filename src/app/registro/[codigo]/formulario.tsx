"use client";

import { CheckCircle2 } from "lucide-react";
import { startTransition, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registrarDesdeQr, type EstadoRegistro } from "../acciones";

type Props = { codigo: string; sello: string; promotor: string; municipio: string; servicios: readonly (readonly [string, string])[] };

export function FormularioRegistro({ codigo, sello, promotor, municipio, servicios }: Props) {
  const [estado, enviar, enviando] = useActionState<EstadoRegistro, FormData>(registrarDesdeQr.bind(null, codigo), {});
  const err = estado.errores ?? {};

  if (estado.ok) {
    return (
      <div className="grid gap-3 rounded-[var(--radius-tarjeta)] border border-borde bg-surface p-6 text-center">
        <CheckCircle2 className="mx-auto size-12 text-exito" aria-hidden />
        <h1 className="font-display text-2xl font-semibold text-ink">¡Listo, ya quedaste registrado!</h1>
        <p className="text-sm text-ink-muted">Un asesor te va a escribir por WhatsApp para revisar tu caso. Guarda nuestro número: 56 6474 9567.</p>
      </div>
    );
  }

  const campo = (id: string, etiqueta: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">{etiqueta}</label>
      <Input id={id} name={id} aria-invalid={Boolean(err[id])} {...props} />
      {err[id] && <p className="text-xs text-critico">{err[id]}</p>}
    </div>
  );

  return (
    <form
      className="relative grid grid-cols-[minmax(0,1fr)] gap-4 rounded-[var(--radius-tarjeta)] border border-borde bg-surface p-5"
      onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); startTransition(() => enviar(d)); }}
    >
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">¿Te quedaste sin trabajo?</h1>
        <p className="mt-1 text-sm text-ink-muted">Déjanos tus datos y un asesor te dice por WhatsApp si puedes retirar dinero de tu Afore. Te atiende {promotor}.</p>
      </div>
      {campo("nombre", "Tu nombre completo", { autoComplete: "name", placeholder: "Juan Pérez López", required: true })}
      {campo("whatsapp", "Tu WhatsApp (10 dígitos)", { inputMode: "tel", autoComplete: "tel", placeholder: "55 1234 5678", required: true })}
      <div className="grid gap-1.5">
        <label htmlFor="curp" className="text-sm font-medium text-ink">Tu CURP</label>
        <Input id="curp" name="curp" aria-invalid={Boolean(err.curp)} autoComplete="off" autoCapitalize="characters" maxLength={18} minLength={18} required placeholder="PELJ800101HMCRPN09" className="uppercase" />
        {err.curp ? <p className="text-xs text-critico">{err.curp}</p>
          : <p className="text-xs text-ink-muted">La necesitamos para revisar tu caso. ¿No la sabes? <a href="https://www.gob.mx/curp/" target="_blank" rel="noopener noreferrer" className="text-brand underline">Consúltala aquí</a>.</p>}
      </div>
      {campo("municipio", "Tu municipio", { defaultValue: municipio, placeholder: "Jiutepec", required: true })}
      <div className="grid gap-1.5">
        <label htmlFor="tipo_servicio" className="text-sm font-medium text-ink">¿Qué te interesa? (opcional)</label>
        <select id="tipo_servicio" name="tipo_servicio" className="h-11 w-full min-w-0 rounded-[var(--radius-boton)] border border-borde bg-surface px-3 text-sm" defaultValue="">
          <option value="">No sé todavía</option>
          {servicios.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </div>
      {/* Trampa para robots: invisible para las personas. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label htmlFor="sitio">Sitio web</label><input id="sitio" name="sitio" tabIndex={-1} autoComplete="off" />
      </div>
      <input type="hidden" name="t" value={sello} />
      <label className="flex items-start gap-2 text-sm text-ink">
        <input type="checkbox" name="acepto" value="si" className="mt-1 size-4" required />
        <span>Acepto el <a href="https://www.retiropordesempleo.com/aviso-de-privacidad" target="_blank" rel="noopener noreferrer" className="text-brand underline">aviso de privacidad</a>. Solo usaremos tus datos para contactarte sobre tu trámite.</span>
      </label>
      {err.acepto && <p className="text-xs text-critico">{err.acepto}</p>}
      {estado.error && <p role="alert" className="rounded-[var(--radius-boton)] bg-critico-tint p-3 text-sm text-critico">{estado.error}</p>}
      <Button type="submit" disabled={enviando} className="h-12 text-base">{enviando ? "Enviando…" : "Quiero que me contacten"}</Button>
      <p className="text-xs text-ink-muted">Tus datos viajan y se guardan protegidos. Nunca te pediremos contraseñas.</p>
    </form>
  );
}
