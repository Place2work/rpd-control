"use client";

// «Leer INE»: la IA lee la credencial y llena los datos del cliente. Con `auto` (recién subida) corre sola: llena lo
// vacío y solo pregunta por lo que ya tenía otro valor. La CURP se ve parcial; se guarda cifrada.
import { CheckCircle2, ScanLine, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { aplicarIne, autoIne, verIne, type VistaIne } from "./acciones-ine";

export function LectorIne({ casoId, documentoId, auto = false }: { casoId: string; documentoId: string; auto?: boolean }) {
  const router = useRouter();
  const [vista, setVista] = useState<VistaIne | null>(null);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [resultado, setResultado] = useState<{ ok?: boolean; error?: string }>({});
  const [cargando, iniciar] = useTransition();
  const yaCorrio = useRef(false);

  const mostrar = (v: VistaIne) => {
    setVista(v);
    setElegidos((v.campos ?? []).filter((c) => c.cambia && !(c.clave === "curp" && v.curpDistinta)).map((c) => c.clave));
  };
  useEffect(() => {
    if (!auto || yaCorrio.current) return;
    yaCorrio.current = true;
    iniciar(async () => {
      const v = await autoIne(casoId, documentoId);
      mostrar(v);
      if (!v.error) router.refresh();
    });
  }, [auto, casoId, documentoId, router]);
  const abrir = () => iniciar(async () => { setResultado({}); mostrar(await verIne(casoId, documentoId)); });
  const pasar = () => iniciar(async () => {
    const r = await aplicarIne(casoId, documentoId, vista?.valores ?? {}, elegidos);
    setResultado(r);
    if (r.ok) { setVista(null); router.refresh(); }
  });
  const marcar = (clave: string, si: boolean) => setElegidos((e) => (si ? [...new Set([...e, clave])] : e.filter((x) => x !== clave)));
  const boton = (
    <button type="button" onClick={abrir} disabled={cargando}
      className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-boton)] bg-brand px-3 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 md:h-9">
      <ScanLine className="size-4" aria-hidden /> {cargando ? "Leyendo la INE…" : "Leer INE"}
    </button>
  );
  const llenados = vista?.llenados && !vista.curpDistinta && (
    <p role="status" className="flex items-center gap-1 text-xs text-exito-texto">
      <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
      {vista.llenados.length ? `INE leída: ${vista.llenados.length === 1 ? "se llenó 1 dato vacío" : `se llenaron ${vista.llenados.length} datos vacíos`} (${vista.llenados.join(", ")}).` : "INE leída: no había datos vacíos que llenar."}
    </p>
  );
  const pendientes = (vista?.campos ?? []).filter((c) => c.cambia);

  if (!vista || (!vista.error && !vista.curpDistinta && pendientes.length === 0)) {
    return (
      <div className="flex max-w-sm flex-col gap-1 md:items-end">
        {boton}
        {llenados}
        {vista?.avisos?.map((a) => <p key={a} className="text-xs text-aviso">{a}</p>)}
        {resultado.ok && <p role="status" className="flex items-center gap-1 text-xs text-exito-texto"><CheckCircle2 className="size-3.5" aria-hidden /> Datos del cliente actualizados</p>}
      </div>
    );
  }
  if (vista.error) {
    return (
      <div className="flex max-w-sm flex-col gap-1 md:items-end">
        <p role="alert" className="text-xs text-critico">{vista.error}</p>
        <button type="button" onClick={() => setVista(null)} className="text-xs text-brand underline">Cerrar</button>
      </div>
    );
  }
  return (
    <div className="w-full rounded-[var(--radius-boton)] border border-borde bg-slate-50 p-4 text-sm md:col-span-2">
      {llenados}
      {vista.curpDistinta ? (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-critico-tint p-2 text-xs text-critico">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> La CURP de esta INE no es la del cliente. No se llenó nada; revisa que sea el documento correcto.
        </p>
      ) : (
        <p className="mt-1 font-medium text-ink">{vista.llenados ? "Estos datos ya tenían otro valor. Elige cuáles reemplazar con lo de la INE:" : "Lo que trae la INE junto a lo que tiene el cliente:"}</p>
      )}
      {vista.avisos && vista.avisos.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-aviso">{vista.avisos.map((a) => <li key={a}>{a}</li>)}</ul>}
      {!vista.curpDistinta && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[440px] text-left text-xs">
            <thead><tr className="text-ink-muted"><th className="py-1 pr-2">Pasar</th><th className="py-1 pr-2">Dato</th><th className="py-1 pr-2">En la INE</th><th className="py-1">En el cliente</th></tr></thead>
            <tbody className="divide-y divide-borde">
              {(vista.llenados ? pendientes : vista.campos!).map((c) => (
                <tr key={c.clave} className={c.cambia ? "" : "text-ink-muted"}>
                  <td className="py-1.5 pr-2">
                    <input type="checkbox" aria-label={`Pasar ${c.etiqueta}`} className="size-4" disabled={!c.cambia || (c.clave === "curp" && c.caso !== "—")}
                      checked={elegidos.includes(c.clave)} onChange={(e) => marcar(c.clave, e.target.checked)} />
                  </td>
                  <td className="py-1.5 pr-2 font-medium text-ink">{c.etiqueta}</td>
                  <td className="py-1.5 pr-2 text-ink">{c.ine}</td>
                  <td className="py-1.5">{c.caso}{!c.cambia && " ✓"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-ink-muted">Revisa contra la credencial antes de pasar. Una CURP ya capturada no se reemplaza aquí: se corrige en Datos del cliente.</p>
        </div>
      )}
      {resultado.error && <p role="alert" className="mt-2 text-xs text-critico">{resultado.error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {!vista.curpDistinta && (
          <button type="button" onClick={pasar} disabled={cargando || elegidos.length === 0}
            className="inline-flex h-11 items-center rounded-[var(--radius-boton)] bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 md:h-9">
            {cargando ? "Pasando…" : `Pasar al cliente (${elegidos.length})`}
          </button>
        )}
        <button type="button" onClick={() => setVista(null)} className="inline-flex h-11 items-center px-3 text-sm text-ink-muted hover:text-ink md:h-9">
          {vista.llenados ? "Dejar como está" : "Cerrar"}
        </button>
      </div>
    </div>
  );
}
