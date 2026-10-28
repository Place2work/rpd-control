import { FileCheck2, FileClock, FileWarning, FileX2, FileUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatoFecha, isoDe } from "@/components/rpd/insignia-dia46";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { estadoVisible, type EstadoVisible } from "@/lib/documentos/reglas";
import type { CasoDetalle } from "@/lib/prospectos/consultas";
import { hoyCDMX } from "@/lib/tiempo";
import { RevisarDocumento } from "../revisar-documento";
import { SubirDocumento } from "../subir-documento";

const ESTADO: Record<EstadoVisible, { texto: string; tono: "prospecto" | "tramite" | "pagado" | "critico" | "espera"; icono: typeof FileUp }> = {
  pendiente: { texto: "Pendiente", tono: "prospecto", icono: FileUp },
  recibido: { texto: "Por revisar", tono: "tramite", icono: FileClock },
  validado: { texto: "Validado", tono: "pagado", icono: FileCheck2 },
  rechazado: { texto: "Rechazado", tono: "critico", icono: FileX2 },
  vencido: { texto: "Vencido", tono: "espera", icono: FileWarning },
};

export async function PestanaDocumentos({ caso, sesion }: { caso: CasoDetalle; sesion: Sesion }) {
  if (sesion.usuario.rol === "vendedor") {
    return <Card><CardContent className="text-sm text-ink-muted">El expediente lo opera el asesor; tu rol no ve los documentos.</CardContent></Card>;
  }
  const hoy = hoyCDMX();
  const { tipos, docs } = await conUsuario(sesion.claims, async (tx) => ({
    tipos: await tx.tipoDocumentoServicio.findMany({
      where: { tipo_servicio: caso.tipo_servicio, tipo_documento: { activo: true } },
      include: { tipo_documento: true },
      orderBy: { tipo_documento: { orden: "asc" } },
    }),
    docs: await tx.documento.findMany({ where: { caso_id: caso.id, archivado_at: null }, orderBy: { created_at: "desc" } }),
  }), sesion.ip);

  const filas = tipos.map(({ tipo_documento: t, obligatorio }) => {
    const ultimo = docs.find((d) => d.tipo_id === t.id);
    const estado = ultimo ? estadoVisible(ultimo.estado, isoDe(ultimo.fecha_vencimiento), hoy) : "pendiente";
    return { t, obligatorio: obligatorio && t.obligatorio, ultimo, estado, versiones: docs.filter((d) => d.tipo_id === t.id).length };
  });
  const obligatorios = filas.filter((f) => f.obligatorio);
  const listos = obligatorios.filter((f) => f.estado === "validado").length;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Expediente</CardTitle>
          <span className="cifra text-sm text-ink-muted">{listos} de {obligatorios.length} obligatorios validados</span>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={obligatorios.length} aria-valuenow={listos}
            aria-label="Documentos obligatorios validados">
            <div className="h-full rounded-full bg-exito" style={{ width: `${obligatorios.length ? (listos / obligatorios.length) * 100 : 0}%` }} />
          </div>
          {caso.fecha_expediente_completo ? (
            <p className="mt-2 text-sm text-exito-texto">
              Completo desde el {formatoFecha(isoDe(caso.fecha_expediente_completo)!, { dateStyle: "long" })}.
              {caso.fecha_limite_ingreso && ` Ingresar a la Afore a más tardar el ${formatoFecha(isoDe(caso.fecha_limite_ingreso)!, { dateStyle: "long" })}.`}
            </p>
          ) : (
            <p className="mt-2 text-xs text-ink-muted">Fotos a color, mínimo 256 KB, sin tachaduras. Al validar el último obligatorio arrancan los 15 días hábiles para ingresar.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <ul className="divide-y divide-borde">
          {filas.map(({ t, obligatorio, ultimo, estado, versiones }) => {
            const e = ESTADO[estado];
            return (
              <li key={t.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto] md:items-start">
                <div className="flex min-w-0 gap-3">
                  <e.icono className="mt-0.5 size-5 shrink-0 text-ink-muted" strokeWidth={1.5} aria-hidden />
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {t.nombre} {!obligatorio && <span className="text-xs font-normal text-ink-muted">· opcional</span>}
                      {t.requiere_original && <span className="text-xs font-normal text-ink-muted"> · se entrega en original</span>}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                      <Badge tono={e.tono}>{e.texto}</Badge>
                      {ultimo?.fecha_vencimiento && <span>Vence {formatoFecha(isoDe(ultimo.fecha_vencimiento)!)}</span>}
                      {t.vigencia_dias && !ultimo && <span>Vigencia de {t.vigencia_dias} días desde su emisión</span>}
                      {versiones > 1 && <span>{versiones} versiones</span>}
                    </div>
                    {estado === "rechazado" && ultimo?.motivo_rechazo && <p className="mt-1 text-sm text-critico">Motivo: {ultimo.motivo_rechazo}</p>}
                  </div>
                </div>
                <div className="flex flex-col gap-2 md:items-end">
                  {ultimo?.archivo_path && (
                    <RevisarDocumento casoId={caso.id} documentoId={ultimo.id} puedeValidar={estado === "recibido"} />
                  )}
                  {estado !== "validado" && estado !== "recibido" && (
                    <SubirDocumento casoId={caso.id} tipoId={t.id} pideEmision={Boolean(t.vigencia_dias)} hoy={hoy}
                      textoBoton={ultimo ? "Subir otra versión" : "Subir"} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
