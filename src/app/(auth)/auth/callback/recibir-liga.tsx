"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { crearClienteNavegador } from "@/lib/supabase/client";

type TipoLiga = "invite" | "recovery" | "signup" | "magiclink" | "email";

// Destino de las ligas que manda Supabase por correo (invitación y recuperación de
// contraseña). Acepta los tres formatos: #access_token (implícito), ?code (PKCE) y
// ?token_hash (plantilla SSR). Después manda a definir contraseña.
export function RecibirLiga() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = crearClienteNavegador();
    (async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.slice(1));
      const errorLiga = hash.get("error_description") ?? url.searchParams.get("error_description");
      if (errorLiga) return setError("La liga ya expiró o ya se usó. Pide una nueva desde el inicio de sesión.");

      let tipo = (hash.get("type") ?? url.searchParams.get("type")) as TipoLiga | null;
      let fallo: unknown = null;

      if (hash.get("access_token") && hash.get("refresh_token")) {
        ({ error: fallo } = await supabase.auth.setSession({
          access_token: hash.get("access_token")!,
          refresh_token: hash.get("refresh_token")!,
        }));
      } else if (url.searchParams.get("code")) {
        ({ error: fallo } = await supabase.auth.exchangeCodeForSession(url.searchParams.get("code")!));
        tipo ??= "recovery";
      } else if (url.searchParams.get("token_hash") && tipo) {
        ({ error: fallo } = await supabase.auth.verifyOtp({ token_hash: url.searchParams.get("token_hash")!, type: tipo }));
      } else {
        return setError("Esta liga no es válida. Pide una nueva desde el inicio de sesión.");
      }

      if (fallo) return setError("La liga ya expiró o ya se usó. Pide una nueva desde el inicio de sesión.");
      // Quita los tokens de la barra de direcciones antes de seguir.
      window.history.replaceState(null, "", "/auth/callback");
      router.replace(tipo === "invite" || tipo === "recovery" ? "/contrasena" : "/mfa");
    })();
  }, [router]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h1 className="font-display text-[22px] font-semibold">{error ? "No pudimos abrir tu liga" : "Verificando tu liga…"}</h1>
        {error && (
          <>
            <p role="alert" className="text-sm text-critico">{error}</p>
            <a href="/login" className="text-sm font-medium text-brand underline">Ir al inicio de sesión</a>
          </>
        )}
      </CardContent>
    </Card>
  );
}
