// Formatos de fecha para textos que se guardan o se muestran (es-MX). Fechas ISO sin hora.
export function formatoFechaLarga(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}
