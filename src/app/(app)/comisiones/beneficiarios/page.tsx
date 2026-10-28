import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { exigirRol } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { mxn } from "@/lib/formato";
import { CampoTexto } from "../../casos/[id]/campos";
import { FormularioAccion } from "../../casos/[id]/formulario-accion";
import { crearReferidor, crearSocio } from "../acciones";

export const metadata: Metadata = { title: "Referidores y socios" };

const ETIQUETAS = { nombre: "Nombre", telefono: "Teléfono", email: "Correo", banco: "Banco", clabe: "CLABE", razon_social: "Razón social", rfc: "RFC", porcentaje_socio: "% del socio", costo_administrativo: "Costo administrativo" };

export default async function Beneficiarios() {
  const sesion = await exigirRol("director", "asesor");
  const director = sesion.usuario.rol === "director";
  const { referidores, socios } = await conUsuario(sesion.claims, async (tx) => ({
    referidores: await tx.referidor.findMany({ where: { archivado_at: null }, select: { id: true, nombre: true, telefono: true, banco: true, clabe_ultimos4: true, _count: { select: { casos: true } } }, orderBy: { nombre: "asc" } }),
    socios: await tx.socio.findMany({ where: { archivado_at: null }, select: { id: true, nombre: true, rfc: true, porcentaje_socio: true, costo_administrativo: true, clabe_ultimos4: true, _count: { select: { casos: true } } }, orderBy: { nombre: "asc" } }),
  }), sesion.ip);

  return (
    <>
      <Encabezado titulo="Referidores y socios" descripcion="La CLABE se guarda cifrada; aquí solo ves los últimos 4 dígitos.">
        <Link href="/comisiones" className="text-sm text-brand underline">Volver a Comisiones</Link>
      </Encabezado>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Referidores</CardTitle><span className="text-sm text-ink-muted">{referidores.length}</span></CardHeader>
          <CardContent className="grid gap-4">
            <ul className="divide-y divide-borde text-sm">
              {referidores.map((r) => (
                <li key={r.id} className="flex justify-between gap-2 py-2">
                  <span><span className="font-medium text-ink">{r.nombre}</span><span className="block text-xs text-ink-muted">{[r.telefono, r.banco, r.clabe_ultimos4 && `CLABE ···${r.clabe_ultimos4}`].filter(Boolean).join(" · ") || "Sin datos de pago"}</span></span>
                  <span className="text-xs text-ink-muted">{r._count.casos} {r._count.casos === 1 ? "caso" : "casos"}</span>
                </li>
              ))}
            </ul>
            <details>
              <summary className="cursor-pointer text-sm font-medium text-brand">Nuevo referidor</summary>
              <div className="mt-3">
                <FormularioAccion accion={crearReferidor} boton="Dar de alta" etiquetas={ETIQUETAS}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <CampoTexto id="nombre" etiqueta="Nombre" />
                    <CampoTexto id="telefono" etiqueta="Teléfono" tipo="tel" />
                    <CampoTexto id="email" etiqueta="Correo" tipo="email" />
                    <CampoTexto id="banco" etiqueta="Banco" />
                    <CampoTexto id="clabe" etiqueta="CLABE" ayuda="18 dígitos" inputMode="numeric" className="sm:col-span-2" />
                  </div>
                </FormularioAccion>
              </div>
            </details>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Socios licenciatarios</CardTitle><span className="text-sm text-ink-muted">{socios.length}</span></CardHeader>
          <CardContent className="grid gap-4">
            <ul className="divide-y divide-borde text-sm">
              {socios.map((s) => (
                <li key={s.id} className="flex justify-between gap-2 py-2">
                  <span><span className="font-medium text-ink">{s.nombre}</span>
                    <span className="block text-xs text-ink-muted">{Number(s.porcentaje_socio) * 100}% después de {mxn(s.costo_administrativo)} administrativos{s.rfc ? ` · ${s.rfc}` : ""}{s.clabe_ultimos4 ? ` · CLABE ···${s.clabe_ultimos4}` : ""}</span></span>
                  <span className="text-xs text-ink-muted">{s._count.casos} {s._count.casos === 1 ? "caso" : "casos"}</span>
                </li>
              ))}
            </ul>
            {director && (
              <details>
                <summary className="cursor-pointer text-sm font-medium text-brand">Nuevo socio</summary>
                <div className="mt-3">
                  <FormularioAccion accion={crearSocio} boton="Dar de alta" etiquetas={ETIQUETAS}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <CampoTexto id="nombre" etiqueta="Nombre" />
                      <CampoTexto id="razon_social" etiqueta="Razón social" ayuda="opcional" />
                      <CampoTexto id="rfc" etiqueta="RFC" ayuda="opcional" />
                      <CampoTexto id="telefono" etiqueta="Teléfono" tipo="tel" />
                      <CampoTexto id="email" etiqueta="Correo" tipo="email" />
                      <CampoTexto id="banco" etiqueta="Banco" />
                      <CampoTexto id="clabe" etiqueta="CLABE" ayuda="18 dígitos" inputMode="numeric" />
                      <CampoTexto id="porcentaje_socio" etiqueta="% del socio" valor="40" inputMode="decimal" />
                      <CampoTexto id="costo_administrativo" etiqueta="Costo administrativo" valor="500" inputMode="decimal" />
                    </div>
                  </FormularioAccion>
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
