import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // El PDF lee fuentes y logo del disco: que Vercel los incluya en la función.
  outputFileTracingIncludes: {
    "/api/casos/[id]/hoja": ["./src/lib/pdf/fuentes/**", "./src/lib/pdf/logo-pdf.png"],
    "/api/comisiones/estado-cuenta": ["./src/lib/pdf/fuentes/**", "./src/lib/pdf/logo-pdf.png"],
    "/api/casos/[id]/contrato": ["./src/lib/pdf/fuentes/**", "./src/lib/pdf/logo-pdf.png"],
    "/api/exportar/reporte": ["./src/lib/pdf/fuentes/**", "./src/lib/pdf/logo-pdf.png"],
  },
  serverExternalPackages: ["@react-pdf/renderer"],
  partialPrefetching: true,
  // Toda pantalla depende del usuario (rol y RLS) y el layout ya declara `instant = false`: la validación de
  // navegación instantánea solo corre en los segmentos que la pidan con `instant` (evita avisos falsos en desarrollo).
  experimental: {
    instantInsights: {
      validationLevel: "manual-warning",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
