"use client";

import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { prepararFotoCampo, registrarJornada } from "./acciones";

// Foto del módulo del día: va del celular directo al almacén con liga firmada; luego se registra el día.
export function FotoDelDia() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [municipio, setMunicipio] = useState("");
  const [lugar, setLugar] = useState("");
  const [estado, setEstado] = useState<{ cargando?: string; error?: string; ok?: boolean }>({});

  async function subir(archivo: File) {
    if (municipio.trim().length < 2 || lugar.trim().length < 2) return setEstado({ error: "Primero escribe el municipio y el lugar." });
    const mime = archivo.type || (archivo.name.toLowerCase().endsWith(".heic") ? "image/heic" : "");
    setEstado({ cargando: "Preparando…" });
    const p = await prepararFotoCampo(mime, archivo.size);
    if (!p.subida) return setEstado({ error: p.error });
    setEstado({ cargando: "Subiendo foto…" });
    if (p.subida.modo === "supabase") {
      const { error } = await crearClienteNavegador().storage.from("campo").uploadToSignedUrl(p.subida.ruta, p.subida.token, archivo, { contentType: mime });
      if (error) return setEstado({ error: "No se pudo subir la foto. Revisa tu conexión e intenta de nuevo." });
    } else {
      const r = await fetch(p.subida.url, { method: "PUT", body: archivo });
      if (!r.ok) return setEstado({ error: "No se pudo subir la foto." });
    }
    const r = await registrarJornada(p.subida.ruta, municipio, lugar);
    if (r.error) return setEstado({ error: r.error });
    setEstado({ ok: true });
    router.refresh();
  }

  const campo = "h-11 w-full rounded-[var(--radius-boton)] border border-borde bg-surface px-3 text-base text-ink";
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium text-ink">Municipio
          <input className={campo} value={municipio} onChange={(e) => setMunicipio(e.target.value)} placeholder="Jiutepec" autoComplete="off" />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-ink">Lugar donde pusiste el módulo
          <input className={campo} value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Plaza principal, frente al mercado" autoComplete="off" />
        </label>
      </div>
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) subir(f); }} />
      <button type="button" disabled={!!estado.cargando} onClick={() => input.current?.click()}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-boton)] bg-brand px-4 text-base font-medium text-white hover:bg-brand-dark disabled:opacity-50">
        <Camera className="size-5" aria-hidden /> {estado.cargando ?? "Tomar foto del módulo"}
      </button>
      {estado.error && <p role="alert" className="text-sm text-critico">{estado.error}</p>}
      {estado.ok && <p role="status" className="text-sm text-exito-texto">Listo: tu día quedó registrado. Falta que lo aprueben.</p>}
    </div>
  );
}
