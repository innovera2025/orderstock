import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  BCRYPT_MAX_BYTES,
  DUMMY_HASH,
} from "../password";

// DoD#3-hash (validate-contract): password hash+verify round-trips; wrong pw fails;
// 72-byte bcrypt limit respected. bcryptjs is pure-JS (no native build), work factor >=10.
describe("password hashing (DoD#3-hash)", () => {
  it("should hash a password and verify it round-trips, and reject a wrong password", async () => {
    const hash = await hashPassword("s3cret-Passw0rd!");
    expect(hash).not.toBe("s3cret-Passw0rd!"); // never store plaintext
    expect(hash.startsWith("$2")).toBe(true); // bcrypt format
    expect(await verifyPassword("s3cret-Passw0rd!", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("uses a work factor of at least 10", async () => {
    const hash = await hashPassword("another-Passw0rd!");
    // bcrypt hash format: $2b$<cost>$...
    const cost = Number(hash.split("$")[2]);
    expect(cost).toBeGreaterThanOrEqual(10);
  });

  it("respects the 72-byte bcrypt limit by rejecting an over-length password", async () => {
    const tooLong = "a".repeat(BCRYPT_MAX_BYTES + 1);
    await expect(hashPassword(tooLong)).rejects.toThrow();
  });

  it("exposes a constant DUMMY_HASH usable for timing-safe comparison against a missing user", async () => {
    expect(DUMMY_HASH.startsWith("$2")).toBe(true);
    // The dummy hash must never validate a real password guess.
    expect(await verifyPassword("any-guess", DUMMY_HASH)).toBe(false);
  });
});
