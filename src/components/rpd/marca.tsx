import { cn } from "@/lib/utils";

// Logotipo provisional en texto (Poppins, minúsculas), mientras llega el SVG oficial
// en versión a color y blanca (pendiente de marca, 11.6).
export function Marca({ variante = "color", className }: { variante?: "color" | "blanco"; className?: string }) {
  const principal = variante === "blanco" ? "text-white" : "text-brand";
  return (
    <span className={cn("inline-flex flex-col font-display leading-none", className)} aria-label="RetiroPorDesempleo.com">
      <span className={cn("text-2xl font-semibold tracking-tight", principal)}>retiro</span>
      <span className={cn("text-sm font-semibold", principal)}>
        <span className="text-[0.7em] font-medium">por </span>desempleo
        <span className={variante === "blanco" ? "text-[#8fd16a]" : "text-exito"}>.com</span>
      </span>
    </span>
  );
}
