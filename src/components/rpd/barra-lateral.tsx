"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Rol } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { Marca } from "./marca";
import { MODULOS } from "./navegacion";

const activo = (ruta: string, href: string) => ruta === href || ruta.startsWith(`${href}/`);

// Barra lateral azul oscuro con elemento activo marcado por barra verde de 3 px (11.3).
export function BarraLateral({ rol }: { rol: Rol }) {
  const ruta = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-brand-dark md:flex">
      <div className="px-6 py-6">
        <Marca variante="blanco" />
      </div>
      <nav aria-label="Módulos" className="flex flex-1 flex-col gap-0.5 px-3">
        {MODULOS.filter((m) => m.roles.includes(rol)).map((m) => {
          const a = activo(ruta, m.href);
          return (
            <Link
              key={m.href}
              href={m.href}
              aria-current={a ? "page" : undefined}
              className={cn(
                "relative flex h-10 items-center gap-3 rounded-md px-3 text-sm text-white/80 hover:bg-white/10 hover:text-white",
                a && "bg-white/10 font-medium text-white",
              )}
            >
              {a && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-exito" aria-hidden />}
              <m.icono className="size-5" strokeWidth={1.5} aria-hidden />
              {m.titulo}
            </Link>
          );
        })}
      </nav>
      <p className="px-6 py-4 text-xs text-white/50">RPD Control · fase 2</p>
    </aside>
  );
}

export function BarraInferior({ rol }: { rol: Rol }) {
  const ruta = usePathname();
  const principales = MODULOS.filter((m) => m.movil && m.roles.includes(rol));
  const enMas = !principales.some((m) => activo(ruta, m.href));
  return (
    <nav aria-label="Módulos" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-borde bg-surface md:hidden">
      {principales.map((m) => {
        const a = activo(ruta, m.href);
        return (
          <Link key={m.href} href={m.href} aria-current={a ? "page" : undefined}
            className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px]", a ? "font-medium text-brand" : "text-ink-muted")}>
            <m.icono className="size-5" strokeWidth={1.5} aria-hidden />
            {m.titulo}
          </Link>
        );
      })}
      <Link href="/mas" aria-current={enMas ? "page" : undefined}
        className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px]", enMas ? "font-medium text-brand" : "text-ink-muted")}>
        <MoreHorizontal className="size-5" strokeWidth={1.5} aria-hidden />
        Más
      </Link>
    </nav>
  );
}
