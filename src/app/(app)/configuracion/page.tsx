import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/rpd/encabezado";
import { exigirRol } from "@/lib/auth/sesion";
import { cn } from "@/lib/utils";
import { SeccionBitacora } from "./secciones/bitacora";
import { SeccionComisiones } from "./secciones/comisiones";
import { SeccionInhabiles } from "./secciones/inhabiles";
import { SeccionMensajes } from "./secciones/mensajes";
import { SeccionParametros } from "./secciones/parametros";
import { SeccionPlantillas } from "./secciones/plantillas";
import { SeccionUsuarios } from "./secciones/usuarios";

export const metadata: Metadata = { title: "Configuración" };

const SECCIONES = [
  ["usuarios", "Usuarios y roles"],
  ["parametros", "Parámetros"],
  ["plantillas", "Contratos y avisos"],
  ["mensajes", "Mensajes de WhatsApp"],
  ["comisiones", "Esquemas de comisión"],
  ["inhabiles", "Días inhábiles"],
  ["bitacora", "Bitácora"],
] as const;
type Seccion = (typeof SECCIONES)[number][0];

// 10.9: solo el Director. Cada cambio queda en la bitácora; lo que tiene vigencia nunca cambia hacia atrás.
export default async function Configuracion({ searchParams }: { searchParams: Promise<{ seccion?: string; filtro?: string }> }) {
  const sesion = await exigirRol("director");
  const q = await searchParams;
  const seccion: Seccion = SECCIONES.some(([k]) => k === q.seccion) ? (q.seccion as Seccion) : "usuarios";

  return (
    <>
      <Encabezado titulo="Configuración" descripcion="Equipo, parámetros con vigencia, plantillas, comisiones, días inhábiles y bitácora." />
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Secciones de configuración" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <ul className="flex gap-1 lg:flex-col">
            {SECCIONES.map(([k, t]) => (
              <li key={k}>
                <Link href={`/configuracion?seccion=${k}`} aria-current={k === seccion ? "page" : undefined}
                  className={cn("block whitespace-nowrap rounded-[var(--radius-boton)] px-3 py-2 text-sm", k === seccion ? "bg-brand-tint font-medium text-brand" : "text-ink-muted hover:text-ink")}>{t}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          {seccion === "usuarios" && <SeccionUsuarios sesion={sesion} />}
          {seccion === "parametros" && <SeccionParametros sesion={sesion} />}
          {seccion === "plantillas" && <SeccionPlantillas sesion={sesion} />}
          {seccion === "mensajes" && <SeccionMensajes sesion={sesion} />}
          {seccion === "comisiones" && <SeccionComisiones sesion={sesion} />}
          {seccion === "inhabiles" && <SeccionInhabiles sesion={sesion} />}
          {seccion === "bitacora" && <SeccionBitacora sesion={sesion} filtro={q.filtro ?? ""} />}
        </div>
      </div>
    </>
  );
}
