import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { cn } from "@/lib/utils";

const ACCION: Record<string, string> = { INSERT: "Alta", UPDATE: "Cambio", ARCHIVE: "Archivo", DELETE: "Borrado", VER_SENSIBLE: "Vio dato completo" };
const FILTROS = [["", "Todo"], ["VER_SENSIBLE", "Datos sensibles"], ["resaltado", "Montos y semanas"], ["usuarios", "Usuarios"], ["parametros", "Parámetros"], ["comisiones", "Comisiones"]] as const;

export async function SeccionBitacora({ sesion, filtro }: { sesion: Sesion; filtro: string }) {
  const where = filtro === "VER_SENSIBLE" ? { accion: "VER_SENSIBLE" } : filtro === "resaltado" ? { resaltado: true } : filtro ? { tabla: filtro } : {};
  const { filas, nombres } = await conUsuario(sesion.claims, async (tx) => ({
    filas: await tx.auditoria.findMany({ where, orderBy: { fecha: "desc" }, take: 150 }),
    nombres: new Map((await tx.usuario.findMany({ select: { id: true, nombre: true } })).map((u) => [u.id, u.nombre])),
  }), sesion.ip);
  const hora = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bitácora</CardTitle>
        <nav aria-label="Filtro" className="flex flex-wrap gap-1">
          {FILTROS.map(([k, t]) => (
            <Link key={k} href={`/configuracion?seccion=bitacora${k ? `&filtro=${k}` : ""}`}
              className={cn("rounded-[var(--radius-boton)] px-2 py-1 text-xs", filtro === k ? "bg-brand-tint font-medium text-brand" : "text-ink-muted hover:text-ink")}>{t}</Link>
          ))}
        </nav>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-ink-muted">Últimos 150 movimientos. Nadie puede editarla ni borrarla.</p>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-xs text-ink-muted">{["Fecha", "Quién", "Qué", "Dónde", "Campos"].map((t) => <th key={t} className="pb-2 pr-3 font-medium">{t}</th>)}</tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={String(f.id)} className="border-t border-borde align-top">
                  <td className="whitespace-nowrap py-2 pr-3 text-xs">{hora.format(f.fecha)}</td>
                  <td className="py-2 pr-3">{f.usuario_id ? nombres.get(f.usuario_id) ?? "Usuario" : "Sistema"}</td>
                  <td className="py-2 pr-3">
                    <Badge tono={f.accion === "VER_SENSIBLE" ? "espera" : f.resaltado ? "critico" : "prospecto"}>{ACCION[f.accion] ?? f.accion}</Badge>
                  </td>
                  <td className="py-2 pr-3 text-xs"><span className="font-mono">{f.tabla}</span>{f.campo ? ` · ${f.campo}` : ""}</td>
                  <td className="py-2 text-xs text-ink-muted">{f.campos_cambiados.filter((c) => !["updated_at", "updated_by"].includes(c)).slice(0, 6).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
