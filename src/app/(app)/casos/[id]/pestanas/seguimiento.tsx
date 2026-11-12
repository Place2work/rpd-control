import { MessageCircle, ShieldAlert } from "lucide-react";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { SEVERIDADES, TIPOS_INCIDENCIA } from "@/lib/academia/incidencias";
import { registrarIncidencia } from "../../../academia/acciones";
import { CampoTexto, Seleccion } from "../campos";
import { FormularioAccion } from "../formulario-accion";
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

export async function PestanaSeguimiento({ caso, sesion, usuario }: { caso: CasoDetalle; sesion: Sesion; usuario: { id: string; rol: string } }) {
  // Incidencia de capacitación (CAPACITACION.md 9.5): la registran el Director o el analista sobre el asesor de pensiones.
  const evaluador = usuario.rol === "director" || usuario.rol === "asesor";
  const asesores = evaluador ? await conUsuario(sesion.claims, (tx) => tx.usuario.findMany({
    where: { rol: "socio", activo: true, archivado_at: null }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, socio_id: true } }), sesion.ip) : [];
  const delCaso = asesores.find((a) => a.socio_id && a.socio_id === caso.socio_id);
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
      <div className="grid content-start gap-4">
        <Card>
          <CardHeader><CardTitle>Nota rápida</CardTitle></CardHeader>
          <CardContent><NotaRapida casoId={caso.id} /></CardContent>
        </Card>
        {asesores.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="size-5 text-critico" aria-hidden /> Incidencia del asesor</CardTitle></CardHeader>
            <CardContent>
              <details>
                <summary className="cursor-pointer text-sm text-brand">Registrar una incidencia de capacitación</summary>
                <div className="mt-3">
                  <FormularioAccion accion={registrarIncidencia.bind(null, caso.id)} boton="Registrar" limpiar
                    etiquetas={{ usuario_id: "Asesor de pensiones", tipo: "Tipo", severidad: "Severidad", descripcion: "Qué pasó" }}
                    confirmar="¿Registrar la incidencia? Si es de línea roja, sus certificaciones se suspenden al momento y se avisa al Director.">
                    <Seleccion id="usuario_id" etiqueta="Asesor de pensiones" vacia="Elige…" valor={delCaso?.id} opciones={asesores.map((a) => [a.id, a.nombre] as const)} />
                    <Seleccion id="tipo" etiqueta="Tipo" vacia="Elige…" opciones={TIPOS_INCIDENCIA} />
                    <Seleccion id="severidad" etiqueta="Severidad" vacia="Elige…" opciones={SEVERIDADES} />
                    <CampoTexto id="descripcion" etiqueta="Qué pasó" />
                  </FormularioAccion>
                </div>
              </details>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
