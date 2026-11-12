// Correos que el IMSS manda al buzón de constancias (12-nov-2026). Puras: no leen la red ni la base.

/** Dirección de correo dentro de «Nombre <correo@dominio>» o sola, en minúsculas. */
export function direccionDe(remitente: string): string {
  return (remitente.match(/<([^>]+)>/)?.[1] ?? remitente).trim().toLowerCase();
}

/** ¿El remitente es del IMSS (imss.gob.mx o un subdominio)? */
export function esRemitenteImss(remitente: string): boolean {
  return /@([a-z0-9-]+\.)*imss\.gob\.mx$/.test(direccionDe(remitente));
}

/** El servidor de correo comprobó que viene del dominio que dice (DKIM o SPF «pass»). */
export function autenticado(auth: { dkim?: unknown; spf?: unknown } | null | undefined): boolean {
  const pasa = (v: unknown): boolean => {
    if (!v) return false;
    if (typeof v === "string") return v.toLowerCase() === "pass";
    if (Array.isArray(v)) return v.some(pasa);
    if (typeof v === "object") return pasa((v as { result?: unknown; status?: unknown }).result ?? (v as { status?: unknown }).status);
    return false;
  };
  return Boolean(auth) && (pasa(auth!.dkim) || pasa(auth!.spf));
}

/** Ligas https a imss.gob.mx que trae el correo (texto o HTML); solo esas se muestran como botón. */
export function ligasImss(...contenidos: (string | null | undefined)[]): string[] {
  const vistas = new Set<string>();
  for (const c of contenidos) {
    if (!c) continue;
    const limpio = c.replace(/&amp;/g, "&");
    for (const m of limpio.matchAll(/https:\/\/[^\s"'<>()]+/g)) {
      const url = m[0].replace(/[.,;:!?)\]]+$/, "");
      try {
        const u = new URL(url);
        if (u.protocol === "https:" && /(^|\.)imss\.gob\.mx$/.test(u.hostname)) vistas.add(u.toString());
      } catch { /* no es una URL */ }
    }
  }
  return [...vistas];
}

/** La liga que confirma la solicitud: la que menciona confirmar/solicitud/constancia, o la única que haya. */
export function ligaDeConfirmacion(ligas: string[]): string | null {
  const preferida = ligas.find((l) => /confirm|solicitud|constancia|semanas/i.test(l));
  return preferida ?? (ligas.length === 1 ? ligas[0] : null);
}

/** CURP y NSS que aparecen en el texto, para ligar el correo al cliente (se comparan por hash). */
export function identificadoresEnTexto(texto: string | null | undefined): { curps: string[]; nsss: string[] } {
  const t = (texto ?? "").toUpperCase();
  const curps = [...new Set(t.match(/\b[A-Z][AEIOUX][A-Z]{2}\d{6}[HMX][A-Z]{5}[A-Z0-9]\d\b/g) ?? [])];
  const nsss = [...new Set(t.match(/\b\d{11}\b/g) ?? [])];
  return { curps, nsss };
}

/** De varias solicitudes vivas, ¿a cuál pertenece un correo sin identificadores? Solo si hay una sola reciente. */
export function solicitudUnicaReciente<T extends { creada: string }>(vivas: T[], ahoraIso: string, horas = 6): T | null {
  const limite = new Date(new Date(ahoraIso).getTime() - horas * 3600_000).toISOString();
  const recientes = vivas.filter((s) => s.creada >= limite);
  return recientes.length === 1 ? recientes[0] : null;
}
