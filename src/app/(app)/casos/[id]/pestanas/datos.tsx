import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatoFecha, isoDe } from "@/components/rpd/insignia-dia46";
import { LigasConsulta } from "@/components/rpd/ligas-consulta";
import { ligasConsulta } from "@/lib/parametros";
import type { CasoDetalle } from "@/lib/prospectos/consultas";
import { enmascararNss } from "@/lib/reglas/identificadores";
import { guardarDatosPersonales } from "../acciones";
import { CampoTexto, Casilla, Dato, Seleccion } from "../campos";
import { DatoSensible } from "../dato-sensible";
import { FormularioAccion } from "../formulario-accion";

const ESTADO_CIVIL = [["soltero", "Soltero(a)"], ["casado", "Casado(a)"], ["union_libre", "Unión libre"], ["divorciado", "Divorciado(a)"], ["viudo", "Viudo(a)"]] as const;
const SI_NO = [["si", "Sí"], ["no", "No"], ["no_sabe", "No sabe"]] as const;
const ETIQUETAS = { nombre: "Nombre", whatsapp: "WhatsApp", email: "Correo", curp: "CURP", nss: "NSS" };
const local = (e164: string | null) => (e164 ? e164.replace(/^\+52/, "") : "");

export async function PestanaDatos({ caso, puedeVer }: { caso: CasoDetalle; puedeVer: boolean }) {
  const ligas = await ligasConsulta();
  const p = caso.persona;
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
              <CampoTexto id="nombre" etiqueta="Nombre" valor={p.nombre} required />
              <CampoTexto id="apellido_paterno" etiqueta="Apellido paterno" valor={p.apellido_paterno} />
              <CampoTexto id="apellido_materno" etiqueta="Apellido materno" valor={p.apellido_materno} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoTexto id="whatsapp" etiqueta="WhatsApp" tipo="tel" inputMode="tel" valor={local(p.whatsapp)} required />
              <CampoTexto id="email" etiqueta="Correo" tipo="email" valor={p.email} />
              <CampoTexto id="curp" etiqueta="CURP nueva" ayuda="solo si cambia; se guarda cifrada" maxLength={18} className="font-mono" />
              <CampoTexto id="nss" etiqueta="NSS nuevo" ayuda="solo si cambia; se guarda cifrado" inputMode="numeric" maxLength={13} />
              <CampoTexto id="municipio" etiqueta="Municipio" valor={p.municipio} />
              <CampoTexto id="estado" etiqueta="Estado" valor={p.estado} />
              <Seleccion id="estado_civil" etiqueta="Estado civil" valor={p.estado_civil} vacia="Sin capturar" opciones={ESTADO_CIVIL} />
              <Seleccion id="beneficiarios_designados" etiqueta="¿Tiene beneficiarios designados?" valor={p.beneficiarios_designados} opciones={SI_NO} />
            </div>
            {!p.privacidad_aceptada_at && <Casilla id="privacidad" etiqueta="El cliente recibió y aceptó el aviso de privacidad" />}
          </FormularioAccion>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Consultas oficiales</CardTitle></CardHeader>
        <CardContent className="pt-2"><LigasConsulta ligas={ligas} /></CardContent>
      </Card>
    </div>
  );
}
