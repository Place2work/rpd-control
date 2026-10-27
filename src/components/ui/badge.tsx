import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

// Pastilla con fondo tenue y texto oscuro del mismo tono (11.3). Siempre lleva texto:
// el color nunca es la única señal (11.6).
const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    tono: {
      prospecto: "bg-slate-200 text-slate-700",
      espera: "bg-aviso-tint text-aviso",
      tramite: "bg-brand-tint text-brand-dark",
      pagado: "bg-exito-tint text-exito-texto",
      perdido: "bg-slate-100 text-slate-500 line-through",
      critico: "bg-critico-tint text-critico",
    },
  },
  defaultVariants: { tono: "prospecto" },
});

export function Badge({ className, tono, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tono }), className)} {...props} />;
}
