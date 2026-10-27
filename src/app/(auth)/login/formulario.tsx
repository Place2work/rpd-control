"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { crearClienteNavegador } from "@/lib/supabase/client";

export function FormularioLogin({ aviso }: { aviso?: string }) {
  const router = useRouter();
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

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
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
        <p className="text-xs text-ink-muted">Después te pediremos el código de tu app autenticadora.</p>
      </CardContent>
    </Card>
  );
}
