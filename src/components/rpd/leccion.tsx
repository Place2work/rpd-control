// Lección de la Academia: bloques de Markdown a elementos de React (sin HTML inyectado), con la marca:
// «Lo que dices» en azul y «Lo que nunca dices» en rojo (CAPACITACION.md 12.1).
import { MessageCircle, ShieldAlert } from "lucide-react";
import type { Bloque, Linea } from "@/lib/academia/markdown";
import { cn } from "@/lib/utils";

function EnLinea({ l }: { l: Linea }) {
  return (
    <>
      {l.map((p, i) => p.tipo === "negrita" ? <strong key={i} className="font-semibold text-ink">{p.texto}</strong>
        : p.tipo === "cursiva" ? <em key={i}>{p.texto}</em>
        : p.tipo === "codigo" ? <code key={i} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-ink">{p.texto}</code>
        : <span key={i}>{p.texto}</span>)}
    </>
  );
}

function Bloques({ bloques }: { bloques: Bloque[] }) {
  return (
    <>
      {bloques.map((b, i) => {
        switch (b.tipo) {
          case "titulo":
            return b.nivel <= 3
              ? <h2 key={i} className="mt-2 font-display text-lg font-semibold text-ink"><EnLinea l={b.texto} /></h2>
              : <h3 key={i} className="mt-1 font-display text-base font-semibold text-ink"><EnLinea l={b.texto} /></h3>;
          case "parrafo":
            return <p key={i} className="leading-relaxed"><EnLinea l={b.texto} /></p>;
          case "lista": {
            const Tag = b.ordenada ? "ol" : "ul";
            return (
              <Tag key={i} className={cn("grid gap-1.5 pl-5 leading-relaxed", b.ordenada ? "list-decimal" : "list-disc")}>
                {b.items.map((it, j) => <li key={j}><EnLinea l={it} /></li>)}
              </Tag>
            );
          }
          case "tabla":
            return (
              <div key={i} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                  <thead><tr className="border-b border-borde bg-slate-50">{b.encabezado.map((c, j) => <th key={j} className="px-3 py-2 font-medium text-ink"><EnLinea l={c} /></th>)}</tr></thead>
                  <tbody className="divide-y divide-borde">
                    {b.filas.map((f, j) => <tr key={j}>{f.map((c, k) => <td key={k} className="px-3 py-2 align-top"><EnLinea l={c} /></td>)}</tr>)}
                  </tbody>
                </table>
              </div>
            );
          case "cita":
            return <blockquote key={i} className="border-l-4 border-brand/40 bg-brand-tint/40 px-4 py-2 italic">{b.texto.map((l, j) => <p key={j}><EnLinea l={l} /></p>)}</blockquote>;
          case "codigo":
            return <pre key={i} className="overflow-x-auto rounded-md bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100">{b.texto}</pre>;
          case "separador":
            return <hr key={i} className="border-borde" />;
          case "recuadro":
            return (
              <div key={i} className={cn("grid gap-2 rounded-[var(--radius-tarjeta)] border-l-4 p-4",
                b.variante === "dices" ? "border-brand bg-brand-tint/60" : "border-critico bg-critico-tint")}>
                <p className={cn("flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide", b.variante === "dices" ? "text-brand" : "text-critico")}>
                  {b.variante === "dices" ? <MessageCircle className="size-4" aria-hidden /> : <ShieldAlert className="size-4" aria-hidden />}
                  {b.variante === "dices" ? "Lo que dices" : "Lo que nunca dices"}
                </p>
                <Bloques bloques={b.bloques} />
              </div>
            );
        }
      })}
    </>
  );
}

export function Leccion({ bloques }: { bloques: Bloque[] }) {
  return <div className="grid gap-4 text-[15px] text-ink-muted">{<Bloques bloques={bloques} />}</div>;
}
