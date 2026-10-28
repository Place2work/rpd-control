import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatoFecha, isoDe } from "@/components/rpd/insignia-dia46";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import type { CasoDetalle } from "@/lib/prospectos/consultas";
import { diasEntre } from "@/lib/reglas/fechas";
import { parametrosFechas } from "@/lib/parametros";
import { hoyCDMX } from "@/lib/tiempo";
import { Dato } from "../campos";

const largo = (d: Date | null | undefined) => (d ? formatoFecha(isoDe(d)!, { dateStyle: "long" }) : "—");

// Consulta del contrato (vigencia y suspensiones). La generación del PDF desde plantilla es de la fase 4.
export async function PestanaContrato({ caso, sesion }: { caso: CasoDetalle; sesion: Sesion }) {
  const hoy = hoyCDMX();
  const suspensiones = await conUsuario(sesion.claims,
    (tx) => tx.suspensionContrato.findMany({ where: { caso_id: caso.id, archivado_at: null }, orderBy: { inicio: "desc" } }), sesion.ip)
    .catch(() => []);
  const { VIGENCIA_CONTRATO_DIAS: vigencia } = await parametrosFechas(hoy);
  const vence = isoDe(caso.fecha_vencimiento_contrato);
  const restantes = vence ? diasEntre(hoy, vence) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Contrato {caso.folio}</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          {!caso.fecha_contrato ? (
            <p className="text-sm text-ink-muted">Aún no se firma. La fecha de firma se captura en Resumen → Siguiente paso → «Contrato firmado».</p>
          ) : (
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Dato titulo="Número de contrato (folio)" valor={caso.folio} />
              <Dato titulo="Fecha de firma" valor={largo(caso.fecha_contrato)} />
              <Dato titulo="Vence" valor={vence ? `${largo(caso.fecha_vencimiento_contrato)}${restantes !== null ? (restantes >= 0 ? ` · faltan ${restantes} días` : ` · venció hace ${-restantes} días`) : ""}` : "—"} />
              <Dato titulo="Días suspendidos por causa del cliente" valor={String(caso.dias_suspendidos)} />
              {caso.honorario_fijo && <Dato titulo="Honorario fijo (IVA incluido)" valor={`$${Number(caso.honorario_fijo).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`} />}
              {caso.analisis_impacto_texto && <Dato titulo="Análisis de impacto (Ley 73)" valor={caso.analisis_impacto_texto} />}
            </dl>
          )}
          <p className="rounded-md bg-slate-50 p-3 text-xs text-ink-muted">
            La vigencia es de {vigencia} días naturales desde la firma, más los días que el caso estuvo bloqueado por causa del cliente (2.4).
            Generar el contrato en PDF desde la plantilla llega en la fase 4.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Suspensiones</CardTitle></CardHeader>
        <CardContent>
          {suspensiones.length === 0 ? (
            <p className="text-sm text-ink-muted">Sin suspensiones.</p>
          ) : (
            <ul className="grid gap-3 text-sm">
              {suspensiones.map((s) => (
                <li key={s.id}>
                  <p className="text-ink">{largo(s.inicio)} → {s.fin ? largo(s.fin) : "sigue abierta"}</p>
                  <p className="text-xs text-ink-muted">{s.motivo}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
