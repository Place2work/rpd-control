import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { CampoTexto, Seleccion } from "../../casos/[id]/campos";
import { FormularioAccion } from "../../casos/[id]/formulario-accion";
import { actualizarFicha, actualizarUsuario, cambiarAcceso, claveTemporalUsuario, crearCuentaAsesor, crearUsuarioConClave, enviarAccesoPorCorreo, restablecerDosPasos } from "../acciones";
import { BotonAccion } from "../boton-accion";
import { verComo } from "../../acciones";
import { ETIQUETA_ROL } from "@/components/rpd/navegacion";

// Llevan cuenta: Analista de expedientes, Asesor de pensiones y Director. El referidor no entra al sistema.
const ROLES = [["asesor", "Analista de expedientes"], ["socio", "Asesor de pensiones"], ["director", "Director"]] as const;
const QUE_VE: Record<string, string> = {
  director: "Todo, incluida Configuración, dinero y comisiones de todos.",
  asesor: "Todos los casos y el expediente completo; no ve márgenes ni Configuración.",
  socio: "Solo los clientes de su cartera (los que da de alta o le asignan), su dinero y sus comisiones; no ve Configuración.",
};
const ETIQUETAS = { nombre: "Nombre", email: "Correo", rol: "Rol", telefono: "Teléfono", socio_id: "Ficha del asesor" };

/** Cómo se le da acceso: invitación por correo (recomendado) o contraseña temporal que se entrega en persona. */
function OpcionAcceso() {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium text-ink">¿Cómo le das acceso?</legend>
      <label className="flex items-start gap-2 text-sm text-ink">
        <input type="radio" name="acceso" value="correo" defaultChecked className="mt-0.5 size-4" />
        <span>Enviarle invitación por correo <span className="text-ink-muted">· le llega una liga para poner su contraseña</span></span>
      </label>
      <label className="flex items-start gap-2 text-sm text-ink">
        <input type="radio" name="acceso" value="clave" className="mt-0.5 size-4" />
        <span>Darle una contraseña temporal <span className="text-ink-muted">· te la muestro y se la entregas</span></span>
      </label>
    </fieldset>
  );
}

