import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { CampoTexto, Seleccion } from "../../casos/[id]/campos";
import { FormularioAccion } from "../../casos/[id]/formulario-accion";
import { actualizarUsuario, cambiarAcceso, invitarUsuario } from "../acciones";
import { BotonAccion } from "../boton-accion";

const ROLES = [["asesor", "Asesor"], ["vendedor", "Vendedor"], ["socio", "Socio licenciatario"], ["director", "Director"]] as const;
const QUE_VE: Record<string, string> = {
  director: "Todo, incluida Configuración, dinero y comisiones de todos.",
  asesor: "Todos los casos y el expediente completo; no ve márgenes ni Configuración.",
  vendedor: "Solo sus prospectos y casos, sin documentos, sin NSS/CURP completos y sin dinero; ve sus comisiones.",
  socio: "Solo la cartera de su socio licenciatario y sus comisiones.",
};
const ETIQUETAS = { nombre: "Nombre", email: "Correo", rol: "Rol", socio_id: "Socio", telefono: "Teléfono" };

export async function SeccionUsuarios({ sesion }: { sesion: Sesion }) {
  const { usuarios, socios } = await conUsuario(sesion.claims, async (tx) => ({
    usuarios: await tx.usuario.findMany({ orderBy: [{ activo: "desc" }, { nombre: "asc" }], include: { socio: { select: { nombre: true } } } }),
    socios: await tx.socio.findMany({ where: { archivado_at: null }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
  }), sesion.ip);
  const opcionesSocio = socios.map((x) => [x.id, x.nombre] as const);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Equipo</CardTitle><span className="text-sm text-ink-muted">{usuarios.filter((u) => u.activo).length} activos</span></CardHeader>
        <CardContent>
          <ul className="divide-y divide-borde">
            {usuarios.map((u) => (
              <li key={u.id} className={`grid gap-2 py-3 ${u.activo ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{u.nombre} {u.id === sesion.usuario.id && <span className="text-xs font-normal text-ink-muted">(tú)</span>}</p>
                    <p className="text-xs text-ink-muted">{u.email}{u.telefono ? ` · ${u.telefono}` : ""}{u.socio ? ` · ${u.socio.nombre}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tono={u.rol === "director" ? "tramite" : "prospecto"}>{ROLES.find(([k]) => k === u.rol)?.[1]}</Badge>
                    {!u.activo && <Badge tono="critico">Sin acceso</Badge>}
                    {u.id !== sesion.usuario.id && (
                      <BotonAccion accion={cambiarAcceso.bind(null, u.id, !u.activo)} texto={u.activo ? "Quitar acceso" : "Dar acceso"} variante={u.activo ? "fantasma" : "secundario"}
                        confirmar={u.activo ? `¿Quitar el acceso a ${u.nombre}? No podrá entrar ni ver datos. Su historial se conserva.` : undefined} />
                    )}
                  </div>
                </div>
                <details>
                  <summary className="cursor-pointer text-xs font-medium text-brand">Editar</summary>
                  <div className="mt-2 rounded-[var(--radius-boton)] bg-slate-50 p-3">
                    <FormularioAccion accion={actualizarUsuario.bind(null, u.id)} etiquetas={ETIQUETAS}>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <CampoTexto id="nombre" etiqueta="Nombre" valor={u.nombre} />
                        <CampoTexto id="telefono" etiqueta="Teléfono" tipo="tel" valor={u.telefono} />
                        <Seleccion id="rol" etiqueta="Rol" valor={u.rol} opciones={ROLES} />
                        <Seleccion id="socio_id" etiqueta="Socio licenciatario" ayuda="solo rol socio" valor={u.socio_id} vacia="Ninguno" opciones={opcionesSocio} />
                      </div>
                    </FormularioAccion>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid content-start gap-4">
        <Card>
          <CardHeader><CardTitle>Invitar a alguien</CardTitle></CardHeader>
          <CardContent>
            <FormularioAccion accion={invitarUsuario} boton="Enviar invitación" etiquetas={ETIQUETAS}>
              <CampoTexto id="nombre" etiqueta="Nombre completo" />
              <CampoTexto id="email" etiqueta="Correo" tipo="email" />
              <CampoTexto id="telefono" etiqueta="Teléfono" ayuda="opcional" tipo="tel" />
              <Seleccion id="rol" etiqueta="Rol" valor="asesor" opciones={ROLES} />
              <Seleccion id="socio_id" etiqueta="Socio licenciatario" ayuda="solo rol socio" vacia="Ninguno" opciones={opcionesSocio} />
            </FormularioAccion>
            <p className="mt-3 text-xs text-ink-muted">Le llega un correo para definir su contraseña; al entrar, el sistema le pide activar el segundo factor (app autenticadora).</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Qué ve cada rol</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid gap-2 text-sm">
              {ROLES.map(([k, t]) => <div key={k}><dt className="font-medium text-ink">{t}</dt><dd className="text-ink-muted">{QUE_VE[k]}</dd></div>)}
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
