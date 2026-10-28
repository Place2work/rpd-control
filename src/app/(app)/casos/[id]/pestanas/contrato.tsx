import { CircleAlert, CircleCheck, FileSignature, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatoFecha, isoDe } from "@/components/rpd/insignia-dia46";
import type { Sesion } from "@/lib/auth/sesion";
import { datosContrato, plantillaVigente, type Clase } from "@/lib/contratos/datos";
import { llenar } from "@/lib/contratos/plantilla";
import { conUsuario } from "@/lib/db/prisma";
import { parametrosFechas } from "@/lib/parametros";
import type { CasoDetalle } from "@/lib/prospectos/consultas";
import { diasEntre } from "@/lib/reglas/fechas";
import { hoyCDMX } from "@/lib/tiempo";
import { guardarClienteContrato, guardarCondiciones, guardarParte } from "../acciones-contrato";
import { Campo, CampoTexto, Dato } from "../campos";
import { FormularioAccion } from "../formulario-accion";

const largo = (d: Date | null | undefined) => (d ? formatoFecha(isoDe(d)!, { dateStyle: "long" }) : "—");
const boton = "inline-flex h-11 items-center gap-2 rounded-[var(--radius-boton)] px-4 text-sm font-medium md:h-10";

// Nombre legible de cada variable de la plantilla, para decir qué falta.
const FALTA: Record<string, string> = {
  "cliente.curp": "CURP del cliente (Datos personales)", "cliente.nss": "NSS del cliente (Datos personales)",
  "cliente.domicilio": "Domicilio del cliente", "cliente.email": "Correo del cliente", "cliente.identificacion": "Identificación del cliente",
  "cliente.parentesco": "Qué es el cliente del finado (hija, hijo…)", "honorario.pct": "Honorario del retiro (parámetro)",
  "precio.pago_unico": "Pago único (honorario fijo)", "precio.pct_recuperado": "% de lo recuperado",
  "beneficiaria.nombre": "Nombre de la beneficiaria", "beneficiaria.relacion": "Relación de la beneficiaria",
  "beneficiaria.curp": "CURP de la beneficiaria", "beneficiaria.domicilio": "Domicilio de la beneficiaria", "beneficiaria.identificacion": "Identificación de la beneficiaria",
  "finado.nombre": "Nombre del finado", "finado.curp": "CURP del finado", "finado.nss": "NSS del finado", "finado.fecha_defuncion": "Fecha de defunción",
  advertencias: "Advertencias del caso (cláusula TERCERA)",
};

