// Next 16 ROUTE PROTECTION (PVL P2). Next 16 renamed `middleware.ts` → `proxy.ts`; a
// `middleware.ts` file is SILENTLY IGNORED (no build error). This file MUST sit at
// `src/proxy.ts` (sibling of `src/app/`), matching the `src/` project layout — a wrong
// location fails the same silent way. Verify by RUNTIME redirect (logged-out → /login),
// never by build success (a mis-placed proxy.ts still builds green).
//
// EDGE-SAFE: imports only the split `auth.config.ts` (no Prisma / bcryptjs / secrets). The
// `authorized` callback there gates all matched routes and role-gates /admin/**. Server-side
// requireAuth re-checks the DB and is the real security boundary (B2 / E8).
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Guard everything EXCEPT: the login page, Auth.js endpoints, the health check, Next static
  // assets/images, self-hosted fonts, and common static file extensions (B3 exclusions).
  matcher: [
    "/((?!login|api/auth|api/health|_next/static|_next/image|fonts|favicon.ico|.*\\.(?:woff2?|ttf|otf|png|jpe?g|svg|ico|css)).*)",
  ],
};
