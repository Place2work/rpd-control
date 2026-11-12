import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { exigirRol } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { MODULOS } from "@/lib/academia/contenido";
import { DIAS_TABLERO, desempenoDe, metasVigentes, type FilaDesempeno } from "@/lib/academia/desempeno";
import type { Metrica } from "@/lib/reglas/desempeno";
import { CampoTexto } from "../../casos/[id]/campos";
import { FormularioAccion } from "../../casos/[id]/formulario-accion";
import { guardarMetas } from "../acciones";

export const metadata: Metadata = { title: "Desempeño · Academia" };
const pct = (v: number) => `${Math.round(v * 100)}%`;
const valorTexto = (m: Metrica) => m.valor === null ? "—" : m.denominador === null ? String(m.valor) : pct(m.valor);
const metaTexto = (m: Metrica) => m.meta === null ? "Seguimiento" : m.denominador === null ? `≤ ${m.meta}` : `${m.sentido === "maximo" ? "≤" : "≥"} ${pct(m.meta)}`;
const tono = (m: Metrica) => m.cumple === null ? "text-ink-muted" : m.cumple ? "text-exito-texto" : "text-critico";

// Tablero «Mi desempeño» (asesor de pensiones) y «Equipo» (Director), CAPACITACION.md 10. Datos de los últimos 90
// días; si dos métricas quedan debajo de la meta dos semanas seguidas, sugiere los módulos a repasar.
export default async function Desempeno() {
  const sesion = await exigirRol("director", "socio");
  const ahora = new Date();
  const director = sesion.usuario.rol === "director";
  const personas = director
    ? (await conUsuario(sesion.claims, (tx) => tx.usuario.findMany({ where: { rol: "socio", activo: true, archivado_at: null }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, socio_id: true } }), sesion.ip))
        .map((u) => ({ usuarioId: u.id, socioId: u.socio_id, nombre: u.nombre }))
    : [{ usuarioId: sesion.usuario.id, socioId: sesion.usuario.socio_id ?? null, nombre: sesion.usuario.nombre }];
  const filas = await desempenoDe(sesion, personas, ahora);
  const metas = director ? await metasVigentes(sesion) : {};

  return (
    <>
      <Encabezado titulo={director ? "Desempeño del equipo" : "Mi desempeño"} descripcion={`Últimos ${DIAS_TABLERO} días, con datos del CRM. Las metas las ajusta el Director.`}>
        <Link href={director ? "/academia/equipo" : "/academia"} className="inline-flex items-center gap-1.5 text-sm text-brand underline"><ArrowLeft className="size-4" aria-hidden /> {director ? "Avance del equipo" : "Academia"}</Link>
      </Encabezado>

      {director ? (
        <div className="grid gap-4">
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead><tr className="border-b border-borde bg-slate-50 text-xs text-ink-muted">
                  <th className="px-4 py-2 font-medium">Asesor de pensiones</th>
                  {(filas[0]?.metricas ?? []).map((m) => <th key={m.clave} className="px-3 py-2 font-medium" title={m.titulo}>{m.titulo}<span className="block font-normal">{metaTexto(m)}</span></th>)}
                </tr></thead>
                <tbody className="divide-y divide-borde">
                  {filas.length === 0 && <tr><td className="px-4 py-4 text-ink-muted">Todavía no hay asesores de pensiones activos.</td></tr>}
                  {filas.map((f) => (
                    <tr key={f.usuarioId}>
                      <td className="px-4 py-2.5"><Link href={`/academia/equipo/${f.usuarioId}`} className="font-medium text-brand hover:underline">{f.nombre}</Link>
                        {f.repaso.modulos.length > 0 && <span className="block text-xs text-aviso">Sugerir repaso: {f.repaso.modulos.join(", ")}</span>}
                        {!f.socioId && <span className="block text-xs text-ink-muted">Sin ficha de asesor ligada</span>}</td>
                      {f.metricas.map((m) => (
                        <td key={m.clave} className={`cifra px-3 py-2.5 ${tono(m)}`}>{valorTexto(m)}{m.denominador ? <span className="block text-xs text-ink-muted">{m.numerador} de {m.denominador}</span> : null}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Metas</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <p className="text-ink-muted">En porcentaje (las incidencias de línea roja, en número). El cambio aplica desde hoy y queda en la bitácora.</p>
              <FormularioAccion accion={guardarMetas} boton="Guardar metas">
                <div className="grid gap-3 sm:grid-cols-3">
                  {(filas[0]?.metricas ?? []).filter((m) => m.sentido !== "seguimiento").map((m) => {
                    const v = metas[m.clave];
                    return <CampoTexto key={m.clave} id={`meta_${m.clave}`} etiqueta={m.titulo} inputMode="decimal"
                      valor={v === undefined ? "" : m.denominador === null ? String(v) : String(Math.round(v * 1000) / 10)} ayuda={m.sentido === "maximo" ? "Máximo" : "Mínimo"} />;
                  })}
                </div>
              </FormularioAccion>
            </CardContent>
          </Card>
        </div>
      ) : <MiTablero fila={filas[0]} />}
    </>
  );
}

function MiTablero({ fila }: { fila: FilaDesempeno }) {
  if (!fila.socioId) return <p className="text-sm text-ink-muted">Tu usuario todavía no está ligado a tu ficha de asesor de pensiones. Pídeselo al Director.</p>;
  return (
    <div className="grid gap-4">
      {fila.repaso.modulos.length > 0 && (
        <Card className="border-aviso/40">
          <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="size-5 text-aviso" aria-hidden /> Te sugerimos repasar</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p className="text-ink-muted">Dos o más métricas quedaron debajo de la meta dos semanas seguidas.</p>
            <ul className="grid gap-1">
              {fila.repaso.modulos.map((m) => <li key={m}><Link href={`/academia/${m}`} className="text-brand underline"><span className="cifra">{m}</span> · {MODULOS.find((x) => x.clave === m)?.titulo}</Link></li>)}
            </ul>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fila.metricas.map((m) => (
          <Card key={m.clave}>
            <CardContent className="grid gap-1 pt-5">
              <p className="flex items-center gap-1.5 text-xs text-ink-muted"><TrendingUp className="size-4" aria-hidden /> {m.titulo}</p>
              <p className={`font-display text-2xl font-semibold ${tono(m)}`}>{valorTexto(m)}</p>
              <p className="text-xs text-ink-muted">Meta: {metaTexto(m)}{m.denominador ? ` · ${m.numerador} de ${m.denominador}` : ""}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
