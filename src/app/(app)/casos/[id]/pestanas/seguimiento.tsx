import { MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoVacio } from "@/components/rpd/estado-vacio";
import type { CasoDetalle } from "@/lib/prospectos/consultas";
import { NotaRapida } from "../nota-rapida";
import { BotonAccion } from "../../../configuracion/boton-accion";
import { eliminarNota } from "../acciones";

const TIPO: Record<string, string> = {
  nota: "Nota", llamada: "Llamada", whatsapp: "WhatsApp", correo: "Correo", cambio_etapa: "Cambio de etapa",
  documento: "Documento", pago: "Pago", sistema: "Sistema",
};

const NOTAS = new Set(["nota", "llamada", "whatsapp", "correo"]);

export function PestanaSeguimiento({ caso, usuario }: { caso: CasoDetalle; usuario: { id: string; rol: string } }) {
  const puedeEliminar = (e: CasoDetalle["eventos"][number]) => NOTAS.has(e.tipo) && (usuario.rol === "director" || e.usuario_id === usuario.id);
  const cuando = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" });
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Línea de tiempo</CardTitle></CardHeader>
        {caso.eventos.length === 0 ? (
          <EstadoVacio icono={MessageCircle} titulo="Sin movimientos" texto="Registra la primera llamada o mensaje." />
        ) : (
          <CardContent>
            <ol className="relative flex flex-col gap-4 border-l border-borde pl-5">
              {caso.eventos.map((e) => (
                <li key={e.id} className="relative">
                  <span className={`absolute -left-[25px] top-1.5 size-2.5 rounded-full ${e.tipo === "cambio_etapa" ? "bg-exito" : "bg-brand"}`} aria-hidden />
                  <p className="text-sm text-ink">{e.texto}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-xs text-ink-muted">{cuando.format(e.fecha)} · {TIPO[e.tipo] ?? e.tipo} · {e.usuario?.nombre ?? "Sistema"}</p>
                    {puedeEliminar(e) && (
                      <BotonAccion accion={eliminarNota.bind(null, caso.id, e.id)} texto="Eliminar" variante="fantasma"
                        confirmar={`¿Eliminar esta nota?\n\n«${e.texto.slice(0, 120)}»\n\nDeja de verse en el seguimiento.`} />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        )}
      </Card>
      <Card>
        <CardHeader><CardTitle>Nota rápida</CardTitle></CardHeader>
        <CardContent><NotaRapida casoId={caso.id} /></CardContent>
      </Card>
    </div>
  );
}
