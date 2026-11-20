"use client";

// Pago de la comisión al asesor (o referidor) desde el expediente: fecha, método, referencia y el comprobante de
// la transferencia (se sube directo al almacén con liga firmada, como el del cobro). Y ver/reemplazar después.
import { Eye, Paperclip, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { validarComprobante } from "@/lib/documentos/reglas";
import { crearClienteNavegador } from "@/lib/supabase/client";
import type { Resultado } from "./acciones";
import { pagarComision, prepararComprobanteComision, registrarComprobanteComision, verComprobanteComision } from "./acciones-comision";

const campo = "h-11 w-full rounded-[var(--radius-boton)] border border-borde bg-surface px-3 text-sm text-ink md:h-10";
const boton = "inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-boton)] border border-brand px-3 text-sm font-medium text-brand hover:bg-brand-tint disabled:opacity-50";

async function subirArchivo(casoId: string, comisionId: string, archivo: File): Promise<{ ruta?: string; mime?: string; error?: string }> {
  const mime = archivo.type || (archivo.name.toLowerCase().endsWith(".heic") ? "image/heic" : "");
  const problema = validarComprobante(mime, archivo.size);
  if (problema) return { error: problema };
  const p = await prepararComprobanteComision(casoId, comisionId, mime, archivo.size);
  if (!p.subida) return { error: p.error };
  if (p.subida.modo === "supabase") {
    const { error } = await crearClienteNavegador().storage.from("expedientes").uploadToSignedUrl(p.subida.ruta, p.subida.token, archivo, { contentType: mime });
    if (error) return { error: "No se pudo subir el archivo. Revisa tu conexión e intenta de nuevo." };
  } else {
    const r = await fetch(p.subida.url, { method: "PUT", body: archivo });
    if (!r.ok) return { error: "No se pudo subir el archivo." };
  }
  return { ruta: p.subida.ruta, mime };
}

/** Formulario «Registrar pago» de una comisión devengada (solo Director). */
export function PagarComision({ casoId, comisionId, hoy, desde }: { casoId: string; comisionId: string; hoy: string; desde: string | null }) {
  const router = useRouter();
  const [estado, enviar, enviando] = useActionState<Resultado, FormData>(pagarComision.bind(null, casoId, comisionId), {});
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errores = Object.values(estado.errores ?? {});
  useEffect(() => { if (estado.ok) router.refresh(); }, [estado, router]);

  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-xs font-medium text-brand underline">Registrar pago</summary>
      <form className="mt-2 grid gap-2 rounded-[var(--radius-boton)] bg-slate-50 p-3 text-sm" onSubmit={async (e) => {
        e.preventDefault(); setError(null);
        const datos = new FormData(e.currentTarget);
        if (archivo) {
          setSubiendo("Subiendo comprobante…");
          const r = await subirArchivo(casoId, comisionId, archivo);
          setSubiendo(null);
          if (r.error) return setError(r.error);
          datos.set("comprobante_ruta", r.ruta!); datos.set("comprobante_mime", r.mime!);
        }
        startTransition(() => enviar(datos));
      }}>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="grid gap-1 text-xs text-ink-muted">Fecha de pago
            <input type="date" name="fecha_pago" defaultValue={hoy} max={hoy} min={desde ?? undefined} required className={campo} /></label>
          <label className="grid gap-1 text-xs text-ink-muted">Método
            <select name="metodo" defaultValue="transferencia" className={campo}>
              <option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option>
            </select></label>
          <label className="grid gap-1 text-xs text-ink-muted">Referencia (opcional)
            <input name="referencia" maxLength={120} placeholder="Folio SPEI" className={campo} /></label>
        </div>
        <label className="grid gap-1 text-xs text-ink-muted">Comprobante de la transferencia (PDF o imagen, opcional)
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} className="text-sm text-ink" /></label>
        {(error || estado.error || errores.length > 0) && <p role="alert" className="text-xs text-critico">{error ?? estado.error ?? errores.join(" · ")}</p>}
        <div><Button type="submit" disabled={enviando || !!subiendo}>{subiendo ?? (enviando ? "Guardando…" : "Marcar como pagada")}</Button></div>
      </form>
    </details>
  );
}

/** Ver el comprobante (Director y beneficiario); el Director también lo sube o reemplaza. */
export function ComprobanteComision({ casoId, comisionId, tiene, puedeSubir }: { casoId: string; comisionId: string; tiene: boolean; puedeSubir: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<{ cargando?: string; error?: string }>({});
  if (!tiene && !puedeSubir) return null;

  async function subir(archivo: File) {
    setEstado({ cargando: "Subiendo…" });
    const r = await subirArchivo(casoId, comisionId, archivo);
    if (r.error) return setEstado({ error: r.error });
    const g = await registrarComprobanteComision(casoId, comisionId, r.ruta!, r.mime!);
    if (g.error) return setEstado({ error: g.error });
    setEstado({}); router.refresh();
  }
  async function ver() {
    setEstado({ cargando: "Abriendo…" });
    const r = await verComprobanteComision(casoId, comisionId);
    setEstado(r.error ? { error: r.error } : {});
    if (r.url) window.open(r.url, "_blank", "noopener");
  }
  return (
    <div className="mt-1 flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={input} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) subir(f); }} />
        {tiene && <button type="button" onClick={ver} disabled={!!estado.cargando} className={boton}><Eye className="size-4" aria-hidden /> Ver comprobante</button>}
        {puedeSubir && (
          <button type="button" onClick={() => input.current?.click()} disabled={!!estado.cargando}
            className={tiene ? "inline-flex h-9 items-center gap-1.5 px-1 text-xs text-ink-muted hover:text-ink disabled:opacity-50" : boton}>
            {tiene ? <Upload className="size-4" aria-hidden /> : <Paperclip className="size-4" aria-hidden />}{estado.cargando ?? (tiene ? "Reemplazar" : "Subir comprobante")}
          </button>
        )}
      </div>
      {estado.error && <p role="alert" className="text-xs text-critico">{estado.error}</p>}
    </div>
  );
}
