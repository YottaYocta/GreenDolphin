import { defineConfig, devices } from "@playwright/test";

const PORT = 5190;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "*.e2e.ts",
  timeout: 60_000,
  fullyParallel: true,
  workers: 4,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: "chrome",
    launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: true,
  },
});
