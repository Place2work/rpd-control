import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { hoyCDMX } from "@/lib/tiempo";
import { CampoTexto, Seleccion } from "../../casos/[id]/campos";
import { FormularioAccion } from "../../casos/[id]/formulario-accion";
import { agregarInhabil, cambiarInhabil } from "../acciones";
import { BotonAccion } from "../boton-accion";

const larga = (d: Date) => new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);

export async function SeccionInhabiles({ sesion }: { sesion: Sesion }) {
  const hoy = hoyCDMX();
  const desde = new Date(`${hoy.slice(0, 4)}-01-01T00:00:00Z`);
  const dias = await conUsuario(sesion.claims, (tx) => tx.diaInhabil.findMany({ where: { fecha: { gte: desde } }, orderBy: { fecha: "asc" } }), sesion.ip);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Días inhábiles</CardTitle><span className="text-sm text-ink-muted">Cuentan para los 15 días hábiles y los 5 de la Afore</span></CardHeader>
        <CardContent>
          <ul className="divide-y divide-borde text-sm">
            {dias.map((d) => {
              const f = d.fecha.toISOString().slice(0, 10);
              return (
                <li key={f} className={`flex flex-wrap items-center justify-between gap-2 py-2 ${d.activo ? "" : "text-ink-muted line-through"}`}>
                  <span><span className="cifra">{larga(d.fecha)}</span> · {d.descripcion} <span className="text-xs text-ink-muted">({d.origen})</span></span>
                  <BotonAccion accion={cambiarInhabil.bind(null, f, !d.activo)} texto={d.activo ? "Desactivar" : "Activar"} variante={d.activo ? "fantasma" : "secundario"} />
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Agregar día</CardTitle></CardHeader>
        <CardContent>
          <FormularioAccion accion={agregarInhabil} boton="Agregar" etiquetas={{ fecha: "Fecha", descripcion: "Motivo", origen: "Origen" }}>
            <CampoTexto id="fecha" etiqueta="Fecha" tipo="date" />
            <CampoTexto id="descripcion" etiqueta="Motivo" placeholder="Día de Muertos" />
            <Seleccion id="origen" etiqueta="Origen" valor="oficial" opciones={[["oficial", "Oficial"], ["bancario", "Bancario"], ["afore", "Afore"]]} />
          </FormularioAccion>
        </CardContent>
      </Card>
    </div>
  );
}
