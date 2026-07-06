import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

// SEC-secret (validate-contract): no plaintext admin password / secret committed to any tracked
// file. git grep over tracked src/** + prisma/** must return empty. `.env` (which holds the real
// AUTH_SECRET / SEED_ADMIN_PASSWORD) is gitignored, so it is never scanned here.

const ROOT = resolve(__dirname, "../../..");

function gitGrep(pattern: string): string {
  try {
    return execSync(`git grep -nE ${JSON.stringify(pattern)} -- 'src/**' 'prisma/**'`, {
      cwd: ROOT,
      encoding: "utf8",
    });
  } catch (err) {
    // git grep exits 1 (non-zero) when there are NO matches — that is the success case.
    const e = err as { status?: number; stdout?: string };
    if (e.status === 1) return "";
    throw err;
  }
}

describe("no committed secrets (SEC-secret)", () => {
  it("has no hardcoded SEED_ADMIN_PASSWORD assignment or literal passwordHash in tracked source", () => {
    const hits = gitGrep('SEED_ADMIN_PASSWORD *= *"|passwordHash *= *"[^"]');
    expect(hits.trim()).toBe("");
  });

  it("has no AUTH_SECRET literal committed in tracked source", () => {
    const hits = gitGrep('AUTH_SECRET *= *"[A-Za-z0-9+/]{20,}');
    expect(hits.trim()).toBe("");
  });
});
