import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { Campo, CampoTexto, Casilla } from "../../casos/[id]/campos";
import { FormularioAccion } from "../../casos/[id]/formulario-accion";
import { guardarMensaje } from "../acciones";

export async function SeccionMensajes({ sesion }: { sesion: Sesion }) {
  const mensajes = await conUsuario(sesion.claims, (tx) => tx.plantillaMensaje.findMany({ orderBy: { nombre: "asc" } }), sesion.ip);
  return (
    <div className="grid gap-4">
      <p className="text-sm text-ink-muted">Mensajes que el asesor manda por WhatsApp con un clic (8.3). Variables: {"{nombre} {folio} {fecha} {mes} {monto} {dias} {documentos} {liga_privacidad}"}. En tuteo y sin NSS, CURP ni montos de saldo.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {mensajes.map((m) => (
          <Card key={m.clave}>
            <CardHeader><CardTitle>{m.nombre}</CardTitle><span className="font-mono text-[11px] text-ink-muted">{m.clave}</span></CardHeader>
            <CardContent>
              <FormularioAccion accion={guardarMensaje.bind(null, m.clave)} etiquetas={{ nombre: "Nombre", cuerpo: "Mensaje" }}>
                <CampoTexto id="nombre" etiqueta="Nombre" valor={m.nombre} />
                <Campo id="cuerpo" etiqueta="Mensaje">
                  <textarea id="cuerpo" name="cuerpo" rows={5} defaultValue={m.cuerpo} className="w-full rounded-[var(--radius-boton)] border border-borde bg-surface p-3 text-sm text-ink" />
                </Campo>
                <Casilla id="activo" etiqueta="Activo (aparece como botón en el expediente y en Hoy)" marcada={m.activo} />
              </FormularioAccion>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
