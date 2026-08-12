import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// Playwright no lee .env.local por su cuenta. Se usa el cargador de Next para
// que la configuración de las pruebas y la de la app sean exactamente la misma.
loadEnvConfig(process.cwd());

const BASE_URL = "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/preparar.ts",

  /*
   * Un solo worker y sin paralelismo dentro del archivo.
   *
   * Las pruebas comparten las tres cuentas de la siembra y varias mutan estado
   * compartido (el consentimiento de Ana). En paralelo se pisarían y el suite
   * fallaría de forma intermitente, que es peor que un suite lento.
   */
  workers: 1,
  fullyParallel: false,

  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: BASE_URL,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    trace: "on-first-retry",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: "pnpm dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
