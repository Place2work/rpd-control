import type { Metadata } from "next";
import { Encabezado } from "@/components/rpd/encabezado";
import { exigirRol } from "@/lib/auth/sesion";
import { conUsuario } from "@/lib/db/prisma";
import { fotoEquipo } from "@/lib/equipo/datos";
import { EquipoEnVivo } from "./en-vivo";

export const metadata: Metadata = { title: "Equipo en vivo" };

// El equipo trabajando, en 3D y en vivo: cada departamento con su gente y lo que hace hoy (sin datos de clientes).
export default async function Equipo() {
  const s = await exigirRol("director");
  const inicial = await conUsuario(s.claims, (tx) => fotoEquipo(tx), s.ip);
  return (
    <>
      <Encabezado titulo="Equipo en vivo" descripcion="Tu equipo trabajando, por departamento. Cada vez que alguien registra, verifica, avanza o cobra un caso, lo ves aquí al momento." />
      <EquipoEnVivo inicial={inicial} />
    </>
  );
}
