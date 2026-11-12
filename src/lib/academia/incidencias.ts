// Incidencias de capacitación (CAPACITACION.md 9.5): tipos y severidades con su etiqueta.
export const TIPOS_INCIDENCIA = [
  ["promesa_monto", "Prometió un monto o un resultado"],
  ["plazo_prometido", "Prometió un plazo fuera de lo permitido"],
  ["dato_sensible", "Manejo indebido de datos sensibles"],
  ["contrasena_terceros", "Pidió o guardó contraseñas de portales"],
  ["documento_rechazado", "Documento rechazado por error evitable"],
  ["alerta_ignorada", "Ignoró una alerta del sistema"],
  ["queja_cliente", "Queja del cliente"],
  ["otro", "Otro"],
] as const;
export const SEVERIDADES = [
  ["leve", "Leve"],
  ["grave", "Grave"],
  ["linea_roja", "Línea roja (suspende sus certificaciones)"],
] as const;
export const etiquetaTipo = (t: string) => TIPOS_INCIDENCIA.find(([k]) => k === t)?.[1] ?? t;
export const etiquetaSeveridad = (s: string) => SEVERIDADES.find(([k]) => k === s)?.[1].replace(/ \(.*\)$/, "") ?? s;
