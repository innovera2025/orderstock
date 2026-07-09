import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production subpath deploy (app.krs.co.th/orderstock). ENV-CONDITIONAL: unset ⇒ undefined ⇒
  // app serves at bare `/` (dev + all 88 unit / 25 e2e gates byte-unaffected); set to
  // `/orderstock` at build+runtime ⇒ every route is namespaced under the subpath. NEXT_PUBLIC_*
  // vars are inlined at build time, so this MUST be passed as a Docker build ARG (see Dockerfile).
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  // Self-contained server output for the production Docker image (.next/standalone + server.js).
  // Orthogonal to basePath; harmless in dev.
  output: "standalone",
  // Prisma 7 driver-adapter uses node-mssql (mssql/tedious) at runtime. These are
  // native Node packages that must not be bundled by Turbopack; keep them external.
  // Phase 05 may extend this list (e.g. Playwright) — EXTEND, never rewrite.
  serverExternalPackages: ["mssql", "tedious"],
};

export default nextConfig;
