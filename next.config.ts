import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma 7 driver-adapter uses node-mssql (mssql/tedious) at runtime. These are
  // native Node packages that must not be bundled by Turbopack; keep them external.
  // Phase 05 may extend this list (e.g. Playwright) — EXTEND, never rewrite.
  serverExternalPackages: ["mssql", "tedious"],
};

export default nextConfig;
