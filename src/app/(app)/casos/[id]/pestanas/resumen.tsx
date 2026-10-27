import { CalendarCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatoFecha, isoDe } from "@/components/rpd/insignia-dia46";
import type { Sesion } from "@/lib/auth/sesion";
import { fotoDelCaso } from "@/lib/casos/foto";
import { conUsuario } from "@/lib/db/prisma";
import { parametrosFechas } from "@/lib/parametros";
import type { CasoDetalle } from "@/lib/prospectos/consultas";
import { ORIGENES } from "@/lib/prospectos/validacion";
import { movimientosPosibles, NOMBRE_ETAPA } from "@/lib/reglas/etapas";
import { hoyCDMX } from "@/lib/tiempo";
import { CambiarEtapa } from "../cambiar-etapa";
import { Dato, isoODefecto, numero } from "../campos";

const ETIQUETA_ORIGEN = Object.fromEntries(ORIGENES) as Record<string, string>;
const largo = (iso: string | null) => (iso ? formatoFecha(iso, { dateStyle: "long" }) : "—");

export async function PestanaResumen({ caso, sesion }: { caso: CasoDetalle; sesion: Sesion }) {
  const hoy = hoyCDMX();
  const p = await parametrosFechas(hoy);
  const r = await conUsuario(sesion.claims, (tx) => fotoDelCaso(tx, caso.id, hoy, p), sesion.ip);
  if (!r) return null;
  const { foto } = r;
  const opciones = movimientosPosibles(foto, sesion.usuario.rol).map((m) => ({ ...m, nombre: NOMBRE_ETAPA[m.destino] }));
  const esRetiro = caso.servicio.clave === "RETIRO_DESEMPLEO";
  const { dia46, candado } = foto;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {esRetiro && (
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-8 text-center">
            {!dia46 ? (
              <>
                <p className="font-display text-lg font-semibold text-ink">Falta la fecha de baja</p>
                <p className="text-sm text-ink-muted">Captúrala en «IMSS y Afore» para calcular el día {p.DIAS_ESPERA_DESEMPLEO}.</p>
              </>
            ) : dia46.yaPuede ? (
              <>
                <CalendarCheck className="size-10 text-exito" aria-hidden />
                <p className="font-display text-[28px] font-semibold text-exito-texto">Ya puede retirar</p>
                <p className="text-sm text-ink-muted">Desde el {largo(dia46.fecha)}</p>
              </>
            ) : (
              <>
                <p className="cifra font-display text-[56px] font-semibold leading-none text-ink">{dia46.diasFaltan}</p>
                <p className="text-sm text-ink-muted">{dia46.diasFaltan === 1 ? "día" : "días"} para poder retirar</p>
                <p className="mt-2 text-sm font-medium text-ink">{formatoFecha(dia46.fecha, { dateStyle: "full" })}</p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card className={esRetiro ? "lg:col-span-2" : "lg:col-span-3"}>
        <CardHeader><CardTitle>Siguiente paso</CardTitle></CardHeader>
        <CardContent>
          <CambiarEtapa casoId={caso.id} opciones={opciones} esLey73={foto.regimen === "L73"} embudo={foto.embudo} hoy={hoy}
            valores={{
              fecha_contrato: isoODefecto(caso.fecha_contrato),
              fecha_ingreso_solicitud: isoODefecto(caso.fecha_ingreso_solicitud),
              acuse_afore: caso.acuse_afore ?? "",
              fecha_resolucion: isoODefecto(caso.fecha_resolucion),
              honorario_fijo: numero(caso.honorario_fijo),
            }} />
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader><CardTitle>Fechas clave</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Dato titulo="Primer contacto" valor={largo(isoDe(caso.fecha_primer_contacto))} />
            <Dato titulo="Fecha de baja" valor={largo(isoDe(caso.datos_imss?.fecha_baja)) === "—" ? "Sin capturar" : largo(isoDe(caso.datos_imss?.fecha_baja))} />
            {esRetiro && (
              <Dato titulo="Candado de 5 años (art. 191-II)" valor={
                candado.estado === "por_verificar" ? "Por verificar en el estado de cuenta Afore"
                  : candado.estado === "libre" ? "Libre: nunca ha retirado"
                  : candado.estado === "vencido" ? `Libre desde el ${largo(candado.fecha)}`
                  : `Bloqueado hasta el ${largo(candado.fecha)}`} />
            )}
            <Dato titulo="Firma del contrato" valor={largo(isoDe(caso.fecha_contrato))} />
            <Dato titulo="Vence el contrato" valor={caso.fecha_vencimiento_contrato
              ? `${largo(isoDe(caso.fecha_vencimiento_contrato))}${caso.dias_suspendidos ? ` (incluye ${caso.dias_suspendidos} días suspendidos)` : ""}` : "—"} />
            <Dato titulo="Ingreso a la Afore" valor={caso.fecha_ingreso_solicitud ? `${largo(isoDe(caso.fecha_ingreso_solicitud))} · acuse ${caso.acuse_afore ?? "—"}` : "—"} />
            <Dato titulo="Límite de resolución de la Afore" valor={largo(isoDe(caso.fecha_limite_resolucion))} />
            <Dato titulo="Origen" valor={ETIQUETA_ORIGEN[caso.persona.origen] ?? caso.persona.origen} />
            <Dato titulo="Vendedor · referidor" valor={`${caso.vendedor?.nombre ?? "—"} · ${caso.referidor?.nombre ?? "—"}`} />
          </dl>
          <p className="mt-4 text-xs text-ink-muted">Todas las fechas y montos son estimados hasta que se verifican con los documentos y la Afore paga.</p>
        </CardContent>
      </Card>
    </div>
  );
}
