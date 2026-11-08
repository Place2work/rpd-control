// Insignia de la Afore del cliente: su logotipo (public/afores/<CLAVE>.png, proporcionados por la empresa) junto al
// nombre. Si una Afore no tiene logotipo, iniciales sobre el color de la marca (contraste AA).
import Image from "next/image";
import { cn } from "@/lib/utils";

const AFORES: Record<string, { nombre: string; iniciales: string; fondo: string; texto: string; logo?: boolean }> = {
  AZTECA: { nombre: "Afore Azteca", iniciales: "AZ", fondo: "#00843D", texto: "#FFFFFF", logo: true },
  BANAMEX: { nombre: "Afore Banamex", iniciales: "BX", fondo: "#004B8D", texto: "#FFFFFF", logo: true },
  COPPEL: { nombre: "Afore Coppel", iniciales: "CO", fondo: "#FFD100", texto: "#0B2D6B", logo: true },
  INBURSA: { nombre: "Afore Inbursa", iniciales: "IN", fondo: "#1B3E7A", texto: "#FFFFFF", logo: true },
  INVERCAP: { nombre: "Afore Invercap", iniciales: "IV", fondo: "#B85A00", texto: "#FFFFFF", logo: true },
  PENSIONISSSTE: { nombre: "PENSIONISSSTE", iniciales: "PI", fondo: "#691C32", texto: "#FFFFFF", logo: true },
  PRINCIPAL: { nombre: "Principal Afore", iniciales: "PR", fondo: "#0061A0", texto: "#FFFFFF", logo: true },
  PROFUTURO: { nombre: "Profuturo Afore", iniciales: "PF", fondo: "#00539B", texto: "#FFFFFF", logo: true },
  SURA: { nombre: "Afore SURA", iniciales: "SU", fondo: "#0033A0", texto: "#FFFFFF", logo: true },
  XXI_BANORTE: { nombre: "Afore XXI Banorte", iniciales: "XB", fondo: "#C8102E", texto: "#FFFFFF", logo: true },
};

/** Afore del cliente con su logotipo. `nombre` reemplaza al del catálogo interno si viene de la base. */
export function InsigniaAfore({ clave, nombre, tamano = "md", sinNombre = false, className }:
  { clave: string | null | undefined; nombre?: string | null; tamano?: "sm" | "md"; sinNombre?: boolean; className?: string }) {
  if (!clave) return null;
  const a = AFORES[clave] ?? { nombre: clave, iniciales: clave.slice(0, 2).toUpperCase(), fondo: "#475569", texto: "#FFFFFF" };
  const texto = nombre ?? a.nombre;
  const chico = tamano === "sm";
  return (
    <span className={cn("inline-flex items-center gap-2", className)} title={texto}>
      {a.logo ? (
        <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center rounded-md border border-borde bg-white px-1",
          chico ? "h-6 w-14" : "h-10 w-24")}>
          <Image src={`/afores/${clave}.png`} alt="" width={chico ? 52 : 88} height={chico ? 20 : 34} className="h-full w-full object-contain" />
        </span>
      ) : (
        <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center rounded-md font-display font-semibold tracking-tight",
          chico ? "size-6 text-[10px]" : "size-9 text-sm")} style={{ background: a.fondo, color: a.texto }}>
          {a.iniciales}
        </span>
      )}
      {sinNombre ? <span className="sr-only">{texto}</span> : <span className={chico ? "text-sm" : "text-sm font-medium text-ink"}>{texto}</span>}
    </span>
  );
}
