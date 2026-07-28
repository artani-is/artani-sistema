import { defineConfig } from "vitest/config";

/**
 * Development testing (Sommerville): pruebas unitarias y de integración del
 * backend. Se ejecutan contra una base de datos PostgreSQL dedicada
 * (`artani_test`) para no alterar los datos de desarrollo.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    // Las suites comparten una sola base de datos: se ejecutan en serie para
    // que el truncado entre archivos no interfiera con otra suite en vuelo.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    reporters: ["verbose"],
    env: {
      DATABASE_URL: "postgresql://artani:artani_dev@localhost:5432/artani_test?schema=public",
      JWT_SECRET: "secreto-de-pruebas-artani",
      JWT_EXPIRES_IN: "1h",
      PUBLIC_BASE_URL: "http://localhost:5173",
    },
  },
});
