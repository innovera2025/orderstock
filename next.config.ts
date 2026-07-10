import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server output for the production Docker image (.next/standalone + server.js).
  // Required by the Dockerfile runner stage; harmless in dev. The app serves at the domain root
  // (subdomain deploy: orderstock.krs.co.th) — no basePath.
  output: "standalone",
  // Prisma 7 driver-adapter uses node-mssql (mssql/tedious) at runtime. These are
  // native Node packages that must not be bundled by Turbopack; keep them external.
  // Phase 05 may extend this list (e.g. Playwright) — EXTEND, never rewrite.
  serverExternalPackages: ["mssql", "tedious"],
};

export default nextConfig;
