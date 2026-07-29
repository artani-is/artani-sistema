import { defineConfig, devices } from "@playwright/test";

/**
 * Release testing (Sommerville): pruebas de sistema de extremo a extremo sobre
 * el sistema completo — navegador real, frontend de Vite y API Express contra
 * una base de datos PostgreSQL dedicada (`artani_e2e`).
 */
const URL_BASE = "http://localhost:5174";
const DB_E2E = "postgresql://artani:artani_dev@localhost:5432/artani_e2e?schema=public";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: URL_BASE,
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    // Resolución de escritorio de referencia para las capturas del informe
    viewport: { width: 1440, height: 900 },
  },

  projects: [
    // RNF_004: portabilidad entre navegadores. Chromium cubre Chrome/Edge;
    // Firefox se ejecuta con el mismo conjunto de pruebas.
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],

  webServer: [
    {
      // El proxy de Vite apunta a localhost:3000; el aislamiento de la corrida
      // lo da la base de datos dedicada, no el puerto.
      command: "pnpm dev",
      cwd: "../backend",
      port: 3000,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        DATABASE_URL: DB_E2E,
        PORT: "3000",
        CORS_ORIGIN: URL_BASE,
        JWT_SECRET: "secreto-e2e-artani",
        JWT_EXPIRES_IN: "8h",
        PUBLIC_BASE_URL: URL_BASE,
        // El flujo de recuperación se recorre sin cuenta de Resend: el correo
        // se escribe en la salida del servidor en lugar de enviarse.
        CORREO_TRANSPORTE: "consola",
      },
    },
    {
      command: "pnpm exec vite --port 5174 --strictPort",
      cwd: "../frontend",
      port: 5174,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
