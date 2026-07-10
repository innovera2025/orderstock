import type { NextAuthConfig } from "next-auth";

// EDGE-SAFE SPLIT CONFIG (db-auth REF §5). This file runs in the edge/proxy runtime, so it
// MUST NOT import Prisma, bcryptjs, or any secret-bearing / Node-only module. The Credentials
// provider (which needs Prisma + bcryptjs) is added in the Node-runtime `src/auth.ts`.
//
// `proxy.ts` (Next 16 route protection) imports THIS config to decode the JWT and run the
// `authorized` callback at the edge. auth.ts spreads this config and appends the provider.
export const authConfig = {
  // Sign-in page. Root-relative `/login` — the app serves at the domain root (subdomain deploy,
  // orderstock.krs.co.th; no basePath). Do NOT set `authConfig.basePath` (it reproduces the
  // Auth.js api/auth double-strip 400).
  pages: { signIn: "/login" },
  // Credentials provider REQUIRES the JWT session strategy. maxAge locked to 12h (decision 5);
  // requireAuth re-checks User.active/role from the DB so a demoted/deactivated user inside
  // the 12h window still loses access (E4).
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  providers: [], // populated in src/auth.ts (Node runtime — Credentials + Prisma + bcryptjs)
  callbacks: {
    // Route-level gate (convenience layer; server-side requireAuth is the real boundary, E8).
    // Everything reaching this callback is matcher-included (public paths are excluded there).
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      // ADMIN-only areas: /admin/** and the Phase 06 /settings/** DB-config page (E4). Server-side
      // requireAuth("ADMIN") remains the real boundary; this edge gate is defense-in-depth.
      if (pathname.startsWith("/admin") || pathname.startsWith("/settings")) {
        return isLoggedIn && auth?.user?.role === "ADMIN";
      }
      return isLoggedIn;
    },
    // Role is sourced from the DB at authorize() → carried on the JWT, never from client input.
    jwt({ token, user }) {
      if (user) token.role = user.role;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        // token.role is typed via the next-auth/jwt augmentation; cast defensively because the
        // v5 JWT default carries an index signature that can widen the read to `unknown`.
        session.user.role = token.role as string | undefined;
        if (token.sub) session.user.id = token.sub; // token.sub = the User.id from authorize()
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
