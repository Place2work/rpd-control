// Formatos de fecha para textos que se guardan o se muestran (es-MX). Fechas ISO sin hora.
export function formatoFechaLarga(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

/** Pesos mexicanos con 2 decimales: $1,234.50. */
export const mxn = (n: number | { toString(): string } | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

/** Valor de una celda de reporte según el tipo de su columna. */
export function formatear(v: string | number | null | undefined, tipo?: "texto" | "pesos" | "numero" | "fecha" | "porcentaje"): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string") return v;
  if (tipo === "pesos") return v.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
  if (tipo === "porcentaje") return `${(v * 100).toLocaleString("es-MX", { maximumFractionDigits: 1 })}%`;
  return v.toLocaleString("es-MX", { maximumFractionDigits: 1 });
}
