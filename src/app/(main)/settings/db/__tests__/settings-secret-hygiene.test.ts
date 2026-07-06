import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Phase 06 (B1/B2) — static source-coverage gates for the settings secrets surface. These prove the
// CODE SHAPE that keeps secrets off the client; runtime redirect/render is enforced by proxy.ts +
// requireAuth (covered by auth-guard-coverage + the Hybrid gate).

const ROOT = resolve(__dirname, "../../../../../..");
const pageSrc = readFileSync(resolve(ROOT, "src/app/(main)/settings/db/page.tsx"), "utf8");
const actionsSrc = readFileSync(resolve(ROOT, "src/app/(main)/settings/db/actions.ts"), "utf8");
const formSrc = readFileSync(
  resolve(ROOT, "src/app/(main)/settings/db/db-settings-form.tsx"),
  "utf8",
);

describe("B1 — password masking / never rendered as plaintext", () => {
  it("should not ship the current password to the client (prefill password forced empty)", () => {
    // The page must overwrite the parsed password with "" before handing prefill to the form.
    expect(pageSrc).toMatch(/password:\s*""/);
  });

  it("should render the password input as type=password", () => {
    expect(formSrc).toMatch(/name="password"[\s\S]*?type="password"/);
  });
});

describe("B2/E3 — test-connection error sanitization", () => {
  it("should define a fixed Thai failure message constant", () => {
    expect(actionsSrc).toMatch(/CONNECT_FAIL_MESSAGE\s*=\s*"[^"]*ไม่สำเร็จ[^"]*"/);
  });

  it("should return the fixed message and never echo the URL/host/password into the error", () => {
    // The failure return must use the constant, not interpolate any submitted field.
    expect(actionsSrc).toMatch(/return\s*{\s*error:\s*CONNECT_FAIL_MESSAGE\s*}/);
    // No template-literal error that could leak the connection string / fields.
    expect(actionsSrc).not.toMatch(/error:\s*`[^`]*\$\{/);
  });

  it("should log the raw error server-side only (console.error), never return it", () => {
    expect(actionsSrc).toMatch(/console\.error\(/);
  });
});
