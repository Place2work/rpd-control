"use client";

// «Leer constancia»: muestra lo que trae el PDF junto a lo que tiene el caso; se eligen los datos a pasar.
// Con `auto` (recién subida), se lee sola al abrir: llena lo vacío y solo pregunta por lo que ya tenía otro valor.
import { CheckCircle2, FileSearch, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { aplicarConstancia, autoConstancia, verConstancia, type VistaConstancia } from "./acciones-constancia";

const IDENTIDAD = {
  coincide: { texto: "coincide con el cliente", clase: "text-exito-texto" },
  distinto: { texto: "NO es la del cliente", clase: "font-semibold text-critico" },
  sin_dato: { texto: "el cliente no lo tiene capturado", clase: "text-aviso" },
  no_viene: { texto: "no viene en el PDF", clase: "text-ink-muted" },
} as const;

export function LectorConstancia({ casoId, documentoId, auto = false }: { casoId: string; documentoId: string; auto?: boolean }) {
  const router = useRouter();
  const [vista, setVista] = useState<VistaConstancia | null>(null);
  const [llenados, setLlenados] = useState<string[] | null>(null);
  const yaCorrio = useRef(false);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [resultado, setResultado] = useState<{ ok?: boolean; error?: string }>({});
  const [cargando, iniciar] = useTransition();

  const abrir = () => iniciar(async () => {
    setResultado({});
    const v = await verConstancia(casoId, documentoId);
    setVista(v);
    const extra = [v.identidad?.nss === "sin_dato" ? "guardar_nss" : null, v.identidad?.curp === "sin_dato" ? "guardar_curp" : null].filter((x): x is string => Boolean(x));
    setElegidos([...(v.campos ?? []).filter((c) => c.cambia && !c.noMarcar).map((c) => c.clave), ...extra]);
  });
  const pasar = () => iniciar(async () => {
    const r = await aplicarConstancia(casoId, documentoId, elegidos);
    setResultado(r);
    if (r.ok) { setVista(null); setLlenados(null); router.refresh(); }
  });
  useEffect(() => {
    if (!auto || yaCorrio.current) return;
    yaCorrio.current = true;
    iniciar(async () => {
      const v = await autoConstancia(casoId, documentoId);
      const sin = (x: string | undefined) => (x === "sin_dato" ? "coincide" : x);
      if (v.error) { setVista(v); return; }
      setLlenados(v.llenados ?? []);
      if (v.identidad) v.identidad = { nss: sin(v.identidad.nss) as never, curp: sin(v.identidad.curp) as never };
      const bloq = v.identidad?.nss === "distinto" || v.identidad?.curp === "distinto";
      if (v.campos?.length || bloq) { setVista(v); setElegidos(v.campos!.filter((c) => !c.noMarcar).map((c) => c.clave)); }
      router.refresh();
    });
  }, [auto, casoId, documentoId, router]);
  const avisoAuto = llenados && (
    <p role="status" className="flex items-center gap-1 text-xs text-exito-texto">
      <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
      {llenados.length ? `Constancia leída: ${llenados.length === 1 ? "se llenó 1 dato vacío" : `se llenaron ${llenados.length} datos vacíos`} (${llenados.join(", ").toLowerCase()}).` : "Constancia leída: no había datos vacíos que llenar."}
    </p>
  );
  const marcar = (clave: string, si: boolean) => setElegidos((e) => (si ? [...new Set([...e, clave])] : e.filter((x) => x !== clave)));

  if (!vista) {
    return (
      <div className="flex flex-col gap-1 md:items-end">
        <button type="button" onClick={abrir} disabled={cargando}
          className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-boton)] bg-brand px-3 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 md:h-9">
          <FileSearch className="size-4" aria-hidden /> {cargando ? "Leyendo…" : "Leer constancia"}
        </button>
        {avisoAuto}
        {resultado.ok && <p role="status" className="flex items-center gap-1 text-xs text-exito-texto"><CheckCircle2 className="size-3.5" aria-hidden /> Datos pasados a IMSS y Afore</p>}
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
  const l = vista.lectura!, id = vista.identidad!;
  const bloqueado = id.nss === "distinto" || id.curp === "distinto";
  return (
    <div className="w-full rounded-[var(--radius-boton)] border border-borde bg-slate-50 p-4 text-sm md:col-span-2">
      {avisoAuto}
      {llenados && !bloqueado && <p className="mt-1 text-xs font-medium text-ink">Estos datos ya tenían otro valor en el caso. Elige cuáles reemplazar:</p>}
      <p className="mt-2 font-medium text-ink">Lo que trae la constancia{l.nombre ? ` de ${l.nombre}` : ""}{l.folio ? <span className="font-normal text-ink-muted"> · folio {l.folio}</span> : null}</p>
      <ul className="mt-2 grid gap-1 text-xs">
        <li>NSS ···{l.nssFin ?? "—"}: <span className={IDENTIDAD[id.nss].clase}>{IDENTIDAD[id.nss].texto}</span></li>
        <li>CURP {l.curpParcial ?? "—"}: <span className={IDENTIDAD[id.curp].clase}>{IDENTIDAD[id.curp].texto}</span></li>
        {l.regimen && <li>Régimen: <span className="font-semibold text-ink">{l.regimen === "L73" ? "Ley 73" : "Ley 97"}</span> <span className="text-ink-muted">(primera alta {l.primeraAlta?.split("-").reverse().join("/")}; Ley 73 si es antes del 1/07/1997)</span></li>}
        <li className="text-ink-muted">{l.patrones.length} {l.patrones.length === 1 ? "patrón" : "patrones"} en la historia laboral · total {l.total ?? "—"} semanas</li>
      </ul>
      {bloqueado && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-md bg-critico-tint p-2 text-xs text-critico">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> Esta constancia es de otra persona. No se pasa nada; revisa que hayas subido el documento correcto.
        </p>
      )}
      {l.avisos.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-aviso">{l.avisos.map((a) => <li key={a}>{a}</li>)}</ul>}
      {!bloqueado && (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead><tr className="text-ink-muted"><th className="py-1 pr-2">Pasar</th><th className="py-1 pr-2">Dato</th><th className="py-1 pr-2">En la constancia</th><th className="py-1">En el caso</th></tr></thead>
              <tbody className="divide-y divide-borde">
                {vista.campos!.map((c) => (
                  <tr key={c.clave} className={c.cambia ? "" : "text-ink-muted"}>
                    <td className="py-1.5 pr-2"><input type="checkbox" aria-label={`Pasar ${c.etiqueta}`} className="size-4" checked={elegidos.includes(c.clave)} onChange={(e) => marcar(c.clave, e.target.checked)} /></td>
                    <td className="py-1.5 pr-2 font-medium text-ink">{c.etiqueta}</td>
                    <td className="cifra py-1.5 pr-2 text-ink">{c.constancia}</td>
                    <td className="cifra py-1.5">{c.caso}{!c.cambia && " ✓"}{c.noMarcar && <span className="block text-[11px] text-aviso">se cambió a mano con justificación</span>}</td>
                  </tr>
                ))}
                {id.nss === "sin_dato" && (
                  <tr><td className="py-1.5 pr-2"><input type="checkbox" aria-label="Guardar NSS" className="size-4" checked={elegidos.includes("guardar_nss")} onChange={(e) => marcar("guardar_nss", e.target.checked)} /></td>
                    <td className="py-1.5 pr-2 font-medium text-ink" colSpan={3}>Guardar el NSS en los datos del cliente (cifrado)</td></tr>
                )}
                {id.curp === "sin_dato" && (
                  <tr><td className="py-1.5 pr-2"><input type="checkbox" aria-label="Guardar CURP" className="size-4" checked={elegidos.includes("guardar_curp")} onChange={(e) => marcar("guardar_curp", e.target.checked)} /></td>
                    <td className="py-1.5 pr-2 font-medium text-ink" colSpan={3}>Guardar la CURP en los datos del cliente (cifrada)</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-muted">Ya vienen marcados los datos que cambian. Revisa antes de pasar; puedes corregir después en IMSS y Afore.</p>
        </>
      )}
      {resultado.error && <p role="alert" className="mt-2 text-xs text-critico">{resultado.error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {!bloqueado && (
          <button type="button" onClick={pasar} disabled={cargando || elegidos.length === 0}
            className="inline-flex h-11 items-center rounded-[var(--radius-boton)] bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 md:h-9">
            {cargando ? "Pasando…" : `Pasar a IMSS y Afore (${elegidos.length})`}
          </button>
        )}
        <button type="button" onClick={() => setVista(null)} className="inline-flex h-11 items-center px-3 text-sm text-ink-muted hover:text-ink md:h-9">Cerrar</button>
      </div>
    </div>
  );
}
