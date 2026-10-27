"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { crearClienteNavegador } from "@/lib/supabase/client";

const MINIMO = 12;

// Primera contraseña (invitación) o cambio por recuperación. Si la cuenta ya tiene
// 2FA, Supabase exige verificarlo antes de cambiar la contraseña.
export function DefinirContrasena() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const supabase = crearClienteNavegador();
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return router.replace("/login");
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (data?.nextLevel === "aal2" && data.currentLevel !== "aal2") return router.replace("/mfa?siguiente=/contrasena");
      setListo(true);
    })();
  }, [router]);

  async function guardar(form: FormData) {
    const nueva = String(form.get("nueva"));
    if (nueva.length < MINIMO) return setError(`Usa al menos ${MINIMO} caracteres.`);
    if (nueva !== String(form.get("confirmacion"))) return setError("Las contraseñas no coinciden.");
    setEnviando(true);
    setError(null);
    const supabase = crearClienteNavegador();
    const { error } = await supabase.auth.updateUser({ password: nueva });
    setEnviando(false);
    if (error) return setError("No pudimos guardar la contraseña. Intenta con otra o pide una liga nueva.");
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    router.replace(data?.currentLevel === "aal2" ? "/hoy" : "/mfa");
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <h1 className="font-display text-[22px] font-semibold">Define tu contraseña</h1>
        {!listo ? (
          <p className="text-sm text-ink-muted">Cargando…</p>
        ) : (
          <form action={guardar} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nueva">Contraseña nueva</Label>
              <Input id="nueva" name="nueva" type="password" autoComplete="new-password" minLength={MINIMO} required />
              <p className="text-xs text-ink-muted">Mínimo {MINIMO} caracteres. Una frase larga es más segura y fácil de recordar.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmacion">Repítela</Label>
              <Input id="confirmacion" name="confirmacion" type="password" autoComplete="new-password" required />
            </div>
            {error && <p role="alert" className="text-sm text-critico">{error}</p>}
            <Button type="submit" disabled={enviando}>{enviando ? "Guardando…" : "Guardar y continuar"}</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
