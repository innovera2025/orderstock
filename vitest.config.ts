import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Vitest baseline for orderstock. Establishes the fully-automated test tier that
// later phases (totals, date conversion, connection-string parsing) will extend.
export default defineConfig({
  // erp-dashboards Phase 5: mirror tsconfig's `@/*` path alias. Needed because the CSV export
  // route and the dashboard modules it reuses import via `@/`, and the cross-dashboard money
  // audit (AC9) loads that route directly. Purely additive — no existing test used `@/`.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
