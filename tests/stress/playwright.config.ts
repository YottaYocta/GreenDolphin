import { defineConfig } from "@playwright/test";
import base from "../../playwright.config";

process.env.STRESS_RESULTS ??= `tests/stress/results/memory-${new Date().toISOString().replace(/[:.]/g, "-")}`;

export default defineConfig({
  ...base,
  testDir: ".",
  testMatch: "*.stress.ts",
  timeout: 45 * 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { ...base.use, actionTimeout: 60_000 },
  webServer: { ...base.webServer!, cwd: "../.." },
  projects: base.projects!.filter((p) => p.name === "desktop"),
});
