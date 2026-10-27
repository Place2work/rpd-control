"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { crearClienteNavegador } from "@/lib/supabase/client";

export function FormularioLogin({ aviso }: { aviso?: string }) {
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "recuperar" | "enviado">("entrar");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(form: FormData) {
    setEnviando(true);
    setError(null);
    const { error } = await crearClienteNavegador().auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setEnviando(false);
    if (error) return setError("Correo o contraseña incorrectos.");
    router.replace("/mfa");
  }

  // La respuesta es la misma exista o no la cuenta, para no revelar qué correos están registrados.
  async function recuperar(form: FormData) {
    setEnviando(true);
    await crearClienteNavegador().auth.resetPasswordForEmail(String(form.get("email")), {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setEnviando(false);
    setModo("enviado");
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {modo === "entrar" && (
          <>
            <h1 className="font-display text-[22px] font-semibold">Inicia sesión</h1>
            {aviso && <p className="rounded-md bg-aviso-tint px-3 py-2 text-sm text-aviso">{aviso}</p>}
            <form action={entrar} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Correo</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" name="password" type="password" autoComplete="current-password" required />
              </div>
              {error && <p role="alert" className="text-sm text-critico">{error}</p>}
              <Button type="submit" disabled={enviando}>{enviando ? "Entrando…" : "Continuar"}</Button>
            </form>
            <button type="button" onClick={() => setModo("recuperar")} className="self-start text-sm font-medium text-brand hover:underline">
              ¿Olvidaste tu contraseña o es tu primera vez?
            </button>
            <p className="text-xs text-ink-muted">Después te pediremos el código de tu app autenticadora.</p>
          </>
        )}
        {modo === "recuperar" && (
          <>
            <h1 className="font-display text-[22px] font-semibold">Define tu contraseña</h1>
            <p className="text-sm text-ink-muted">Te mandamos una liga a tu correo para crear una contraseña nueva.</p>
            <form action={recuperar} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email-recuperar">Correo</Label>
                <Input id="email-recuperar" name="email" type="email" autoComplete="email" required />
              </div>
              <Button type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Enviar liga"}</Button>
            </form>
            <button type="button" onClick={() => setModo("entrar")} className="self-start text-sm font-medium text-brand hover:underline">
              Regresar
            </button>
          </>
        )}
        {modo === "enviado" && (
          <>
            <h1 className="font-display text-[22px] font-semibold">Revisa tu correo</h1>
            <p className="text-sm text-ink-muted">
              Si el correo está registrado, te llegará una liga en unos minutos. Revisa también la carpeta de spam.
            </p>
            <button type="button" onClick={() => setModo("entrar")} className="self-start text-sm font-medium text-brand hover:underline">
              Regresar al inicio de sesión
            </button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
