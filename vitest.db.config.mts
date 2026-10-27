import { defineConfig } from "vitest/config";

// Pruebas de RLS, bitácora y restricciones contra un Postgres real.
// Requiere: scripts/db-local.sh rpd_test
export default defineConfig({
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 20000,
  },
});
