import { CalendarCheck, CheckCircle2, MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoVacio } from "@/components/rpd/estado-vacio";
import { formatoFecha, isoDe } from "@/components/rpd/insignia-dia46";
import { LigasConsulta } from "@/components/rpd/ligas-consulta";
import { obtenerSesion } from "@/lib/auth/sesion";
import { ligasConsulta, parametrosFechas } from "@/lib/parametros";
import { nombreCompleto, obtenerCaso, type CasoDetalle } from "@/lib/prospectos/consultas";
import { ORIGENES } from "@/lib/prospectos/validacion";
import { fechaElegibleDesempleo, fechaFinCandado } from "@/lib/reglas/fechas";
import { enmascararNss } from "@/lib/reglas/identificadores";
import { hoyCDMX } from "@/lib/tiempo";
import { cn } from "@/lib/utils";
import { DatoSensible } from "./dato-sensible";
import { NotaRapida } from "./nota-rapida";

export const metadata: Metadata = { title: "Expediente" };

// 10.4. En esta entrega: Resumen, Datos personales y Seguimiento. El resto llega en las siguientes.
const PESTANAS = [
  ["resumen", "Resumen"],
  ["datos", "Datos personales"],
  ["imss", "IMSS y Afore"],
  ["calculo", "Cálculo"],
  ["documentos", "Documentos"],
  ["seguimiento", "Seguimiento"],
  ["dinero", "Dinero"],
  ["contrato", "Contrato"],
] as const;
const LISTAS = new Set(["resumen", "datos", "seguimiento"]);

const ETAPA: Record<string, { texto: string; tono: "prospecto" | "espera" | "tramite" | "pagado" | "perdido" | "critico" }> = {
  PROSPECTO: { texto: "Prospecto", tono: "prospecto" },
  PRECALIFICADO: { texto: "Precalificado", tono: "tramite" },
  EN_ESPERA: { texto: "En espera", tono: "espera" },
  CONTRATO: { texto: "Contrato firmado", tono: "tramite" },
  EXPEDIENTE: { texto: "Armando expediente", tono: "tramite" },
  INGRESADA: { texto: "Ingresada a Afore", tono: "tramite" },
  RESOLUCION: { texto: "Resolución Afore", tono: "tramite" },
  PAGADO: { texto: "Pagado por Afore", tono: "pagado" },
  CERRADO: { texto: "Honorario cobrado", tono: "pagado" },
  BLOQUEADO: { texto: "Bloqueado", tono: "critico" },
  PERDIDO: { texto: "Perdido", tono: "perdido" },
};
const ETIQUETA_ORIGEN = Object.fromEntries(ORIGENES) as Record<string, string>;
const REGIMEN: Record<string, string> = { L73: "Ley 73", L97: "Ley 97", por_definir: "Régimen por definir" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; nuevo?: string }> };

