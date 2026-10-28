import { Bell, LogOut } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { BarraInferior, BarraLateral } from "@/components/rpd/barra-lateral";
import { CierrePorInactividad } from "@/components/rpd/inactividad";
import { Marca } from "@/components/rpd/marca";
import { ETIQUETA_ROL } from "@/components/rpd/navegacion";
import { modoDemo } from "@/lib/auth/demo";
import { contarMisAlertas } from "@/lib/alertas/consultas";
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
  const sesion = await obtenerSesion();
  const { usuario } = sesion;
  const demo = modoDemo();
  const alertas = await contarMisAlertas(sesion).catch(() => ({ total: 0, criticas: 0 }));
  return (
    <>
      <BarraLateral rol={usuario.rol} />
      <div className="md:pl-60">
        <div className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-borde bg-surface/95 px-4 backdrop-blur md:px-8">
          <Marca className="origin-left scale-90 md:invisible" />
          <div className="flex items-center gap-3">
            {demo && <span className="hidden rounded-full bg-aviso-tint px-2.5 py-0.5 text-xs font-medium text-aviso sm:inline">Modo demostración</span>}
            <Link href="/hoy#alertas" className="relative flex size-11 items-center justify-center rounded-md text-ink-muted hover:bg-brand-tint hover:text-brand md:size-9"
              title={alertas.total ? `${alertas.total} alertas pendientes` : "Sin alertas pendientes"}>
              <Bell className="size-5" strokeWidth={1.5} aria-hidden />
              {alertas.total > 0 && (
                <span className={`cifra absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white ${alertas.criticas ? "bg-critico" : "bg-aviso"}`}>
                  {alertas.total > 99 ? "99+" : alertas.total}
                </span>
              )}
              <span className="sr-only">{alertas.total} alertas pendientes{alertas.criticas ? `, ${alertas.criticas} críticas` : ""}</span>
            </Link>
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