export async function PestanaContrato({ caso, sesion }: { caso: CasoDetalle; sesion: Sesion }) {
  const hoy = hoyCDMX();
  const opera = sesion.usuario.rol !== "vendedor";
  const fallec = caso.servicio.clave === "FALLECIMIENTO";
  const fechaPlantilla = isoDe(caso.fecha_contrato) ?? hoy;
  const [suspensiones, p, plantillas, previa, partes] = await Promise.all([
    conUsuario(sesion.claims, (tx) => tx.suspensionContrato.findMany({ where: { caso_id: caso.id, archivado_at: null }, orderBy: { inicio: "desc" } }), sesion.ip).catch(() => []),
    parametrosFechas(hoy),
    Promise.all((["contrato", "aviso_privacidad"] as Clase[]).map((c) => plantillaVigente(caso.tipo_servicio, c, fechaPlantilla))),
    opera ? datosContrato(sesion, caso.id, false) : null,
    opera ? conUsuario(sesion.claims, (tx) => tx.parteCaso.findMany({ where: { caso_id: caso.id, archivado_at: null } }), sesion.ip) : [],
  ]);
  const vence = isoDe(caso.fecha_vencimiento_contrato);
  const restantes = vence ? diasEntre(hoy, vence) : null;
  const docs = (["contrato", "aviso_privacidad"] as Clase[]).map((clase, i) => {
    const pl = plantillas[i];
    const faltantes = pl && previa ? llenar(pl.cuerpo, previa.datos).faltantes : [];
    return { clase, pl, faltantes };
  });
  const parte = (rol: string) => partes.find((x) => x.rol === rol);
  const ben = parte("beneficiaria"), fin = parte("finado");

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="grid gap-4 lg:col-span-2">
        {opera && (
          <Card>
            <CardHeader><CardTitle>Documentos para firma</CardTitle><FileSignature className="size-5 text-ink-muted" aria-hidden /></CardHeader>
            <CardContent className="grid gap-4">
              {docs.map(({ clase, pl, faltantes }) => (
                <div key={clase} className="rounded-[var(--radius-boton)] border border-borde p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-ink">{clase === "contrato" ? "Contrato" : "Aviso de privacidad"}</p>
                      <p className="text-xs text-ink-muted">{pl ? `${pl.nombre} · versión ${pl.version}` : "Este servicio todavía no tiene plantilla. Pásame el documento para cargarla."}</p>
                    </div>
                    {pl && (
                      <a href={`/api/casos/${caso.id}/contrato?doc=${clase}`} target="_blank" rel="noopener"
                        className={`${boton} ${faltantes.length ? "border border-brand text-brand hover:bg-brand-tint" : "bg-brand text-white hover:bg-brand-dark"}`}>
                        <FileSignature className="size-4" aria-hidden /> Generar PDF
                      </a>
                    )}
                  </div>
                  {pl && (faltantes.length ? (
                    <div className="mt-2 flex gap-2 text-sm">
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-aviso" aria-hidden />
                      <div>
                        <p className="text-ink">Falta capturar (si generas ahora, sale una línea para llenar a mano):</p>
                        <ul className="mt-1 list-disc pl-5 text-ink-muted">{faltantes.map((f) => <li key={f}>{FALTA[f] ?? f}</li>)}</ul>
                      </div>
                    </div>
                  ) : <p className="mt-2 flex items-center gap-1 text-sm text-exito-texto"><CircleCheck className="size-4" aria-hidden /> Listo para generar</p>)}
                </div>
              ))}
              <p className="flex gap-2 text-xs text-ink-muted"><ShieldCheck className="size-4 shrink-0" aria-hidden /> El PDF lleva CURP y NSS completos: cada vez que lo generas queda registrado en la bitácora.</p>
            </CardContent>
          </Card>
        )}

        {opera && (
          <Card>
            <CardHeader><CardTitle>Datos del cliente para el contrato</CardTitle></CardHeader>
            <CardContent>
              <FormularioAccion accion={guardarClienteContrato.bind(null, caso.id, caso.persona.id)} etiquetas={{ domicilio: "Domicilio", identificacion: "Identificación", email: "Correo" }}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <CampoTexto id="domicilio" etiqueta="Domicilio completo" ayuda="calle, número, colonia, C.P., municipio y estado" valor={caso.persona.domicilio} className="sm:col-span-2" />
                  <CampoTexto id="identificacion" etiqueta="Se identifica con" valor={caso.persona.identificacion ?? "credencial para votar vigente"} />
                  <CampoTexto id="email" etiqueta="Correo" tipo="email" valor={caso.persona.email} />
                </div>
              </FormularioAccion>
            </CardContent>
          </Card>
        )}

        {opera && fallec && (
          <>
            <Card>
              <CardHeader><CardTitle>Finado</CardTitle></CardHeader>
              <CardContent>
                <FormularioAccion accion={guardarParte.bind(null, caso.id, "finado")} etiquetas={{ nombre: "Nombre", curp: "CURP", nss: "NSS", fecha_defuncion: "Fecha de defunción" }}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <CampoTexto id="nombre" etiqueta="Nombre completo" valor={fin?.nombre} />
                    <CampoTexto id="parentesco_cliente" etiqueta="El cliente es su…" ayuda="hija, hijo, nieta…" valor={fin?.parentesco_cliente} />
                    <CampoTexto id="curp" etiqueta="CURP" ayuda={fin?.curp_parcial ? `capturada: ${fin.curp_parcial}` : "18 caracteres"} placeholder={fin?.curp_parcial ? "Escribe solo para cambiarla" : ""} />
                    <CampoTexto id="nss" etiqueta="NSS" ayuda={fin?.nss_ultimos4 ? `capturado: ···${fin.nss_ultimos4}` : "11 dígitos"} placeholder={fin?.nss_ultimos4 ? "Escribe solo para cambiarlo" : ""} />
                    <CampoTexto id="fecha_defuncion" etiqueta="Fecha de defunción" tipo="date" valor={isoDe(fin?.fecha_defuncion) ?? ""} max={hoy} />
                    <CampoTexto id="regimen" etiqueta="Régimen" valor={fin?.regimen} placeholder="Ley del Seguro Social de 1973" />
                    <CampoTexto id="afore" etiqueta="Afore del finado" valor={fin?.afore} />
                  </div>
                </FormularioAccion>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Beneficiaria</CardTitle></CardHeader>
              <CardContent>
                <FormularioAccion accion={guardarParte.bind(null, caso.id, "beneficiaria")} etiquetas={{ nombre: "Nombre", curp: "CURP" }}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <CampoTexto id="nombre" etiqueta="Nombre completo" valor={ben?.nombre} />
                    <CampoTexto id="curp" etiqueta="CURP" ayuda={ben?.curp_parcial ? `capturada: ${ben.curp_parcial}` : "18 caracteres"} placeholder={ben?.curp_parcial ? "Escribe solo para cambiarla" : ""} />
                    <CampoTexto id="relacion" etiqueta="Relación" ayuda="como va en el contrato" valor={ben?.relacion} placeholder="madre de EL CLIENTE y cónyuge supérstite del finado …" className="sm:col-span-2" />
                    <CampoTexto id="domicilio" etiqueta="Domicilio completo" valor={ben?.domicilio} className="sm:col-span-2" />
                    <CampoTexto id="identificacion" etiqueta="Se identifica con" valor={ben?.identificacion ?? "credencial para votar vigente"} />
                  </div>
                </FormularioAccion>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Condiciones del contrato</CardTitle></CardHeader>
              <CardContent>
                <FormularioAccion accion={guardarCondiciones.bind(null, caso.id)} etiquetas={{ honorario_fijo: "Pago único", contrato_pct: "% de lo recuperado", contrato_advertencias: "Advertencias" }}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <CampoTexto id="honorario_fijo" etiqueta="Pago único a la firma" ayuda="IVA incluido" inputMode="decimal" valor={caso.honorario_fijo ? Number(caso.honorario_fijo) : null} />
                    <CampoTexto id="contrato_pct" etiqueta="% de lo recuperado" ayuda="vacío = el del parámetro" inputMode="decimal" valor={caso.contrato_pct ? Number(caso.contrato_pct) * 100 : null} />
                    <CampoTexto id="contrato_regularizacion" etiqueta="Regularización documental" ayuda="opcional; completa «en particular…»" valor={caso.contrato_regularizacion}
                      placeholder="el estado civil asentado en el acta de defunción" className="sm:col-span-2" />
                    <Campo id="contrato_advertencias" etiqueta="Advertencias del caso (cláusula TERCERA)" ayuda="una por renglón" className="sm:col-span-2">
                      <textarea id="contrato_advertencias" name="contrato_advertencias" rows={6} defaultValue={caso.contrato_advertencias ?? ""}
                        className="w-full rounded-[var(--radius-boton)] border border-borde bg-surface p-3 text-sm text-ink" />
                    </Campo>
                  </div>
                </FormularioAccion>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid content-start gap-4">
        <Card>
          <CardHeader><CardTitle>Contrato {caso.folio}</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {!caso.fecha_contrato ? (
              <p className="text-sm text-ink-muted">Aún no se firma. La fecha de firma se captura en Resumen → «Contrato firmado». Mientras, el PDF sale con la fecha de hoy.</p>
            ) : (
              <dl className="grid gap-3 text-sm">
                <Dato titulo="Fecha de firma" valor={largo(caso.fecha_contrato)} />
                <Dato titulo="Vence" valor={vence ? `${largo(caso.fecha_vencimiento_contrato)}${restantes !== null ? (restantes >= 0 ? ` · faltan ${restantes} días` : ` · venció hace ${-restantes} días`) : ""}` : "—"} />
                <Dato titulo="Días suspendidos por causa del cliente" valor={String(caso.dias_suspendidos)} />
                {caso.contrato_generado_at && <Dato titulo="Último PDF generado" valor={largo(caso.contrato_generado_at)} />}
              </dl>
            )}
            {caso.servicio.clave === "RETIRO_DESEMPLEO" && (
              <p className="text-xs text-ink-muted">Vigencia: {p.VIGENCIA_CONTRATO_DIAS} días naturales desde la firma, más los días bloqueado por causa del cliente.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Suspensiones</CardTitle></CardHeader>
          <CardContent>
            {suspensiones.length === 0 ? <p className="text-sm text-ink-muted">Sin suspensiones.</p> : (
              <ul className="grid gap-3 text-sm">
                {suspensiones.map((x) => (
                  <li key={x.id}>
                    <p className="text-ink">{largo(x.inicio)} → {x.fin ? largo(x.fin) : "sigue abierta"}</p>
                    <p className="text-xs text-ink-muted">{x.motivo}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
