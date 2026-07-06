// Shared server-side auth choke-point (B4). This — NOT proxy.ts — is the real security
// boundary (E8): proxy.ts gates PAGES, but a raw server-action POST bypasses page routing,
// so every mutating action re-checks here.
//
// E4 (session revocation): re-reads the current user's `active` + `role` from the DB on every
// call, so a user deactivated or demoted DURING their 12h JWT window immediately loses access
// (the stale token alone would otherwise keep working).
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/product-order";

export interface AuthedUser {
  id: number;
  username: string;
  role: string;
}

// Typed error carrying a Thai message, matching the existing ActionState.error convention.
// State-returning actions catch this and map .message into their error field; void-returning
// actions let it bubble to the Next error boundary (B4).
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Assert the caller is authenticated (and optionally holds `requiredRole`). Returns the
 * fresh DB-backed user. Throws AuthError with a Thai message otherwise.
 */
export async function requireAuth(requiredRole?: Role): Promise<AuthedUser> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) {
    throw new AuthError("กรุณาเข้าสู่ระบบ");
  }

  // E4: live re-check — never trust the JWT's cached active/role alone.
  const user = await prisma.user.findUnique({
    where: { id: Number(id) },
    select: { id: true, username: true, role: true, active: true },
  });
  if (!user || !user.active) {
    throw new AuthError("บัญชีถูกระงับหรือไม่พบผู้ใช้");
  }
  if (requiredRole && user.role !== requiredRole) {
    throw new AuthError("ไม่มีสิทธิ์เข้าถึง");
  }

  return { id: user.id, username: user.username, role: user.role };
}

/**
 * Guard helper for STATE-returning server actions (those returning `{ error?: string }`).
 * Returns an error-state object to surface in the UI when auth fails, or `null` when the
 * caller may proceed. Non-AuthError failures re-throw (do not swallow a real bug / redirect).
 */
export async function requireAuthState(
  requiredRole?: Role,
): Promise<{ error: string } | null> {
  try {
    await requireAuth(requiredRole);
    return null;
  } catch (err) {
    if (err instanceof AuthError) return { error: err.message };
    throw err;
  }
}
