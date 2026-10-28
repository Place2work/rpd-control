"use client";

import { Camera, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { validarArchivo } from "@/lib/documentos/reglas";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { prepararDocumento, registrarDocumento } from "./acciones-documentos";

// El archivo va del navegador directo al almacén con una liga firmada que genera el servidor
// (Vercel no acepta cuerpos de más de 4.5 MB). El servidor decide la ruta y registra el documento.
export function SubirDocumento({ casoId, tipoId, pideEmision, hoy, textoBoton = "Subir" }:
  { casoId: string; tipoId: string; pideEmision: boolean; hoy: string; textoBoton?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [emision, setEmision] = useState("");
  const [estado, setEstado] = useState<{ cargando?: string; error?: string }>({});

  async function subir(archivo: File) {
    const mime = archivo.type || (archivo.name.toLowerCase().endsWith(".heic") ? "image/heic" : "");
    const problema = validarArchivo(mime, archivo.size);
    if (problema) return setEstado({ error: problema });
    if (pideEmision && !emision) return setEstado({ error: "Primero captura la fecha de emisión del documento." });

    setEstado({ cargando: "Preparando…" });
    const p = await prepararDocumento(casoId, tipoId, mime, archivo.size);
    if (!p.subida) return setEstado({ error: p.error });

    setEstado({ cargando: "Subiendo…" });
    if (p.subida.modo === "supabase") {
      const { error } = await crearClienteNavegador().storage.from("expedientes")
        .uploadToSignedUrl(p.subida.ruta, p.subida.token, archivo, { contentType: mime });
      if (error) return setEstado({ error: "No se pudo subir el archivo. Revisa tu conexión e intenta de nuevo." });
    } else {
      const r = await fetch(p.subida.url, { method: "PUT", body: archivo });
      if (!r.ok) return setEstado({ error: "No se pudo subir el archivo." });
    }

    const r = await registrarDocumento(casoId, tipoId, p.subida.ruta, mime, archivo.size, pideEmision ? emision : null);
    if (r.error) return setEstado({ error: r.error });
    setEstado({});
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {pideEmision && (
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            Emitido el
            <input type="date" value={emision} max={hoy} onChange={(e) => setEmision(e.target.value)} aria-label="Fecha de emisión"
              className="h-11 rounded-[var(--radius-boton)] border border-borde bg-surface px-2 text-sm text-ink md:h-9" />
          </label>
        )}
        <input ref={input} type="file" accept="image/*,application/pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) subir(f); }} />
        <button type="button" disabled={!!estado.cargando} onClick={() => input.current?.click()}
          className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-boton)] border border-brand px-3 text-sm font-medium text-brand hover:bg-brand-tint disabled:opacity-50 md:h-9">
          <Camera className="size-4 md:hidden" aria-hidden /><Upload className="hidden size-4 md:block" aria-hidden />
          {estado.cargando ?? textoBoton}
        </button>
      </div>
      {estado.error && <p role="alert" className="text-xs text-critico">{estado.error}</p>}
    </div>
  );
}
