import "dotenv/config";
import { defineConfig } from "prisma/config";

// DIRECT_URL (puerto 5432) para migraciones; la app usa DATABASE_URL (pooler).
// `prisma generate` no necesita conexión, por eso no se exige aquí.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? "",
  },
});
