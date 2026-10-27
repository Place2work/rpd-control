import type { Metadata } from "next";
import { Encabezado } from "@/components/rpd/encabezado";
import { obtenerSesion } from "@/lib/auth/sesion";
import { ligasConsulta } from "@/lib/parametros";
import { opcionesAlta } from "@/lib/prospectos/consultas";
import { hoyCDMX } from "@/lib/tiempo";
import { FormularioAlta } from "./formulario-alta";

export const metadata: Metadata = { title: "Alta rápida" };

export default async function NuevoProspecto() {
  const sesion = await obtenerSesion();
  const [opciones, ligas] = await Promise.all([opcionesAlta(sesion), ligasConsulta()]);
  return (
    <>
      <Encabezado titulo="Alta rápida" descripcion="Nombre y WhatsApp bastan. Lo demás se completa después." />
      <FormularioAlta servicios={opciones.servicios} referidores={opciones.referidores} ligas={ligas} hoy={hoyCDMX()} />
    </>
  );
}
