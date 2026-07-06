import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/db";
import { verifyPassword, DUMMY_HASH } from "@/lib/password";
import { loginAttempts } from "@/lib/login-attempts";

// NODE-RUNTIME auth config: spreads the edge-safe base config and appends the Credentials
// provider, whose authorize() touches Prisma + bcryptjs (both SERVER-ONLY, never edge).
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "ชื่อผู้ใช้", type: "text" },
        password: { label: "รหัสผ่าน", type: "password" },
      },
      async authorize(credentials) {
        const username = typeof credentials?.username === "string" ? credentials.username.trim() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!username || !password) return null;

        // Brute-force lockout (C4 / E11): block early, before any DB/bcrypt work.
        if (loginAttempts.isBlocked(username)) return null;

        // NEVER select passwordHash into anything client-bound (E6); it stays inside authorize().
        const user = await prisma.user.findUnique({
          where: { username },
          select: { id: true, username: true, passwordHash: true, role: true, active: true },
        });

        // Timing defense (E7): always run one bcrypt compare, even for a missing user, so
        // response time does not leak whether the username exists.
        const hashToCheck = user?.passwordHash ?? DUMMY_HASH;
        const passwordOk = await verifyPassword(password, hashToCheck);

        // Generic failure for BOTH "no such user" AND "wrong password" AND "deactivated" (E5).
        if (!user || !user.active || !passwordOk) {
          loginAttempts.recordFailure(username);
          return null;
        }

        loginAttempts.recordSuccess(username);
        // Return only non-secret identity fields (E6) — role drives the JWT claim.
        return { id: String(user.id), name: user.username, role: user.role };
      },
    }),
  ],
});
