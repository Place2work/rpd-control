import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Encabezado } from "@/components/rpd/encabezado";
import { MODULOS } from "@/components/rpd/navegacion";
import { obtenerSesion } from "@/lib/auth/sesion";

export const metadata: Metadata = { title: "Más" };

export default async function Mas() {
  const { usuario } = await obtenerSesion();
  const resto = MODULOS.filter((m) => !m.movil && m.roles.includes(usuario.rol));
  return (
    <>
      <Encabezado titulo="Más" />
      <Card>
        <ul className="divide-y divide-borde">
          {resto.map((m) => (
            <li key={m.href}>
              <Link href={m.href} className="flex h-14 items-center gap-3 px-5 text-ink hover:bg-brand-tint">
                <m.icono className="size-5 text-brand" strokeWidth={1.5} aria-hidden />
                <span className="flex-1">{m.titulo}</span>
                <ChevronRight className="size-4 text-ink-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
