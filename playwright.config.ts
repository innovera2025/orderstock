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
      // Desktop project runs every spec EXCEPT the mobile-viewport one and the tablet-only drawer
      // spec (the tablet spec's assertions only hold at the tablet tier — running it at the desktop
      // viewport would false-fail). The desktop-collapse spec DOES run here (desktop tier).
      testIgnore: /mobile\.spec\.ts|sidebar-drawer\.spec\.ts/,
    },
    {
      // Phase 04 mobile project — 390×844 viewport reusing the STAFF storage state so the mobile
      // per-shop stepper e2e runs headless. Only picks up mobile.spec.ts.
      name: "mobile",
      testMatch: /mobile\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
      dependencies: ["setup"],
    },
    {
      // responsive-drawer-sidebar plan — tablet project (820×1180, iPad-portrait-ish) reusing the
      // storage state so the drawer e2e runs headless. Only picks up sidebar-drawer.spec.ts, the
      // same "add a project rather than inline setViewportSize" pattern as the mobile project.
      name: "tablet",
      testMatch: /sidebar-drawer\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 820, height: 1180 },
      },
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
