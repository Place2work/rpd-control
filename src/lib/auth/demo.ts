// Modo demostración para revisar el diseño sin Supabase. Solo funciona con `next dev`
// fuera de Vercel; en producción esta función siempre devuelve false.
export function modoDemo(): boolean {
  return process.env.NODE_ENV === "development" && !process.env.VERCEL && process.env.RPD_DEMO_SIN_AUTH === "1";
}
