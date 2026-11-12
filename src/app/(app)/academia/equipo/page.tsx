import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Award, Lock, LockOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { ETIQUETA_ROL } from "@/components/rpd/navegacion";
import { exigirRol } from "@/lib/auth/sesion";
import { RUTAS } from "@/lib/academia/contenido";
import { avanceDesdeFilas, estadosDe, VIVAS } from "@/lib/academia/motor";
import { conUsuario } from "@/lib/db/prisma";
import { bloqueosActivos } from "@/lib/academia/permisos";
import { CampoTexto, Seleccion } from "../../casos/[id]/campos";
import { FormularioAccion } from "../../casos/[id]/formulario-accion";
import { cambiarInterruptor, otorgarExcepcion, revocarExcepcion } from "../acciones";

export const metadata: Metadata = { title: "Equipo · Academia" };
const fecha = (d: Date) => new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "America/Mexico_City" }).format(d);

// Panel del Director (CAPACITACION.md 12.1): avance por persona, certificaciones, vencimientos e intentos fallidos.
// Con RLS: el Director ve el avance de todos.
export default async function Equipo() {
  const sesion = await exigirRol("director");
  const ahora = new Date();
  const d = await conUsuario(sesion.claims, async (tx) => ({
    usuarios: await tx.usuario.findMany({ where: { activo: true, archivado_at: null, rol: { in: ["socio", "asesor"] } }, orderBy: [{ rol: "desc" }, { nombre: "asc" }], select: { id: true, nombre: true, rol: true } }),
    progreso: await tx.capProgreso.findMany({ where: { estado: "completado" }, select: { usuario_id: true, modulo: true, version: true, updated_at: true } }),
    intentos: await tx.capIntento.findMany({ where: { archivado_at: null }, orderBy: { inicio: "asc" }, select: { usuario_id: true, tipo: true, objetivo: true, inicio: true, fin: true, aprobado: true, calificacion: true } }),
    acuses: await tx.capAcuse.findMany({ select: { usuario_id: true, documento: true, version: true, aceptado_at: true } }),
    certs: await tx.capCertificacion.findMany({ where: { archivado_at: null, estado: { in: VIVAS } }, select: { usuario_id: true, ruta: true, vence_at: true, otorgada_at: true } }),
    casos: await tx.capCasoIntento.findMany({ where: { aprobado: true }, select: { usuario_id: true, caso: true, version: true, aprobado: true } }),
    excepciones: await tx.capExcepcion.findMany({ where: { archivado_at: null, hasta: { gte: new Date(new Date().toISOString().slice(0, 10)) } }, orderBy: { hasta: "asc" },
      select: { id: true, usuario_id: true, ruta: true, hasta: true, motivo: true } }),
  }), sesion.ip);
  const encendido = await bloqueosActivos(sesion);

  const filas = d.usuarios.map((u) => {
    const de = <T extends { usuario_id: string }>(xs: T[]) => xs.filter((x) => x.usuario_id === u.id);
    const a = avanceDesdeFilas({ progreso: de(d.progreso), intentos: de(d.intentos), acuses: de(d.acuses), certs: de(d.certs), casos: de(d.casos) }, ahora);
    const estados = estadosDe(a);
    const actividad = [...de(d.progreso).map((p) => p.updated_at), ...de(d.intentos).map((i) => i.fin ?? i.inicio), ...de(d.acuses).map((x) => x.aceptado_at)].sort((x, y) => y.getTime() - x.getTime())[0];
    const fallidos = de(d.intentos).filter((i) => i.tipo === "examen_ruta" && i.fin && !i.aprobado).length;
    return { u, a, estados, actividad, fallidos, certs: de(d.certs) };
  });

  return (
    <>
      <Encabezado titulo="Avance del equipo" descripcion="Academia: avance por persona en cada ruta, certificaciones y exámenes no aprobados. Obligatoria para asesores de pensiones; para analistas es repaso.">
        <Link href="/academia" className="inline-flex items-center gap-1.5 text-sm text-brand underline"><ArrowLeft className="size-4" aria-hidden /> Academia</Link>
      </Encabezado>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead><tr className="border-b border-borde bg-slate-50 text-xs text-ink-muted">
              <th className="px-4 py-2 font-medium">Persona</th>
              {RUTAS.map((r) => <th key={r.clave} className="px-3 py-2 font-medium">{r.clave}</th>)}
              <th className="px-3 py-2 font-medium">Exámenes no aprobados</th>
              <th className="px-3 py-2 font-medium">Última actividad</th>
            </tr></thead>
            <tbody className="divide-y divide-borde">
              {filas.length === 0 && <tr><td colSpan={RUTAS.length + 3} className="px-4 py-4 text-ink-muted">Todavía no hay asesores de pensiones ni analistas activos.</td></tr>}
              {filas.map(({ u, a, estados, actividad, fallidos, certs }) => (
                <tr key={u.id}>
                  <td className="px-4 py-2.5"><span className="font-medium text-ink">{u.nombre}</span><span className="block text-xs text-ink-muted">{ETIQUETA_ROL[u.rol]}{a.acuses.size < 2 ? " · sin acuses" : ""}</span></td>
                  {RUTAS.map((r) => {
                    const e = estados.find((x) => x.clave === r.clave)!;
                    const c = certs.find((x) => x.ruta === r.clave);
                    return (
                      <td key={r.clave} className="px-3 py-2.5">
                        {a.certificadas.has(r.clave)
                          ? <span className="inline-flex items-center gap-1 text-exito-texto"><Award className="size-4" aria-hidden /> <span className="text-xs">{c?.vence_at ? `vence ${fecha(c.vence_at)}` : "vigente"}</span></span>
                          : e.disponible ? <span className="cifra text-xs text-ink">{e.avance}%</span> : <span className="text-xs text-ink-muted">—</span>}
                      </td>
                    );
                  })}
                  <td className="cifra px-3 py-2.5 text-xs">{fallidos || "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-ink-muted">{actividad ? fecha(actividad) : "Sin iniciar"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className={encendido ? "border-aviso/40" : ""}>
          <CardHeader><CardTitle className="flex items-center gap-2">{encendido ? <Lock className="size-5 text-aviso" aria-hidden /> : <LockOpen className="size-5 text-ink-muted" aria-hidden />} Bloqueos por certificación</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p className={encendido ? "font-medium text-aviso" : "text-ink-muted"}>{encendido ? "Encendidos." : "Apagados: todos conservan sus permisos de siempre."}</p>
            <p className="text-ink-muted">Encendidos, el asesor de pensiones necesita: <strong>N0</strong> para dar de alta prospectos, <strong>R1</strong> para precalificar retiros y generar contratos de retiro (un cliente Ley 73 pasa a tu revisión), <strong>R2</strong> para precalificar Ley 73 y <strong>P1</strong> para recibir casos de pensión. Aplica también en la base de datos. A ti y a los analistas no les afecta.</p>
            <FormularioAccion accion={cambiarInterruptor.bind(null, !encendido)} boton={encendido ? "Apagar bloqueos" : "Encender bloqueos"}
              confirmar={encendido ? "¿Apagar los bloqueos? Todos recuperan sus permisos de siempre." : "¿Encender los bloqueos? Quien no tenga la certificación dejará de poder hacer esas acciones desde hoy."}>
              <span className="sr-only">Cambiar interruptor</span>
            </FormularioAccion>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Excepción temporal</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p className="text-ink-muted">Da los permisos de una certificación a alguien que todavía no la tiene, máximo 30 días y con motivo. Queda en la bitácora.</p>
            <FormularioAccion accion={otorgarExcepcion} boton="Dar excepción" etiquetas={{ usuario_id: "Persona", ruta: "Certificación", dias: "Días", motivo: "Motivo" }} limpiar>
              <div className="grid gap-3 sm:grid-cols-2">
                <Seleccion id="usuario_id" etiqueta="Persona" vacia="Elige…" opciones={d.usuarios.filter((u) => u.rol === "socio").map((u) => [u.id, u.nombre] as const)} />
                <Seleccion id="ruta" etiqueta="Certificación" vacia="Elige…" opciones={RUTAS.map((r) => [r.clave, `${r.clave} · ${r.nombre}`] as const)} />
                <CampoTexto id="dias" etiqueta="Días" ayuda="1 a 30" inputMode="numeric" valor="7" />
                <CampoTexto id="motivo" etiqueta="Motivo" placeholder="Cierra un caso acompañado por el Director" />
              </div>
            </FormularioAccion>
            {d.excepciones.length > 0 && (
              <ul className="grid gap-2 border-t border-borde pt-3">
                {d.excepciones.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span><span className="font-medium text-ink">{d.usuarios.find((u) => u.id === x.usuario_id)?.nombre ?? "—"}</span> · {x.ruta} hasta {fecha(x.hasta)}<span className="block text-xs text-ink-muted">{x.motivo}</span></span>
                    <FormularioAccion accion={revocarExcepcion.bind(null, x.id)} boton="Revocar" confirmar="¿Revocar esta excepción?"
                      className="[&_button]:bg-transparent [&_button]:px-0 [&_button]:text-critico [&_button]:hover:underline"><span className="sr-only">Revocar</span></FormularioAccion>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <p className="mt-3 text-xs text-ink-muted">Juegos de roles, acompañamientos, incidencias y el tablero de desempeño llegan en la fase C.</p>
    </>
  );
}
