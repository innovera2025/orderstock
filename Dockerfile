# orderstock — production image (multi-stage, Next.js standalone output).
# Serves the app behind caddy-gen at its own subdomain (orderstock.krs.co.th), at the domain root
# (no basePath). Prisma 7 uses the pure-JS driver-adapter (node-mssql/tedious) — there is NO
# query-engine binary to fetch, only the generated client.

# ---------------------------------------------------------------------------- deps
FROM node:22-slim AS deps
WORKDIR /app
# pnpm via corepack (repo uses pnpm 11.5.x; pin for reproducibility).
RUN corepack enable && corepack prepare pnpm@11.5.0 --activate
# Lockfile-only layer for cacheable installs. pnpm-workspace.yaml carries the allowBuilds list
# (pnpm 11.5 blocks build scripts by default) so @prisma/client etc. build inside the image.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------- build
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.5.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Throwaway BUILD-TIME placeholders (NOT real secrets). `next build` collects page data for the
# /api/auth route, which imports auth.ts → db.ts; db.ts throws at module load if DATABASE_URL is
# unset, and NextAuth needs AUTH_SECRET. The real values arrive ONLY at runtime via env_file:.env
# (docker-compose.prod.yml). These never leave the build layer and are never used to serve traffic.
ENV AUTH_SECRET="build-time-placeholder-overridden-at-runtime"
ENV DATABASE_URL="sqlserver://build-placeholder:1433;database=build;user=build;password={build};encrypt=true;trustServerCertificate=true"
# Generate the Prisma client (pure-JS adapter — no engine download), then build the standalone app.
RUN pnpm exec prisma generate
RUN pnpm build

# ---------------------------------------------------------------------------- runner
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Non-root runtime user.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs
# Standalone server + its traced node_modules (includes mssql/tedious via serverExternalPackages).
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets and public files are NOT part of the standalone bundle — copy them explicitly.
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
# Prisma schema + seed for on-demand `docker compose run --rm app pnpm tsx prisma/seed.ts`.
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma
USER nextjs
EXPOSE 3000
# Next.js standalone entrypoint.
CMD ["node", "server.js"]
