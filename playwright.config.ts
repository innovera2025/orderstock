import { defineConfig, devices } from "@playwright/test";

// Phase 03 first-time E2E setup. Hybrid-tier auth gates (login / role-gate / redirect / enum).
// Reusable ADMIN/STAFF storage-state fixtures are produced by the `setup` project and reused
// by Phases 04-06. Requires the sandbox SQL Server up + a seeded admin (pnpm tsx prisma/seed.ts).
//
// Load .env so SEED_ADMIN_PASSWORD is available to the setup project (Playwright does not
// auto-load .env). Node 22 provides process.loadEnvFile.
try {
  process.loadEnvFile();
} catch {
  // .env optional in CI where vars come from the environment directly.
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "pnpm start",
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
