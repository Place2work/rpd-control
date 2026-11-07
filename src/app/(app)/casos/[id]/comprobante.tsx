"use client";

// Comprobante de la transferencia con que el cliente pagó el honorario: subir (del navegador directo
// al almacén con liga firmada, igual que el expediente) y ver (liga de 10 minutos).
import { Eye, Paperclip, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { validarComprobante } from "@/lib/documentos/reglas";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { prepararComprobante, registrarComprobante, verComprobante } from "./acciones-dinero";

const boton = "inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-boton)] border border-brand px-3 text-sm font-medium text-brand hover:bg-brand-tint disabled:opacity-50 md:h-9";

export function Comprobante({ casoId, cobroId, tiene }: { casoId: string; cobroId: string; tiene: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<{ cargando?: string; error?: string }>({});

  async function subir(archivo: File) {
    const mime = archivo.type || (archivo.name.toLowerCase().endsWith(".heic") ? "image/heic" : "");
    const problema = validarComprobante(mime, archivo.size);
    if (problema) return setEstado({ error: problema });
    setEstado({ cargando: "Subiendo…" });
    const p = await prepararComprobante(casoId, cobroId, mime, archivo.size);
    if (!p.subida) return setEstado({ error: p.error });
    if (p.subida.modo === "supabase") {
      const { error } = await crearClienteNavegador().storage.from("expedientes").uploadToSignedUrl(p.subida.ruta, p.subida.token, archivo, { contentType: mime });
      if (error) return setEstado({ error: "No se pudo subir el archivo. Revisa tu conexión e intenta de nuevo." });
    } else {
      const r = await fetch(p.subida.url, { method: "PUT", body: archivo });
      if (!r.ok) return setEstado({ error: "No se pudo subir el archivo." });
    }
    const r = await registrarComprobante(casoId, cobroId, p.subida.ruta, mime);
    if (r.error) return setEstado({ error: r.error });
    setEstado({});
    router.refresh();
  }

  async function ver() {
    setEstado({ cargando: "Abriendo…" });
    const r = await verComprobante(casoId, cobroId);
    setEstado(r.error ? { error: r.error } : {});
    if (r.url) window.open(r.url, "_blank", "noopener");
  }

  return (
    <div className="mt-2 flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={input} type="file" accept="image/*,application/pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) subir(f); }} />
        {tiene && (
          <button type="button" onClick={ver} disabled={!!estado.cargando} className={boton}>
            <Eye className="size-4" aria-hidden /> Ver comprobante
          </button>
        )}
        <button type="button" onClick={() => input.current?.click()} disabled={!!estado.cargando}
          className={tiene ? "inline-flex h-11 items-center gap-1.5 px-2 text-sm text-ink-muted hover:text-ink disabled:opacity-50 md:h-9" : boton}>
          {tiene ? <Upload className="size-4" aria-hidden /> : <Paperclip className="size-4" aria-hidden />}
          {estado.cargando ?? (tiene ? "Reemplazar" : "Subir comprobante de transferencia")}
        </button>
      </div>
      {estado.error && <p role="alert" className="text-xs text-critico">{estado.error}</p>}
    </div>
  );
}
