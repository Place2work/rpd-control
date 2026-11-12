"use client";

// «Pedir constancia al IMSS»: pasos guiados en el portal oficial (la persona resuelve el captcha) con el correo de
// constancias de la empresa; el IMSS responde a ese buzón y el sistema liga la respuesta al caso.
import { ExternalLink, MailCheck, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BotonCopiar } from "@/components/rpd/boton-copiar";
import { DatoSensible } from "./dato-sensible";
import { cancelarSolicitudConstancia, marcarConstanciaPedida } from "./acciones-solicitud";

type Solicitud = { id: string; estado: string; liga: string | null; creada: string; actualizada: string } | null;

const fecha = (iso: string) => new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date(iso));

export function SolicitudConstancia({ casoId, personaId, curp, nss, puedeVer, buzon, portal, solicitud }: {
  casoId: string; personaId: string; curp: string | null; nss: string | null; puedeVer: boolean; buzon: string; portal: string; solicitud: Solicitud;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, iniciar] = useTransition();
  const correr = (f: () => Promise<{ ok?: boolean; error?: string }>) => iniciar(async () => {
    setError(null);
    const r = await f();
    if (r.error) setError(r.error); else { setAbierto(false); router.refresh(); }
  });
  const viva = solicitud && (solicitud.estado === "pendiente" || solicitud.estado === "confirmar");

  if (viva && solicitud.estado === "confirmar" && solicitud.liga) {
    return (
      <div className="grid gap-2 rounded-[var(--radius-boton)] border border-aviso/40 bg-aviso-tint p-3 text-sm md:col-span-2">
        <p className="flex items-center gap-2 font-medium text-ink"><MailCheck className="size-4" aria-hidden /> El IMSS mandó la liga para confirmar la solicitud</p>
        <p className="text-xs text-ink-muted">Al confirmar, el IMSS manda la constancia al buzón y aparece sola aquí en Documentos.</p>
        <div className="flex flex-wrap gap-2">
          <a href={solicitud.liga} target="_blank" rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-boton)] bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark md:h-9">
            Confirmar en el IMSS <ExternalLink className="size-4" aria-hidden />
          </a>
          <button type="button" disabled={cargando} onClick={() => correr(() => cancelarSolicitudConstancia(casoId, solicitud.id))} className="text-xs text-ink-muted underline">Cancelar solicitud</button>
        </div>
        {error && <p role="alert" className="text-xs text-critico">{error}</p>}
      </div>
    );
  }
  if (viva) {
    return (
      <div className="flex flex-col gap-1 text-xs md:items-end">
        <p className="text-ink-muted">Pedida al IMSS el {fecha(solicitud.creada)} · esperando su correo</p>
        <button type="button" disabled={cargando} onClick={() => correr(() => cancelarSolicitudConstancia(casoId, solicitud.id))} className="text-ink-muted underline">Cancelar solicitud</button>
        {error && <p role="alert" className="text-critico">{error}</p>}
      </div>
    );
  }
  if (!abierto) {
    return (
      <div className="flex flex-col gap-1 md:items-end">
        <button type="button" onClick={() => setAbierto(true)}
          className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-boton)] border border-brand px-3 text-sm font-medium text-brand hover:bg-brand-tint md:h-9">
          <Send className="size-4" aria-hidden /> Pedir constancia al IMSS
        </button>
        {solicitud?.estado === "recibida" && <p className="text-xs text-exito-texto">La última llegó del IMSS el {fecha(solicitud.actualizada)}</p>}
      </div>
    );
  }
  return (
    <div className="grid gap-3 rounded-[var(--radius-boton)] border border-borde bg-slate-50 p-4 text-sm md:col-span-2">
      <p className="font-medium text-ink">Pedir la constancia en el portal oficial del IMSS</p>
      <ol className="grid list-decimal gap-2 pl-5 text-ink">
        <li>
          Abre el portal: <a href={portal} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand underline">Constancia de semanas cotizadas (IMSS) <ExternalLink className="size-3.5" aria-hidden /></a>
        </li>
        <li className="grid gap-1">
          Captura estos datos (copia y pega para no equivocarte):
          <span className="flex flex-wrap items-center gap-2 text-xs"><span className="w-12 text-ink-muted">CURP</span> <DatoSensible personaId={personaId} campo="curp" enmascarado={curp} puedeVer={puedeVer} /></span>
          <span className="flex flex-wrap items-center gap-2 text-xs"><span className="w-12 text-ink-muted">NSS</span> <DatoSensible personaId={personaId} campo="nss" enmascarado={nss} puedeVer={puedeVer} /></span>
          <span className="flex flex-wrap items-center gap-2 text-xs"><span className="w-12 text-ink-muted">Correo</span> <span className="font-mono">{buzon}</span> <BotonCopiar texto={buzon} /></span>
        </li>
        <li>Escribe el código de la imagen y envía la solicitud. <span className="text-ink-muted">No uses el correo del cliente: así la respuesta llega al sistema.</span></li>
        <li>Regresa aquí y da «Ya la pedí». Cuando el IMSS conteste, verás la liga para confirmar y después la constancia llegará sola.</li>
      </ol>
      {(!curp || !nss) && <p className="text-xs text-aviso">Falta {!curp && !nss ? "la CURP y el NSS" : !curp ? "la CURP" : "el NSS"} del cliente: captúralos en Datos personales.</p>}
      {error && <p role="alert" className="text-xs text-critico">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={cargando} onClick={() => correr(() => marcarConstanciaPedida(casoId))}
          className="inline-flex h-11 items-center rounded-[var(--radius-boton)] bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 md:h-9">
          {cargando ? "Guardando…" : "Ya la pedí"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="inline-flex h-11 items-center px-3 text-sm text-ink-muted hover:text-ink md:h-9">Cerrar</button>
      </div>
    </div>
  );
}
