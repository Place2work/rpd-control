import { LogOut } from "lucide-react";
import { Suspense } from "react";
import { BarraInferior, BarraLateral } from "@/components/rpd/barra-lateral";
import { CierrePorInactividad } from "@/components/rpd/inactividad";
import { Marca } from "@/components/rpd/marca";
import { ETIQUETA_ROL } from "@/components/rpd/navegacion";
import { modoDemo } from "@/lib/auth/demo";
import { obtenerSesion } from "@/lib/auth/sesion";
import { cerrarSesion } from "./acciones";

// Toda pantalla de la app depende del usuario (rol, RLS), así que la navegación espera
// a la sesión en el servidor. Guía de Next 16 "Authentication with Cache Components".
export const instant = false;

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Cargando />}>
      <Estructura>{children}</Estructura>
    </Suspense>
  );
}

// La página solo se pinta después de verificar la sesión con 2FA.
async function Estructura({ children }: { children: React.ReactNode }) {
  const { usuario } = await obtenerSesion();
  const demo = modoDemo();
  return (
    <>
      <BarraLateral rol={usuario.rol} />
      <div className="md:pl-60">
        <div className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-borde bg-surface/95 px-4 backdrop-blur md:px-8">
          <Marca className="origin-left scale-90 md:invisible" />
          <div className="flex items-center gap-3">
            {demo && <span className="hidden rounded-full bg-aviso-tint px-2.5 py-0.5 text-xs font-medium text-aviso sm:inline">Modo demostración</span>}
            <div className="text-right leading-tight">
              <p className="text-sm font-medium text-ink">{usuario.nombre}</p>
              <p className="text-xs text-ink-muted">{ETIQUETA_ROL[usuario.rol]}</p>
            </div>
            <form action={cerrarSesion}>
              <button type="submit" className="flex size-11 items-center justify-center rounded-md text-ink-muted hover:bg-brand-tint hover:text-brand md:size-9" title="Cerrar sesión">
                <LogOut className="size-5" strokeWidth={1.5} aria-hidden />
                <span className="sr-only">Cerrar sesión</span>
              </button>
            </form>
          </div>
        </div>
        <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 md:px-8 md:pb-10">
          <Suspense fallback={<p className="text-sm text-ink-muted">Cargando…</p>}>{children}</Suspense>
        </main>
      </div>
      <BarraInferior rol={usuario.rol} />
      <CierrePorInactividad demo={demo} />
    </>
  );
}

function Cargando() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Marca />
    </div>
  );
}
