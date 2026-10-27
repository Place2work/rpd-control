"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";

const LIMITE_MS = 30 * 60 * 1000; // sección 12: cierre por inactividad a los 30 minutos

// Respaldo en el navegador; el límite de sesión de 12 h y el de inactividad también
// se configuran en Supabase Auth → Sessions.
export function CierrePorInactividad({ demo }: { demo: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (demo) return;
    let t: ReturnType<typeof setTimeout>;
    const reiniciar = () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        await crearClienteNavegador().auth.signOut();
        router.replace("/login?motivo=inactividad");
      }, LIMITE_MS);
    };
    const eventos = ["pointerdown", "keydown", "scroll", "visibilitychange"] as const;
    eventos.forEach((e) => window.addEventListener(e, reiniciar, { passive: true }));
    reiniciar();
    return () => {
      clearTimeout(t);
      eventos.forEach((e) => window.removeEventListener(e, reiniciar));
    };
  }, [demo, router]);
  return null;
}
