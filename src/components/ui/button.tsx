import { Slot } from "@/components/ui/slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

// 11.3: primario azul sólido, secundario con borde azul, destructivo rojo solo en confirmaciones.
// Altura 40 px (44 px en celular para objetivos táctiles), radio 8 px. El verde no se usa en botones.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-boton)] text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 h-11 md:h-10 px-4",
  {
    variants: {
      variant: {
        primario: "bg-brand text-white hover:bg-brand-dark",
        secundario: "border border-brand text-brand bg-surface hover:bg-brand-tint",
        fantasma: "text-ink hover:bg-brand-tint",
        destructivo: "bg-critico text-white hover:opacity-90",
      },
    },
    defaultVariants: { variant: "primario" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant }), className)} {...props} />;
}
