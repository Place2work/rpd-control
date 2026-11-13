// Formulario público del gerente de campo: sello de tiempo firmado para descartar envíos automáticos (un robot lo manda
// en menos de 3 segundos o reutiliza uno viejo) y la liga pública de cada gerente.
import "server-only";
import { hashToken } from "@/lib/cripto";
import { urlApp } from "@/lib/url";

const MIN_MS = 3_000, MAX_MS = 2 * 60 * 60 * 1000;

/** Liga pública del gerente. Usa APP_URL si está fijada; si no, el dominio desde el que se abrió el panel. */
export const ligaFormulario = (codigo: string, host?: string | null) =>
  `${process.env.APP_URL || !host ? urlApp() : `https://${host}`}/registro/${codigo}`;

export function selloFormulario(ahora = Date.now()): string {
  return `${ahora}.${hashToken(`campo-formulario:${ahora}`).slice(0, 24)}`;
}

export function selloValido(sello: string, ahora = Date.now()): boolean {
  const [ms, firma] = sello.split(".");
  const t = Number(ms);
  if (!Number.isFinite(t) || !firma || hashToken(`campo-formulario:${t}`).slice(0, 24) !== firma) return false;
  return ahora - t >= MIN_MS && ahora - t <= MAX_MS;
}
