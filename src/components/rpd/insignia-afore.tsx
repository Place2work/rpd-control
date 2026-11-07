// Insignia visual de la Afore: iniciales sobre el color de la marca, junto al nombre. No reproduce el logotipo
// (marca registrada de cada Afore); sirve para reconocerla de un vistazo. Colores con contraste AA.
import { cn } from "@/lib/utils";

const AFORES: Record<string, { nombre: string; iniciales: string; fondo: string; texto: string }> = {
  AZTECA: { nombre: "Afore Azteca", iniciales: "AZ", fondo: "#00843D", texto: "#FFFFFF" },
  BANAMEX: { nombre: "Afore Banamex", iniciales: "BX", fondo: "#004B8D", texto: "#FFFFFF" },
  COPPEL: { nombre: "Afore Coppel", iniciales: "CO", fondo: "#FFD100", texto: "#0B2D6B" },
  INBURSA: { nombre: "Afore Inbursa", iniciales: "IN", fondo: "#1B3E7A", texto: "#FFFFFF" },
  INVERCAP: { nombre: "Afore Invercap", iniciales: "IV", fondo: "#B85A00", texto: "#FFFFFF" },
  PENSIONISSSTE: { nombre: "PENSIONISSSTE", iniciales: "PI", fondo: "#691C32", texto: "#FFFFFF" },
  PRINCIPAL: { nombre: "Principal Afore", iniciales: "PR", fondo: "#0061A0", texto: "#FFFFFF" },
  PROFUTURO: { nombre: "Profuturo Afore", iniciales: "PF", fondo: "#00539B", texto: "#FFFFFF" },
  SURA: { nombre: "Afore SURA", iniciales: "SU", fondo: "#0033A0", texto: "#FFFFFF" },
  XXI_BANORTE: { nombre: "Afore XXI Banorte", iniciales: "XB", fondo: "#C8102E", texto: "#FFFFFF" },
};

/** Afore del cliente con su color. `nombre` reemplaza al del catálogo interno si viene de la base. */
export function InsigniaAfore({ clave, nombre, tamano = "md", sinNombre = false, className }:
  { clave: string | null | undefined; nombre?: string | null; tamano?: "sm" | "md"; sinNombre?: boolean; className?: string }) {
  if (!clave) return null;
  const a = AFORES[clave] ?? { nombre: clave, iniciales: clave.slice(0, 2).toUpperCase(), fondo: "#475569", texto: "#FFFFFF" };
  const texto = nombre ?? a.nombre;
  return (
    <span className={cn("inline-flex items-center gap-2", className)} title={texto}>
      <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center rounded-md font-display font-semibold tracking-tight",
        tamano === "sm" ? "size-6 text-[10px]" : "size-9 text-sm")} style={{ background: a.fondo, color: a.texto }}>
        {a.iniciales}
      </span>
      {sinNombre ? <span className="sr-only">{texto}</span> : <span className={tamano === "sm" ? "text-sm" : "text-sm font-medium text-ink"}>{texto}</span>}
    </span>
  );
}
