// Password hashing via bcryptjs (pure-JS, no native build — the customer's deployment
// platform is unknown; work factor >= 10 per OWASP). SERVER-ONLY: never import this from
// the edge `proxy.ts` / `auth.config.ts` split config (db-auth REF §5).
import bcrypt from "bcryptjs";

// bcrypt silently truncates input beyond 72 bytes. We reject over-length input instead of
// letting two different long passwords collide on their first 72 bytes (DoD#3-hash).
export const BCRYPT_MAX_BYTES = 72;

const WORK_FACTOR = 12;

/**
 * A constant, valid bcrypt hash used as a timing-defense comparison target when a username
 * is not found (E7). Comparing a login guess against this constant keeps the not-found path
 * as slow as the found path, so response timing does not leak user existence. It corresponds
 * to no real credential and must never validate any guess.
 */
export const DUMMY_HASH =
  "$2b$12$W0nEDYxgL.ePrbbS9l.Z6.wYe9gnkooT1xL/NZXgJWMfQH/6levjS";

export async function hashPassword(plain: string): Promise<string> {
  if (Buffer.byteLength(plain, "utf8") > BCRYPT_MAX_BYTES) {
    throw new Error(
      `รหัสผ่านยาวเกินกำหนด (สูงสุด ${BCRYPT_MAX_BYTES} ไบต์)`,
    );
  }
  return bcrypt.hash(plain, WORK_FACTOR);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  // bcrypt.compare returns false (never throws) for a malformed/non-matching hash.
  return bcrypt.compare(plain, hash);
}
