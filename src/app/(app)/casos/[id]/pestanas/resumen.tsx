import { CalendarCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatoFecha, isoDe } from "@/components/rpd/insignia-dia46";
import type { Sesion } from "@/lib/auth/sesion";
import { fotoDelCaso } from "@/lib/casos/foto";
import { conUsuario } from "@/lib/db/prisma";
import { parametrosFechas } from "@/lib/parametros";
import type { CasoDetalle } from "@/lib/prospectos/consultas";
import { ORIGENES } from "@/lib/prospectos/validacion";
import { fechaProximoRetiro } from "@/lib/reglas/alertas";
import { movimientosPosibles, NOMBRE_ETAPA } from "@/lib/reglas/etapas";
import { diasEntre, sumarDias } from "@/lib/reglas/fechas";
import { hoyCDMX } from "@/lib/tiempo";
import { asignarAsesor } from "../acciones-asignacion";
import { CambiarEtapa } from "../cambiar-etapa";
import { Dato, isoODefecto, numero, Seleccion } from "../campos";
import { FormularioAccion } from "../formulario-accion";
import { ProximoRetiro } from "./dinero";

const ETIQUETA_ORIGEN = Object.fromEntries(ORIGENES) as Record<string, string>;
const fechaHora = (d: Date) => new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" }).format(d);
const largo = (iso: string | null) => (iso ? formatoFecha(iso, { dateStyle: "long" }) : "—");

export async function PestanaResumen({ caso, sesion }: { caso: CasoDetalle; sesion: Sesion }) {
  const hoy = hoyCDMX();
  const p = await parametrosFechas(hoy);
  const puedeAsignar = sesion.usuario.rol === "director" || sesion.usuario.rol === "asesor";
  const [r, asesores, primerPago] = await conUsuario(sesion.claims, (tx) => Promise.all([
    fotoDelCaso(tx, caso.id, hoy, p),
    puedeAsignar
      ? tx.usuario.findMany({ where: { activo: true, archivado_at: null, rol: { in: ["asesor", "director"] } }, select: { id: true, nombre: true, rol: true }, orderBy: { nombre: "asc" } })
      : Promise.resolve([]),
    // El vendedor no ve pagos (RLS): para él no hay leyenda.
    tx.pagoAfore.findFirst({ where: { caso_id: caso.id, archivado_at: null }, orderBy: { numero: "asc" }, select: { fecha_deposito: true } }),
  ]), sesion.ip);
  const deposito = isoDe(primerPago?.fecha_deposito);
  if (!r) return null;
  const { foto } = r;
  const opciones = movimientosPosibles(foto, sesion.usuario.rol).map((m) => ({ ...m, nombre: NOMBRE_ETAPA[m.destino] }));
  const esRetiro = caso.servicio.clave === "RETIRO_DESEMPLEO";
  const { dia46, candado } = foto;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {esRetiro && deposito && (
        <div className="lg:col-span-3"><ProximoRetiro fecha={fechaProximoRetiro(deposito, p)} anios={p.ANIOS_CANDADO_RETIRO} deposito={deposito} /></div>
      )}
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
            {dia46 && p.DIAS_ADMINISTRATIVOS > 0 && (() => {
              const tramite = sumarDias(dia46.fecha, p.DIAS_ADMINISTRATIVOS);
              const faltan = Math.max(0, diasEntre(hoy, tramite));
              return (
                <div className={`mt-4 w-full rounded-[var(--radius-boton)] px-3 py-2 text-sm ${faltan === 0 ? "bg-exito-tint text-exito-texto" : "bg-brand-tint text-brand"}`}>
                  <p className="font-medium">{faltan === 0 ? "Listo para ingresar el trámite" : `Trámite en ${faltan} ${faltan === 1 ? "día" : "días"}: ${largo(tramite)}`}</p>
                  <p className="text-xs opacity-80">Día {p.DIAS_ESPERA_DESEMPLEO} + {p.DIAS_ADMINISTRATIVOS} días administrativos</p>
                </div>
              );
            })()}
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
        <CardHeader><CardTitle>Analista que lleva el expediente</CardTitle><span className="text-sm text-ink-muted">{caso.asignado?.nombre ?? "Bandeja general"}</span></CardHeader>
        <CardContent>
          {puedeAsignar ? (
            <FormularioAccion accion={asignarAsesor.bind(null, caso.id)} boton="Guardar analista" etiquetas={{ asignado_a: "Analista" }}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Seleccion id="asignado_a" etiqueta="Analista de expedientes" valor={caso.asignado_a} vacia="Sin asignar (bandeja general)"
                  opciones={asesores.map((u) => [u.id, u.rol === "director" ? `${u.nombre} (Director)` : u.nombre] as const)} />
              </div>
              <p className="text-xs text-ink-muted">El analista ve el caso, recibe sus alertas y aparece en el tablero. ¿Falta alguien? Créale cuenta como «Analista de expedientes» en Configuración → Usuarios.</p>
            </FormularioAccion>
          ) : (
            <p className="text-sm text-ink">{caso.asignado?.nombre ?? "Todavía sin analista"}</p>
          )}
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
            <Dato titulo="Asesor de pensiones · referidor" valor={`${caso.socio?.nombre ?? "—"} · ${caso.referidor?.nombre ?? "—"}`} />
            {caso.socio && caso.socio_asignado_at && <Dato titulo="Asignado al asesor el" valor={fechaHora(caso.socio_asignado_at)} />}
          </dl>
          <p className="mt-4 text-xs text-ink-muted">Todas las fechas y montos son estimados hasta que se verifican con los documentos y la Afore paga.</p>
        </CardContent>
      </Card>
    </div>
  );
}