export async function SeccionUsuarios({ sesion }: { sesion: Sesion }) {
  const { usuarios, fichas } = await conUsuario(sesion.claims, async (tx) => ({
    usuarios: await tx.usuario.findMany({ orderBy: [{ activo: "desc" }, { nombre: "asc" }],
      include: { socio: { select: { nombre: true, porcentaje_socio: true } } } }),
    // Fichas de asesores de pensiones (su reparto): se liga una a la cuenta.
    fichas: await tx.socio.findMany({ where: { archivado_at: null }, select: { id: true, nombre: true, telefono: true, porcentaje_socio: true, usuarios: { where: { activo: true }, select: { id: true } } }, orderBy: { nombre: "asc" } }),
  }), sesion.ip);
  const pctTxt = (x: number) => `${+(x * 100).toFixed(2)}%`;
  const opcionesFicha = fichas.filter((f) => f.usuarios.length === 0).map((f) => [f.id, f.nombre] as const);
  const sinCuenta = fichas.filter((f) => f.usuarios.length === 0);
  const ayudaFicha = "solo Asesor de pensiones · vacío = se crea una ficha nueva con su nombre";

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
                    <p className="text-xs text-ink-muted">{u.email}{u.telefono ? ` · ${u.telefono}` : ""}{u.rol === "socio" && u.socio ? ` · ficha ${u.socio.nombre}: ${pctTxt(Number(u.socio.porcentaje_socio))} después del costo administrativo del alta` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tono={u.rol === "director" ? "tramite" : "prospecto"}>{ETIQUETA_ROL[u.rol]}</Badge>
                    {!u.activo && <Badge tono="critico">Sin acceso</Badge>}
                    {u.activo && u.rol === "socio" && (
                      <form action={verComo.bind(null, u.id)}>
                        <button type="submit" className="h-9 rounded-[var(--radius-boton)] border border-brand px-3 text-sm font-medium text-brand hover:bg-brand-tint">Ver como</button>
                      </form>
                    )}
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
                        <Seleccion id="socio_id" etiqueta="Ficha del asesor de pensiones" ayuda={ayudaFicha} valor={u.socio_id} vacia={u.socio_id ? "La suya" : "Nueva con su nombre"} opciones={opcionesFicha} />
                      </div>
                    </FormularioAccion>
                    {u.activo && u.id !== sesion.usuario.id && (
                      <div className="mt-3 border-t border-borde pt-3">
                        <p className="mb-2 text-xs text-ink-muted">Mándale por correo una liga para poner su contraseña (sirve para un alta nueva o si la olvidó).</p>
                        <FormularioAccion accion={enviarAccesoPorCorreo.bind(null, u.id)} boton="Enviar acceso por correo"><span hidden /></FormularioAccion>
                        <p className="mb-2 mt-4 text-xs text-ink-muted">¿Prefieres dársela en persona? Genera una contraseña temporal; al entrar pondrá una nueva.</p>
                        <FormularioAccion accion={claveTemporalUsuario.bind(null, u.id)} boton="Generar contraseña temporal"><span hidden /></FormularioAccion>
                        <p className="mb-2 mt-4 text-xs text-ink-muted">¿Perdió o cambió de celular y ya no le llega el código? Esto quita su verificación en dos pasos y le da una contraseña temporal; al entrar, la activa en su celular nuevo.</p>
                        <FormularioAccion accion={restablecerDosPasos.bind(null, u.id)} boton="Restablecer verificación en dos pasos"
                          confirmar={`¿Restablecer la verificación de ${u.nombre}? Su contraseña y su celular actuales dejan de servir hasta que entre con la temporal.`}><span hidden /></FormularioAccion>
                      </div>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {sinCuenta.length > 0 && (
        <Card className="lg:col-span-2 lg:row-start-2">
          <CardHeader><CardTitle>Asesores de pensiones sin cuenta</CardTitle><span className="text-sm text-ink-muted">{sinCuenta.length}</span></CardHeader>
          <CardContent>
            <ul className="divide-y divide-borde">
              {sinCuenta.map((f) => (
                <li key={f.id} className="grid gap-2 py-3">
                  <p className="font-medium text-ink">{f.nombre} <span className="text-xs font-normal text-ink-muted">· {pctTxt(Number(f.porcentaje_socio))}{f.telefono ? ` · ${f.telefono}` : ""}</span></p>
                  <details>
                    <summary className="cursor-pointer text-xs font-medium text-brand">Editar</summary>
                    <div className="mt-2 rounded-[var(--radius-boton)] bg-slate-50 p-3">
                      <FormularioAccion accion={actualizarFicha.bind(null, f.id)} etiquetas={{ nombre: "Nombre", telefono: "Teléfono" }}>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <CampoTexto id="nombre" etiqueta="Nombre" valor={f.nombre} />
                          <CampoTexto id="telefono" etiqueta="Teléfono" tipo="tel" valor={f.telefono} />
                        </div>
                        <p className="text-xs text-ink-muted">El nombre cambia en sus casos, comisiones y estados de cuenta. Su % se ajusta en Comisiones → Referidores y asesores.</p>
                      </FormularioAccion>
                    </div>
                  </details>
                  <details>
                    <summary className="cursor-pointer text-xs font-medium text-brand">Crear su cuenta</summary>
                    <div className="mt-2 rounded-[var(--radius-boton)] bg-slate-50 p-3">
                      <FormularioAccion accion={crearCuentaAsesor.bind(null, f.id)} boton="Crear su cuenta" etiquetas={{ email: "Correo" }}>
                        <CampoTexto id="email" etiqueta="Correo" ayuda="con este entra" tipo="email" />
                        <OpcionAcceso />
                      </FormularioAccion>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid content-start gap-4 lg:row-span-2 lg:col-start-3 lg:row-start-1">
        <Card>
          <CardHeader><CardTitle>Dar de alta a alguien</CardTitle></CardHeader>
          <CardContent>
            <FormularioAccion accion={crearUsuarioConClave} boton="Dar de alta" etiquetas={ETIQUETAS} limpiar>
              <CampoTexto id="nombre" etiqueta="Nombre completo" />
              <CampoTexto id="email" etiqueta="Correo" ayuda="con este entra · asesor de pensiones: puede ir vacío" tipo="email" />
              <CampoTexto id="telefono" etiqueta="Teléfono" ayuda="opcional" tipo="tel" />
              <Seleccion id="rol" etiqueta="Rol" valor="socio" opciones={ROLES} />
              <Seleccion id="socio_id" etiqueta="Ficha del asesor de pensiones" ayuda={ayudaFicha} vacia="Nueva con su nombre" opciones={opcionesFicha} />
              <OpcionAcceso />
            </FormularioAccion>
            <p className="mt-3 text-xs text-ink-muted">Asesor de pensiones sin correo: se guarda su ficha (ya cobra comisiones) y aparece en «Asesores sin cuenta» para crearle el acceso cuando tengas su correo.</p>
            <p className="mt-2 text-xs text-ink-muted">Con invitación, le llega un correo de RetiroPorDesempleo.com para poner su contraseña. Con contraseña temporal, te la muestro una sola vez para que se la entregues. En los dos casos, al entrar activa la verificación en dos pasos (app autenticadora).</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Qué ve cada rol</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid gap-2 text-sm">
              {ROLES.map(([k, t]) => <div key={k}><dt className="font-medium text-ink">{t}</dt><dd className="text-ink-muted">{QUE_VE[k]}</dd></div>)}
              <div><dt className="font-medium text-ink">Referidores</dt><dd className="text-ink-muted">No llevan cuenta: se dan de alta en Comisiones → Referidores y asesores y se eligen en cada caso para su comisión.</dd></div>
              <p className="text-xs text-ink-muted">El % de cada asesor de pensiones se ajusta en Comisiones → Referidores y asesores.</p>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
