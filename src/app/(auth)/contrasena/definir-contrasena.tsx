"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { MINIMO_CLAVE as MINIMO, REQUISITOS_CLAVE, validarClave } from "@/lib/auth/clave";
import { cambiarClavePropia, cambiarClaveTemporal } from "./acciones";
import { InputClave } from "@/components/ui/input-clave";

// Primera contraseña (invitación), cambio por recuperación o reemplazo de la temporal que dio el
// Director (`temporal`: se guarda desde el servidor). Si la cuenta ya tiene 2FA, Supabase exige
// verificarlo antes de cambiar la contraseña.
/** Si Supabase no responde en unos segundos, se sigue sin esperar más (la contraseña ya quedó guardada en el servidor). */
const conLimite = <T,>(p: Promise<T>, ms = 5000) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error("tiempo")), ms))]);

export function DefinirContrasena({ temporal = false }: { temporal?: boolean }) {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [escrita, setEscrita] = useState("");

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
    const falta = validarClave(nueva);
    if (falta) return setError(falta);
    if (nueva !== String(form.get("confirmacion"))) return setError("Las contraseñas no coinciden.");
    setEnviando(true);
    setError(null);
    const supabase = crearClienteNavegador();
    // Siempre desde el servidor. Supabase cierra las sesiones de la cuenta al cambiar la contraseña: si la sesión
    // ya no se renueva, se cierra la local y se entra de nuevo con la contraseña nueva (nunca se queda en «Guardando…»).
    const r = temporal ? await cambiarClaveTemporal(nueva, String(form.get("confirmacion"))) : await cambiarClavePropia(nueva, String(form.get("confirmacion")));
    if (r.error) { setEnviando(false); return setError(r.error); }
    try {
      const { error: e } = await conLimite(supabase.auth.refreshSession());
      if (!e) {
        const { data } = await conLimite(supabase.auth.mfa.getAuthenticatorAssuranceLevel());
        return router.replace(data?.currentLevel === "aal2" ? "/hoy" : "/mfa");
      }
    } catch { /* sesión revocada */ }
    await conLimite(supabase.auth.signOut({ scope: "local" })).catch(() => {});
    return router.replace("/login?motivo=clave-lista");
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
              <InputClave id="nueva" name="nueva" autoComplete="new-password" minLength={MINIMO} required onChange={(e) => setEscrita(e.currentTarget.value)} aria-describedby="requisitos-clave" />
              <ul id="requisitos-clave" className="mt-1 grid gap-1 text-sm">
                {REQUISITOS_CLAVE.map((r) => {
                  const ok = r.cumple(escrita);
                  return (
                    <li key={r.clave} className={ok ? "flex items-center gap-2 text-exito-texto" : "flex items-center gap-2 text-ink-muted"}>
                      <span aria-hidden className={ok ? "inline-flex size-5 items-center justify-center rounded-full bg-exito text-xs text-white" : "inline-flex size-5 items-center justify-center rounded-full border border-borde text-xs"}>{ok ? "✓" : ""}</span>
                      {r.texto}<span className="sr-only">{ok ? " (listo)" : " (falta)"}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-ink-muted">Ejemplo: <span className="font-mono">Retiro7</span> (no uses este).</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmacion">Repítela</Label>
              <InputClave id="confirmacion" name="confirmacion" autoComplete="new-password" required />
            </div>
            {error && <p role="alert" className="text-sm text-critico">{error}</p>}
            <Button type="submit" disabled={enviando}>{enviando ? "Guardando…" : "Guardar y continuar"}</Button>
            {!temporal && <a href="/hoy" className="text-center text-sm text-brand underline">¿Ya tienes contraseña? Ir al inicio</a>}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
