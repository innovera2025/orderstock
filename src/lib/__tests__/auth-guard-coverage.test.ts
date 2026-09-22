import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ELEV-guard (validate-contract): mechanically assert EVERY exported server action in the
// shop/product/admin action modules calls requireAuth (or requireAuthState, which internally
// calls requireAuth). A missed action is the top elevation risk (STRIDE). This is a static
// source-coverage gate — it proves the CALL exists, not the guard's internal correctness
// (that is covered by E4 + the adversarial pack).

const ROOT = resolve(__dirname, "../../..");

interface ActionModule {
  file: string;
  // Actions expected to be present (sanity check that we parsed the right file).
  expected: string[];
}

// Route-scoped action modules live under the (main) route group (Phase 05: /print excluded from
// the nav-bearing group). Route groups add NO URL segment, but they ARE real folders on disk.
const MODULES: ActionModule[] = [
  {
    file: "src/app/(main)/shops/actions.ts",
    expected: ["createShop", "updateShop", "softDeleteShop", "restoreShop"],
  },
  {
    file: "src/app/(main)/products/actions.ts",
    expected: [
      "createProduct",
      "updateProduct",
      "softDeleteProduct",
      "restoreProduct",
      "addVariant",
      "softDeleteVariant",
    ],
  },
  {
    file: "src/app/(main)/admin/users/actions.ts",
    expected: ["createUser", "editRole", "resetPassword", "deactivateUser", "activateUser"],
  },
  {
    file: "src/app/(main)/orders/actions.ts",
    expected: ["createOrderSheet", "saveOrderSheet", "softDeleteOrderSheet"],
  },
];

// PUBLIC API ROUTES — intentionally NOT covered by the MODULES sweep above.
//
// `MODULES` asserts `requireAuth()` inside SERVER-ACTION modules. API Route Handlers are a
// different shape and have never been enumerated here. `/api/health` calls no `requireAuth()`
// and is unauthenticated by design (an operator/uptime probe). erp-dashboards Phase 1's
// `/api/health/erp` follows that same precedent deliberately: it exposes only a boolean, a
// latency number, a staleness flag, and a fixed sanitized error string — no ERP business data,
// no money field, no connection detail. Forcing a mismatched MODULES-shaped entry for it would
// assert a guard that is intentionally absent.
//
// If a FUTURE ERP route returns business data, it MUST call requireAuth() and gets a real
// coverage entry of its own — this exemption covers health probes only.
// Rationale is also recorded in the phase report and in the "ERP Read Layer" section of
// `process/context/database/all-database.md`.
const INTENTIONALLY_PUBLIC_API_ROUTES = [
  "src/app/api/health/route.ts",
  "src/app/api/health/erp/route.ts",
];

// ADMIN-only action modules — every exported action must gate on the ADMIN role specifically (B4).
const ADMIN_MODULES = [
  "src/app/(main)/admin/users/actions.ts",
];

/** Split a module source into { name, body } chunks, one per `export async function`. */
function extractExportedActions(source: string): { name: string; body: string }[] {
  const parts = source.split(/export async function\s+/g);
  return parts.slice(1).map((chunk) => {
    const name = chunk.match(/^([A-Za-z0-9_]+)/)?.[1] ?? "<unknown>";
    // Body runs up to the next export (or end of file) — good enough for a call-presence check.
    return { name, body: chunk };
  });
}

describe("requireAuth coverage over all server actions (ELEV-guard)", () => {
  for (const mod of MODULES) {
    it(`every exported action in ${mod.file} calls requireAuth`, () => {
      const source = readFileSync(resolve(ROOT, mod.file), "utf8");
      const actions = extractExportedActions(source);
      const names = actions.map((a) => a.name);

      // Sanity: we found every expected action (guards against a parse/rename drift).
      for (const exp of mod.expected) {
        expect(names, `expected action ${exp} present in ${mod.file}`).toContain(exp);
      }

      const missing = actions.filter((a) => !/requireAuth/.test(a.body)).map((a) => a.name);
      expect(missing, `actions missing a requireAuth call in ${mod.file}`).toEqual([]);
    });
  }

  // E6: print PAGES are `export default async function` (NOT the `export async function` action
  // shape the parser above splits on), so they need their own grep path. Each print page must call
  // requireAuth() explicitly — proxy.ts gates the route, requireAuth is the real boundary (E1a).
  const PRINT_PAGES = [
    "src/app/print/daily/[date]/page.tsx",
    "src/app/print/shops/[date]/page.tsx",
  ];
  for (const file of PRINT_PAGES) {
    it(`print page ${file} calls requireAuth`, () => {
      const source = readFileSync(resolve(ROOT, file), "utf8");
      expect(/export default async function/.test(source), `${file} is a default async page`).toBe(
        true,
      );
      expect(/requireAuth\(/.test(source), `${file} must call requireAuth()`).toBe(true);
    });
  }

  for (const file of ADMIN_MODULES) {
    it(`actions in ${file} require the ADMIN role specifically`, () => {
      const source = readFileSync(resolve(ROOT, file), "utf8");
      const actions = extractExportedActions(source);
      const notAdminGated = actions
        .filter((a) => !/requireAuth(State)?\(\s*"ADMIN"\s*\)/.test(a.body))
        .map((a) => a.name);
      expect(notAdminGated, `actions not gated on ADMIN in ${file}`).toEqual([]);
    });
  }

  // Documents (and pins) the public-health-route exemption above, so the intent is explicit
  // rather than a silent omission from MODULES.
  for (const file of INTENTIONALLY_PUBLIC_API_ROUTES) {
    it(`${file} is an intentionally public health probe (no requireAuth by design)`, () => {
      const source = readFileSync(resolve(ROOT, file), "utf8");
      expect(/export async function GET/.test(source), `${file} is a GET route handler`).toBe(
        true,
      );
      expect(/requireAuth\(/.test(source), `${file} is public by design`).toBe(false);
    });
  }

  // P4: orders/actions.ts is a MIXED module — createOrderSheet/saveOrderSheet allow any authed user,
  // so it can't join ADMIN_MODULES. softDeleteOrderSheet is the ONE ADMIN-only action there; assert
  // per-function that it gates on the ADMIN role specifically (guards against a future accidental
  // removal of the "ADMIN" arg that the whole-module check would miss).
  it("softDeleteOrderSheet in orders/actions.ts requires the ADMIN role specifically", () => {
    const source = readFileSync(resolve(ROOT, "src/app/(main)/orders/actions.ts"), "utf8");
    const actions = extractExportedActions(source);
    const target = actions.find((a) => a.name === "softDeleteOrderSheet");
    expect(target, "softDeleteOrderSheet action present").toBeTruthy();
    expect(
      /requireAuth(State)?\(\s*"ADMIN"\s*\)/.test(target!.body),
      "softDeleteOrderSheet must call requireAuthState(\"ADMIN\")",
    ).toBe(true);
  });
});
