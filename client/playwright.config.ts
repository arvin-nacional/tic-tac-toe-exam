import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node --import tsx scripts/start-e2e.mjs",
      cwd: "../server",
      url: "http://127.0.0.1:3101/health",
      reuseExistingServer: false,
      timeout: 1_200_000,
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100",
      env: { API_BASE_URL: "http://127.0.0.1:3101", NEXT_E2E: "1" },
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
