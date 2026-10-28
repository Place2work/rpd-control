import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // El PDF lee fuentes y logo del disco: que Vercel los incluya en la función.
  outputFileTracingIncludes: {
    "/api/casos/[id]/hoja": ["./src/lib/pdf/fuentes/**", "./src/lib/pdf/logo-pdf.png"],
    "/api/comisiones/estado-cuenta": ["./src/lib/pdf/fuentes/**", "./src/lib/pdf/logo-pdf.png"],
    "/api/exportar/reporte": ["./src/lib/pdf/fuentes/**", "./src/lib/pdf/logo-pdf.png"],
  },
  serverExternalPackages: ["@react-pdf/renderer"],
  partialPrefetching: true,
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
