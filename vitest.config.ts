import { defineConfig } from "vitest/config";

// Vitest baseline for orderstock. Establishes the fully-automated test tier that
// later phases (totals, date conversion, connection-string parsing) will extend.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
