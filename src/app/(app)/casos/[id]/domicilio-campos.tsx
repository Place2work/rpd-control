"use client";

// Domicilio por partes (todas opcionales): estado y municipio de la lista del INEGI, el estado se sugiere por el
// código postal, y abajo se ve cómo quedará en el contrato. Se usa dentro de FormularioAccion.
import { useEffect, useMemo, useState } from "react";
import { Input, Label } from "@/components/ui/input";
import { componerDomicilio, estadoPorCodigoPostal } from "@/lib/reglas/domicilio";
import { claseSelect } from "./campos";

type Catalogo = { estados: { clave: string; nombre: string; municipios: string[] }[] };
export type DomicilioInicial = {
  calle: string | null; numeroExterior: string | null; numeroInterior: string | null; colonia: string | null;
  codigoPostal: string | null; municipio: string | null; estado: string | null; domicilio: string | null;
};

const sinAcentos = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function DomicilioCampos({ inicial }: { inicial: DomicilioInicial }) {
  const [cat, setCat] = useState<Catalogo | null>(null);
  const [v, setV] = useState({
    calle: inicial.calle ?? "", numeroExterior: inicial.numeroExterior ?? "", numeroInterior: inicial.numeroInterior ?? "",
    colonia: inicial.colonia ?? "", codigoPostal: inicial.codigoPostal ?? "", municipio: inicial.municipio ?? "", estado: inicial.estado ?? "",
  });
  const cambiar = (k: keyof typeof v, x: string) => setV((a) => ({ ...a, [k]: x }));

  useEffect(() => {
    let vivo = true;
    fetch("/catalogos/municipios-mx.json").then((r) => (r.ok ? r.json() : null)).then((d) => { if (vivo && d) setCat(d); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  // Un valor capturado antes que no está tal cual en la lista se empata sin acentos («QUERETARO» → «Querétaro»).
  const estadoCat = useMemo(() => cat?.estados.find((e) => sinAcentos(e.nombre) === sinAcentos(v.estado)) ?? null, [cat, v.estado]);
  const municipios = estadoCat?.municipios ?? [];
  const municipioEnLista = municipios.find((m) => sinAcentos(m) === sinAcentos(v.municipio));
  const sugerido = estadoPorCodigoPostal(v.codigoPostal);
  const vista = componerDomicilio({ ...v, estado: estadoCat?.nombre ?? v.estado, municipio: municipioEnLista ?? v.municipio });

  return (
    <div className="grid gap-4 sm:col-span-2 sm:grid-cols-6">
      <div className="grid gap-1.5 sm:col-span-3"><Label htmlFor="calle">Calle <span className="font-normal text-ink-muted">· opcional</span></Label>
        <Input id="calle" name="calle" value={v.calle} onChange={(e) => cambiar("calle", e.target.value)} maxLength={120} /></div>
      <div className="grid gap-1.5 sm:col-span-1"><Label htmlFor="numero_exterior">Núm. ext.</Label>
        <Input id="numero_exterior" name="numero_exterior" value={v.numeroExterior} onChange={(e) => cambiar("numeroExterior", e.target.value)} maxLength={20} /></div>
      <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="numero_interior">Núm. int. <span className="font-normal text-ink-muted">· opcional</span></Label>
        <Input id="numero_interior" name="numero_interior" value={v.numeroInterior} onChange={(e) => cambiar("numeroInterior", e.target.value)} maxLength={30} placeholder="402 C, Depto 5…" /></div>
      <div className="grid gap-1.5 sm:col-span-4"><Label htmlFor="colonia">Colonia</Label>
        <Input id="colonia" name="colonia" value={v.colonia} onChange={(e) => cambiar("colonia", e.target.value)} maxLength={120} /></div>
      <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="codigo_postal">Código postal</Label>
        <Input id="codigo_postal" name="codigo_postal" value={v.codigoPostal} inputMode="numeric" maxLength={5} placeholder="5 dígitos"
          onChange={(e) => cambiar("codigoPostal", e.target.value.replace(/\D/g, "").slice(0, 5))} />
        {sugerido && sinAcentos(sugerido) !== sinAcentos(v.estado) && (
          <button type="button" className="justify-self-start text-xs text-brand underline" onClick={() => setV((a) => ({ ...a, estado: sugerido, municipio: "" }))}>
            ¿Es de {sugerido}? Usar este estado
          </button>
        )}
      </div>
      <div className="grid gap-1.5 sm:col-span-3"><Label htmlFor="estado">Estado</Label>
        <select id="estado" name="estado" value={estadoCat?.nombre ?? v.estado} className={claseSelect}
          onChange={(e) => setV((a) => ({ ...a, estado: e.target.value, municipio: "" }))}>
          <option value="">{cat ? "Elige el estado" : "Cargando estados…"}</option>
          {v.estado && !estadoCat && <option value={v.estado}>{v.estado} (capturado antes)</option>}
          {cat?.estados.map((e) => <option key={e.clave} value={e.nombre}>{e.nombre}</option>)}
        </select></div>
      <div className="grid gap-1.5 sm:col-span-3"><Label htmlFor="municipio">Municipio</Label>
        <select id="municipio" name="municipio" value={municipioEnLista ?? v.municipio} className={claseSelect} disabled={!estadoCat && !v.municipio}
          onChange={(e) => cambiar("municipio", e.target.value)}>
          <option value="">{estadoCat ? "Elige el municipio" : "Primero elige el estado"}</option>
          {v.municipio && !municipioEnLista && <option value={v.municipio}>{v.municipio} (capturado antes)</option>}
          {municipios.map((m) => <option key={m} value={m}>{m}</option>)}
        </select></div>
      <div className="rounded-[var(--radius-boton)] bg-slate-50 p-3 text-sm sm:col-span-6">
        <p className="text-xs text-ink-muted">Así va en el contrato</p>
        <p className="text-ink">{vista ?? inicial.domicilio ?? "—"}</p>
        {/* Sin partes capturadas se conserva el domicilio escrito antes (o en la pestaña Contrato). */}
        {!vista && inicial.domicilio && <input type="hidden" name="domicilio" value={inicial.domicilio} />}
      </div>
    </div>
  );
}
