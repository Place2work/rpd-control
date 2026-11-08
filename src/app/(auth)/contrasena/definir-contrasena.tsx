"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { MINIMO_CLAVE as MINIMO } from "@/lib/auth/clave";
import { cambiarClaveTemporal } from "./acciones";
import { InputClave } from "@/components/ui/input-clave";

// Primera contraseña (invitación), cambio por recuperación o reemplazo de la temporal que dio el
// Director (`temporal`: se guarda desde el servidor). Si la cuenta ya tiene 2FA, Supabase exige
// verificarlo antes de cambiar la contraseña.
export function DefinirContrasena({ temporal = false }: { temporal?: boolean }) {
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
    if (temporal) {
      const r = await cambiarClaveTemporal(nueva, String(form.get("confirmacion")));
      if (r.error) { setEnviando(false); return setError(r.error); }
      // Al cambiar la contraseña, Supabase cierra las sesiones de la cuenta por seguridad: si la sesión ya no
      // se puede renovar, se entra de nuevo con la contraseña nueva (nunca se queda en «Guardando…»).
      try {
        const { error: e } = await supabase.auth.refreshSession();
        if (!e) return router.replace("/hoy");
      } catch { /* sesión revocada */ }
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      return router.replace("/login?motivo=clave-lista");
    }
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
        {temporal && <p className="text-sm text-ink-muted">Entraste con una contraseña temporal. Pon una que solo tú conozcas para continuar.</p>}
        {!listo ? (
          <p className="text-sm text-ink-muted">Cargando…</p>
        ) : (
          <form action={guardar} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nueva">Contraseña nueva</Label>
              <InputClave id="nueva" name="nueva" autoComplete="new-password" minLength={MINIMO} required />
              <p className="text-xs text-ink-muted">Mínimo {MINIMO} caracteres. Una frase larga es más segura y fácil de recordar.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmacion">Repítela</Label>
              <InputClave id="confirmacion" name="confirmacion" autoComplete="new-password" required />
            </div>
            {error && <p role="alert" className="text-sm text-critico">{error}</p>}
            <Button type="submit" disabled={enviando}>{enviando ? "Guardando…" : "Guardar y continuar"}</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
