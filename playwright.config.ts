import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

/**
 * Localmente usamos el Google Chrome instalado para no descargar navegadores.
 * En CI: `pnpm exec playwright install --with-deps chromium` y PLAYWRIGHT_CHANNEL=chromium.
 */
const channel = process.env.PLAYWRIGHT_CHANNEL ?? "chrome";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // En desarrollo cada ruta se compila la primera vez que se visita: más margen y menos paralelismo.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: process.env.CI ? undefined : 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
    trace: "on-first-retry",
  },
  projects: [
    // Mobile-first: el proyecto móvil es la referencia principal.
    { name: "mobile", use: { ...devices["Pixel 7"], channel } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel } },
  ],
  webServer: {
    command: process.env.CI ? "pnpm start" : "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
