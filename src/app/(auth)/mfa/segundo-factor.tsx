"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { crearClienteNavegador } from "@/lib/supabase/client";

type Estado =
  | { paso: "cargando" }
  | { paso: "inscribir"; factorId: string; qr: string; secreto: string }
  | { paso: "verificar"; factorId: string };

// 2FA obligatorio (sección 12): si el usuario no tiene app autenticadora se inscribe aquí;
// si ya la tiene, captura el código. Sin aal2, RLS no deja ver ningún dato.
export function SegundoFactor() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ paso: "cargando" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = crearClienteNavegador();
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return router.replace("/login");
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) return setError("No pudimos revisar tu verificación. Vuelve a iniciar sesión.");
      const verificado = data.totp.find((f) => f.status === "verified");
      if (verificado) return setEstado({ paso: "verificar", factorId: verificado.id });
      // Limpia inscripciones a medias antes de crear una nueva.
      for (const f of data.all.filter((f) => f.status !== "verified")) await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data: nuevo, error: e2 } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "RPD Control" });
      if (e2 || !nuevo) return setError("No pudimos iniciar la inscripción del segundo factor.");
      setEstado({ paso: "inscribir", factorId: nuevo.id, qr: nuevo.totp.qr_code, secreto: nuevo.totp.secret });
    })();
  }, [router]);

  async function verificar(form: FormData) {
    if (estado.paso === "cargando") return;
    setError(null);
    const { error } = await crearClienteNavegador().auth.mfa.challengeAndVerify({
      factorId: estado.factorId,
      code: String(form.get("codigo")).replace(/\s/g, ""),
    });
    if (error) return setError("El código no es válido o ya expiró. Intenta con el siguiente.");
    // Solo se permite regresar a /contrasena (recuperación con 2FA); nunca a una URL externa.
    const siguiente = new URLSearchParams(window.location.search).get("siguiente");
    router.replace(siguiente === "/contrasena" ? "/contrasena" : "/hoy");
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-6 text-brand" strokeWidth={1.5} aria-hidden />
          <h1 className="font-display text-[22px] font-semibold">Verificación en dos pasos</h1>
        </div>
        {estado.paso === "cargando" && !error && <p className="text-sm text-ink-muted">Cargando…</p>}
        {estado.paso === "inscribir" && (
          <>
            <p className="text-sm text-ink-muted">Escanea el código con Google Authenticator, Microsoft Authenticator o 1Password.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={estado.qr} alt="Código QR para tu app autenticadora" className="mx-auto size-48" />
            <p className="text-center text-xs text-ink-muted">
              ¿No puedes escanear? Escribe esta clave: <code className="break-all font-mono text-ink">{estado.secreto}</code>
            </p>
          </>
        )}
        {estado.paso === "verificar" && <p className="text-sm text-ink-muted">Escribe el código de 6 dígitos de tu app autenticadora.</p>}
        {estado.paso !== "cargando" && (
          <form action={verificar} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="codigo">Código</Label>
              <Input id="codigo" name="codigo" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" required autoFocus className="cifra text-center text-lg tracking-[0.3em]" />
            </div>
            <Button type="submit">Verificar</Button>
          </form>
        )}
        {error && <p role="alert" className="text-sm text-critico">{error}</p>}
      </CardContent>
    </Card>
  );
}
