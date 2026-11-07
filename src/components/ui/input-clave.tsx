"use client";

// Campo de contraseña con botón para verla u ocultarla (el ojito). Por defecto va oculta.
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

export function InputClave({ className, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-11", className)} autoCapitalize="none" spellCheck={false} />
      <button type="button" onClick={() => setVisible((v) => !v)} aria-pressed={visible}
        aria-label={visible ? "Ocultar contraseña" : "Ver contraseña"} title={visible ? "Ocultar contraseña" : "Ver contraseña"}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-[var(--radius-boton)] text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-brand">
        {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
      </button>
    </div>
  );
}