export default async function Expediente({ params, searchParams }: Props) {
  const sesion = await obtenerSesion();
  const [{ id }, { tab = "resumen", nuevo }] = await Promise.all([params, searchParams]);
  const caso = await obtenerCaso(sesion, id);
  if (!caso) notFound();

  const pestana = LISTAS.has(tab) ? tab : "resumen";
  const nombre = nombreCompleto(caso.persona);
  const etapa = ETAPA[caso.etapa] ?? { texto: caso.etapa, tono: "prospecto" as const };
  const wa = caso.persona.whatsapp?.replace("+", "");
  const saludo = encodeURIComponent(`Hola ${caso.persona.nombre}, te escribimos de RetiroPorDesempleo.com.`);

  return (
    <>
      {nuevo && (
        <div role="status" className="mb-4 flex items-center gap-2 rounded-[var(--radius-tarjeta)] bg-exito-tint px-4 py-3 text-sm text-exito-texto">
          <CheckCircle2 className="size-5" aria-hidden /> Alta lista. Folio <span className="cifra font-semibold">{caso.folio}</span>.
        </div>
      )}

      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[22px] font-semibold text-ink md:text-[28px]">{nombre}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <span className="cifra font-medium text-ink">{caso.folio}</span>
            <span>·</span> {caso.servicio.nombre.split(" (")[0]}
            <Badge tono={etapa.tono}>{etapa.texto}</Badge>
            {caso.datos_imss && <span>· {REGIMEN[caso.datos_imss.regimen]}</span>}
            <span>· {caso.asignado ? `Asignado a ${caso.asignado.nombre}` : "Bandeja general"}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {wa && (
            <a href={`https://wa.me/${wa}?text=${saludo}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-boton)] bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark md:h-10">
              <MessageCircle className="size-4" aria-hidden /> WhatsApp
            </a>
          )}
          {caso.persona.telefono && (
            <a href={`tel:${caso.persona.telefono}`}
              className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-boton)] border border-brand px-4 text-sm font-medium text-brand hover:bg-brand-tint md:h-10">
              <Phone className="size-4" aria-hidden /> Llamar
            </a>
          )}
        </div>
      </header>

      <nav aria-label="Secciones del expediente" className="-mx-4 mb-4 overflow-x-auto border-b border-borde px-4 md:mx-0 md:px-0">
        <ul className="flex gap-1">
          {PESTANAS.map(([clave, texto]) => {
            const activa = clave === pestana;
            const lista = LISTAS.has(clave);
            return (
              <li key={clave}>
                {lista ? (
                  <Link href={`/casos/${caso.id}?tab=${clave}`} aria-current={activa ? "page" : undefined}
                    className={cn("inline-block whitespace-nowrap border-b-2 px-3 py-3 text-sm",
                      activa ? "border-brand font-medium text-brand" : "border-transparent text-ink-muted hover:text-ink")}>
                    {texto}
                  </Link>
                ) : (
                  <span className="inline-block cursor-not-allowed whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm text-ink-muted/50"
                    title="Llega en la siguiente entrega">{texto}</span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {pestana === "resumen" && <Resumen caso={caso} />}
      {pestana === "datos" && <Datos caso={caso} puedeVer={sesion.usuario.rol !== "vendedor"} />}
      {pestana === "seguimiento" && <Seguimiento caso={caso} />}
    </>
  );
}

async function Resumen({ caso }: { caso: CasoDetalle }) {
  const hoy = hoyCDMX();
  const p = await parametrosFechas(hoy);
  const baja = isoDe(caso.datos_imss?.fecha_baja);
  const dia46 = baja ? fechaElegibleDesempleo(baja, hoy, p) : null;
  const candado = caso.datos_afore
    ? fechaFinCandado(caso.datos_afore.estado_ultimo_retiro, isoDe(caso.datos_afore.fecha_ultimo_retiro), hoy, p)
    : { estado: "por_verificar" as const };
  const esRetiro = caso.servicio.clave === "RETIRO_DESEMPLEO";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {esRetiro && (
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center gap-1 py-8 text-center">
            {!dia46 ? (
              <>
                <p className="font-display text-lg font-semibold text-ink">Falta la fecha de baja</p>
                <p className="text-sm text-ink-muted">Con ella calculamos cuándo puede retirar (día {p.DIAS_ESPERA_DESEMPLEO}).</p>
              </>
            ) : dia46.yaPuede ? (
              <>
                <CalendarCheck className="size-10 text-exito" aria-hidden />
                <p className="font-display text-[28px] font-semibold text-exito-texto">Ya puede retirar</p>
                <p className="text-sm text-ink-muted">Desde el {formatoFecha(dia46.fecha, { dateStyle: "long" })}</p>
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
        <CardHeader><CardTitle>Fechas clave</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Dato titulo="Primer contacto" valor={isoDe(caso.fecha_primer_contacto) ? formatoFecha(isoDe(caso.fecha_primer_contacto)!, { dateStyle: "long" }) : "—"} />
            <Dato titulo="Fecha de baja" valor={baja ? formatoFecha(baja, { dateStyle: "long" }) : "Sin capturar"} />
            {esRetiro && (
              <Dato titulo="Candado de 5 años (art. 191-II)" valor={
                candado.estado === "por_verificar" ? "Por verificar en el estado de cuenta Afore"
                  : candado.estado === "libre" ? "Libre: nunca ha retirado"
                  : candado.estado === "vencido" ? `Libre desde el ${formatoFecha(candado.fecha, { dateStyle: "long" })}`
                  : `Bloqueado hasta el ${formatoFecha(candado.fecha, { dateStyle: "long" })}`
              } />
            )}
            <Dato titulo="Origen" valor={ETIQUETA_ORIGEN[caso.persona.origen] ?? caso.persona.origen} />
            <Dato titulo="Vendedor" valor={caso.vendedor?.nombre ?? "—"} />
            <Dato titulo="Referidor" valor={caso.referidor?.nombre ?? "—"} />
          </dl>
          <p className="mt-4 text-xs text-ink-muted">Todas las fechas son estimadas hasta que se verifiquen con los documentos del cliente.</p>
        </CardContent>
      </Card>
    </div>
  );
}

async function Datos({ caso, puedeVer }: { caso: CasoDetalle; puedeVer: boolean }) {
  const ligas = await ligasConsulta();
  const p = caso.persona;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Datos personales</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Dato titulo="Nombre" valor={nombreCompleto(p)} />
            <Dato titulo="WhatsApp" valor={p.whatsapp ?? "—"} />
            <div>
              <dt className="text-xs text-ink-muted">CURP</dt>
              <dd className="mt-0.5"><DatoSensible personaId={p.id} campo="curp" enmascarado={p.curp_parcial} puedeVer={puedeVer} /></dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">NSS</dt>
              <dd className="mt-0.5"><DatoSensible personaId={p.id} campo="nss" enmascarado={p.nss_ultimos4 ? enmascararNss(p.nss_ultimos4) : null} puedeVer={puedeVer} /></dd>
            </div>
            <Dato titulo="Fecha de nacimiento" valor={isoDe(p.fecha_nacimiento) ? formatoFecha(isoDe(p.fecha_nacimiento)!, { dateStyle: "long" }) : "—"} />
            <Dato titulo="Aviso de privacidad" valor={p.privacidad_aceptada_at ? `Aceptado (versión ${p.privacidad_version ?? "—"})` : "Pendiente"} />
          </dl>
          <p className="mt-4 text-xs text-ink-muted">La edición de datos llega en la siguiente entrega.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Consultas oficiales</CardTitle></CardHeader>
        <CardContent className="pt-2"><LigasConsulta ligas={ligas} /></CardContent>
      </Card>
    </div>
  );
}

function Seguimiento({ caso }: { caso: CasoDetalle }) {
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
                  <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full bg-brand" aria-hidden />
                  <p className="text-sm text-ink">{e.texto}</p>
                  <p className="text-xs text-ink-muted">
                    {cuando.format(e.fecha)} · {e.tipo.replace("_", " ")} · {e.usuario?.nombre ?? "Sistema"}
                  </p>
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

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{titulo}</dt>
      <dd className="mt-0.5 text-ink">{valor}</dd>
    </div>
  );
}
