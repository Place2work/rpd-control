import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatoFecha, isoDe } from "@/components/rpd/insignia-dia46";
import { LigasConsulta } from "@/components/rpd/ligas-consulta";
import type { Sesion } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { ligasConsulta } from "@/lib/parametros";
import { PARENTESCOS } from "@/lib/prospectos/referencias";
import type { CasoDetalle } from "@/lib/prospectos/consultas";
import { enmascararNss } from "@/lib/reglas/identificadores";
import { guardarDatosPersonales } from "../acciones";
import { guardarReferencia, quitarReferencia } from "../acciones-referencias";
import { CampoTexto, Casilla, Dato, Seleccion } from "../campos";
import { DatoSensible } from "../dato-sensible";
import { FormularioAccion } from "../formulario-accion";
import { DomicilioCampos } from "../domicilio-campos";

const ESTADO_CIVIL = [["soltero", "Soltero(a)"], ["casado", "Casado(a)"], ["union_libre", "Unión libre"], ["divorciado", "Divorciado(a)"], ["viudo", "Viudo(a)"]] as const;
const SI_NO = [["si", "Sí"], ["no", "No"], ["no_sabe", "No sabe"]] as const;
const ETIQUETAS = { codigo_postal: "Código postal", calle: "Calle", domicilio: "Domicilio", nombre: "Nombre", whatsapp: "WhatsApp", email: "Correo", curp: "CURP", nss: "NSS" };
const local = (e164: string | null) => (e164 ? e164.replace(/^\+52/, "") : "");

const ETIQUETAS_REF = { nombre: "Nombre completo", telefono: "Teléfono", parentesco: "Parentesco", domicilio: "Domicilio", anios_conocerlo: "Años de conocerlo", notas: "Notas" };

