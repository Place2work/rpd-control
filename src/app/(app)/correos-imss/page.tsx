import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { exigirRol } from "@/lib/auth/sesion";
import { BUZON_CONSTANCIAS } from "@/lib/correo/buzon";
import { conUsuario } from "@/lib/db/prisma";
import { CampoTexto } from "../casos/[id]/campos";
import { FormularioAccion } from "../casos/[id]/formulario-accion";
import { asignarCorreo, descartarCorreo } from "./acciones";

export const metadata: Metadata = { title: "Correos del IMSS" };
const TIPO = { constancia: "Constancia de semanas (PDF)", confirmacion: "Liga para confirmar la solicitud", otro: "Otro correo del IMSS" } as Record<string, string>;
const fecha = (d: Date) => new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).format(d);

export default async function CorreosImss() {
  const sesion = await exigirRol("director", "asesor");
  const { pendientes, recientes } = await conUsuario(sesion.claims, async (tx) => ({
    pendientes: await tx.correoEntrante.findMany({ where: { estado: "sin_caso", archivado_at: null }, orderBy: { recibido_at: "desc" },
      select: { id: true, remitente: true, asunto: true, recibido_at: true, tipo: true, detalle: true, liga: true } }),
    recientes: await tx.correoEntrante.findMany({ where: { estado: "ligado" }, orderBy: { recibido_at: "desc" }, take: 10,
      select: { id: true, recibido_at: true, tipo: true, caso: { select: { folio: true } } } }),
  }), sesion.ip);

  return (
    <>
      <Encabezado titulo="Correos del IMSS" descripcion={`Lo que llega a ${BUZON_CONSTANCIAS}. Casi todo se liga solo al caso; aquí queda lo que no se pudo ligar.`} />
      <div className="grid gap-4">
        {pendientes.length === 0 && <Card><CardContent className="text-sm text-ink-muted">No hay correos por asignar.</CardContent></Card>}
        {pendientes.map((c) => (
          <Card key={c.id}>
            <CardContent className="grid gap-3 text-sm">
              <div>
                <p className="font-medium text-ink">{TIPO[c.tipo] ?? c.tipo}</p>
                <p className="text-xs text-ink-muted">{fecha(c.recibido_at)} · {c.asunto ?? "sin asunto"}</p>
                {c.detalle && <p className="mt-1 text-xs text-ink-muted">{c.detalle}</p>}
                {c.liga && <a href={c.liga} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-brand underline">Abrir la liga del IMSS <ExternalLink className="size-3.5" aria-hidden /></a>}
              </div>
              {c.tipo !== "otro" && (
                <FormularioAccion accion={asignarCorreo.bind(null, c.id)} boton="Asignar al caso" etiquetas={{ folio: "Folio" }} className="max-w-sm">
                  <CampoTexto id="folio" etiqueta="Folio del caso" placeholder="RP-0012" required />
                </FormularioAccion>
              )}
              <FormularioAccion accion={async () => { "use server"; return descartarCorreo(c.id); }} boton="Descartar" confirmar="¿Descartar este correo?"
                className="[&_button]:bg-transparent [&_button]:px-0 [&_button]:text-ink-muted [&_button]:hover:underline"><span className="sr-only">Descartar</span></FormularioAccion>
            </CardContent>
          </Card>
        ))}
        {recientes.length > 0 && (
          <Card>
            <CardContent className="grid gap-1 text-xs text-ink-muted">
              <p className="text-sm font-medium text-ink">Últimos ligados solos</p>
              {recientes.map((r) => <p key={r.id}>{fecha(r.recibido_at)} · {TIPO[r.tipo] ?? r.tipo} → {r.caso?.folio ?? "—"}</p>)}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
