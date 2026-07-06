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
    expected: ["createOrderSheet", "saveOrderSheet"],
  },
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

  it("admin actions require the ADMIN role specifically", () => {
    const source = readFileSync(resolve(ROOT, "src/app/(main)/admin/users/actions.ts"), "utf8");
    const actions = extractExportedActions(source);
    const notAdminGated = actions
      .filter((a) => !/requireAuth(State)?\(\s*"ADMIN"\s*\)/.test(a.body))
      .map((a) => a.name);
    expect(notAdminGated, "admin actions not gated on ADMIN").toEqual([]);
  });
});
