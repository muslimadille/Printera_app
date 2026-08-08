import { defineConfig, devices } from "@playwright/test";

/** Prefer localhost (matches FRONTEND_URLS / VITE_API_BASE_URL) over 127.0.0.1. */
const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173";

export default defineConfig({
  testDir: "./e2e",
  timeout: 20 * 60 * 1000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/artifacts/html-report" }]],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  use: {
    baseURL: BASE,
    trace: "off",
    screenshot: "only-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_NO_WEBSERVER
    ? undefined
    : {
        command: "bun run dev -- --host localhost --port 5173",
        url: `${BASE}/app`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