export async function PestanaDatos({ caso, sesion, puedeVer }: { caso: CasoDetalle; sesion: Sesion; puedeVer: boolean }) {
  const p = caso.persona;
  const [ligas, refs] = await Promise.all([
    ligasConsulta(),
    conUsuario(sesion.claims, async (tx) => {
      const lista = await tx.referenciaPersonal.findMany({ where: { persona_id: p.id, archivado_at: null }, orderBy: { orden: "asc" } });
      const ids = [...new Set(lista.map((r) => r.confirmada_por).filter((x): x is string => Boolean(x)))];
      const quienes = ids.length ? await tx.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true } }) : [];
      return { lista, quien: new Map(quienes.map((u) => [u.id, u.nombre])) };
    }, sesion.ip),
  ]);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Datos personales</CardTitle></CardHeader>
        <CardContent className="grid gap-6">
          <dl className="grid gap-x-6 gap-y-3 rounded-md bg-slate-50 p-4 text-sm sm:grid-cols-2">
            <Dato titulo="CURP" valor={<DatoSensible personaId={p.id} campo="curp" enmascarado={p.curp_parcial} puedeVer={puedeVer} />} />
            <Dato titulo="NSS" valor={<DatoSensible personaId={p.id} campo="nss" enmascarado={p.nss_ultimos4 ? enmascararNss(p.nss_ultimos4) : null} puedeVer={puedeVer} />} />
            <Dato titulo="Fecha de nacimiento" valor={isoDe(p.fecha_nacimiento) ? formatoFecha(isoDe(p.fecha_nacimiento)!, { dateStyle: "long" }) : "Sale de la CURP"} />
            <Dato titulo="Aviso de privacidad" valor={p.privacidad_aceptada_at ? `Aceptado (versión ${p.privacidad_version ?? "—"})` : "Pendiente"} />
          </dl>
          <FormularioAccion accion={guardarDatosPersonales.bind(null, caso.id, p.id)} etiquetas={ETIQUETAS}>
            <div className="grid gap-4 sm:grid-cols-3">
              <CampoTexto id="nombre" etiqueta="Nombre(s)" placeholder="Sin apellidos" valor={p.nombre} required />
              <CampoTexto id="apellido_paterno" etiqueta="Apellido paterno" valor={p.apellido_paterno} />
              <CampoTexto id="apellido_materno" etiqueta="Apellido materno" valor={p.apellido_materno} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoTexto id="whatsapp" etiqueta="WhatsApp" ayuda="10 dígitos · opcional" tipo="tel" inputMode="tel" valor={local(p.whatsapp)} />
              <CampoTexto id="email" etiqueta="Correo" tipo="email" valor={p.email} />
              <CampoTexto id="curp" etiqueta="CURP nueva" ayuda="solo si cambia; se guarda cifrada" maxLength={18} className="font-mono" />
              <CampoTexto id="nss" etiqueta="NSS nuevo" ayuda="solo si cambia; se guarda cifrado" inputMode="numeric" maxLength={13} />
              <DomicilioCampos inicial={{ calle: p.calle, numeroExterior: p.numero_exterior, numeroInterior: p.numero_interior, colonia: p.colonia,
                codigoPostal: p.codigo_postal, municipio: p.municipio, estado: p.estado, domicilio: p.domicilio }} />
              <Seleccion id="estado_civil" etiqueta="Estado civil" valor={p.estado_civil} vacia="Sin capturar" opciones={ESTADO_CIVIL} />
              <Seleccion id="beneficiarios_designados" etiqueta="¿Tiene beneficiarios designados?" valor={p.beneficiarios_designados} opciones={SI_NO} />
            </div>
            {!p.privacidad_aceptada_at && <Casilla id="privacidad" etiqueta="El cliente recibió y aceptó el aviso de privacidad" />}
          </FormularioAccion>
        </CardContent>
      </Card>
      <Card className="lg:order-last lg:col-span-3">
        <CardHeader><CardTitle>Referencias personales</CardTitle><span className="text-sm text-ink-muted">{refs.lista.length} de 2</span></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {([1, 2] as const).map((orden) => {
            const r = refs.lista.find((x) => x.orden === orden);
            return (
              <div key={orden} className="grid content-start gap-3 rounded-[var(--radius-boton)] border border-borde p-4">
                <p className="text-sm font-medium text-ink">Referencia {orden}
                  {r?.confirmada_at && <span className="ml-2 text-xs font-normal text-exito-texto">✓ Confirmada el {formatoFecha(isoDe(r.confirmada_at)!)}{r.confirmada_por && refs.quien.get(r.confirmada_por) ? ` por ${refs.quien.get(r.confirmada_por)}` : ""}</span>}
                </p>
                <FormularioAccion accion={guardarReferencia.bind(null, caso.id, p.id, orden)} etiquetas={ETIQUETAS_REF}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <CampoTexto id="nombre" etiqueta="Nombre completo" placeholder="Nombre y apellidos" valor={r?.nombre} className="sm:col-span-2" required />
                    <CampoTexto id="telefono" etiqueta="Teléfono" ayuda="10 dígitos" tipo="tel" inputMode="tel" valor={local(r?.telefono ?? null)} required />
                    <Seleccion id="parentesco" etiqueta="Parentesco" valor={r?.parentesco ?? ""} vacia="Elige…" opciones={PARENTESCOS} />
                    <CampoTexto id="domicilio" etiqueta="Domicilio" ayuda="calle, número, colonia y municipio" valor={r?.domicilio} className="sm:col-span-2" />
                    <CampoTexto id="anios_conocerlo" etiqueta="Años de conocerlo" ayuda="opcional" inputMode="numeric" valor={r?.anios_conocerlo} />
                    <CampoTexto id="notas" etiqueta="Notas" ayuda="opcional" placeholder="Horario para llamar, etc." valor={r?.notas} />
                  </div>
                  <Casilla id="confirmada" etiqueta="Ya le llamé y confirmó que conoce al cliente" marcada={Boolean(r?.confirmada_at)} />
                </FormularioAccion>
                {r && (
                  <FormularioAccion accion={quitarReferencia.bind(null, caso.id, p.id, orden)} boton="Quitar esta referencia"
                    confirmar={`¿Quitar la referencia ${orden} (${r.nombre})? Queda en la bitácora.`} className="[&_button]:bg-transparent [&_button]:px-0 [&_button]:text-critico [&_button]:hover:underline">
                    <span className="sr-only">Quitar referencia {orden}</span>
                  </FormularioAccion>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Consultas oficiales</CardTitle></CardHeader>
        <CardContent className="pt-2"><LigasConsulta ligas={ligas} /></CardContent>
      </Card>
    </div>
  );
}
