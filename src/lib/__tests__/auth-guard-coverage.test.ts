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

  // ---------------------------------------------------------------------------------------------
  // erp-dashboards Phase 2 — APPEND ONLY (registry rule: each phase appends its OWN routes here and
  // never removes or reorders another phase's entries).
  //
  // `/dashboards/sales` is a business-data ERP route, so unlike Phase 1's `/api/health/erp` health
  // probe it MUST be auth-guarded, and it carries the money-visibility gate (AC9).
  // ---------------------------------------------------------------------------------------------
  const ERP_DASHBOARD_PAGES = ["src/app/(main)/dashboards/sales/page.tsx"];

  for (const file of ERP_DASHBOARD_PAGES) {
    it(`ERP dashboard page ${file} calls requireAuth`, () => {
      const source = readFileSync(resolve(ROOT, file), "utf8");
      expect(/export default async function/.test(source), `${file} is a default async page`).toBe(
        true,
      );
      expect(/requireAuth\(/.test(source), `${file} must call requireAuth()`).toBe(true);
    });

    it(`${file} derives money visibility from the SERVER session, not the client`, () => {
      const source = readFileSync(resolve(ROOT, file), "utf8");
      // AC9: canSeeMoney comes from the awaited requireAuth() result's role — the one sanctioned
      // shape. A client-side check or a CSS hide would not match this.
      expect(
        /const\s+canSeeMoney\s*=\s*user\.role\s*===\s*"ADMIN"/.test(source),
        `${file} must compute canSeeMoney from the server-side session role`,
      ).toBe(true);
      expect(/"use client"/.test(source), `${file} must stay a server component`).toBe(false);
    });
  }

  it("no Sales dashboard component hides money with CSS instead of omitting it server-side", () => {
    const files = [
      "src/app/(main)/dashboards/sales/sales-kpi-tiles.tsx",
      "src/app/(main)/dashboards/sales/do-list-table.tsx",
      "src/app/(main)/dashboards/sales/do-lines-table.tsx",
      "src/app/(main)/dashboards/sales/sales-breakdown-tables.tsx",
      "src/app/(main)/dashboards/sales/sales-chart.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(resolve(ROOT, file), "utf8");
      // A money value must never be rendered and then hidden — the markup simply must not exist.
      expect(
        /canSeeMoney[^\n]*(hidden|invisible|sr-only|display:\s*none)/.test(source),
        `${file} appears to hide money with a class instead of omitting it`,
      ).toBe(false);
    }
  });

  it("the Sales dashboard reaches the ERP only through guardedQuery, never Prisma", () => {
    const erpModules = [
      "src/lib/sales-queries.ts",
      "src/app/(main)/dashboards/sales/page.tsx",
    ];
    for (const file of erpModules) {
      // Strip comments first: these modules DOCUMENT the ban in prose, and a comment naming the
      // forbidden call must not read as the forbidden call itself.
      const source = readFileSync(resolve(ROOT, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/[^\n]*$/gm, "");
      expect(/\$queryRaw/.test(source), `${file} must not use $queryRaw for ERP reads`).toBe(false);
      expect(
        /prisma\.(?!appSetting)/.test(source),
        `${file} must not read ERP tables through Prisma`,
      ).toBe(false);
    }
  });

  // ---------------------------------------------------------------------------------------------
  // erp-dashboards Phase 3 — APPEND ONLY. `/dashboards/purchase` (list + PO detail) is a
  // business-data ERP route, so both pages MUST call requireAuth() and carry the money-visibility
  // gate (AC9), same contract as Phase 2's Sales dashboard.
  // ---------------------------------------------------------------------------------------------
  const PURCHASE_DASHBOARD_PAGES = [
    "src/app/(main)/dashboards/purchase/page.tsx",
    "src/app/(main)/dashboards/purchase/[poNo]/page.tsx",
  ];

  for (const file of PURCHASE_DASHBOARD_PAGES) {
    it(`ERP dashboard page ${file} calls requireAuth`, () => {
      const source = readFileSync(resolve(ROOT, file), "utf8");
      expect(/export default async function/.test(source), `${file} is a default async page`).toBe(
        true,
      );
      expect(/requireAuth\(/.test(source), `${file} must call requireAuth()`).toBe(true);
    });

    it(`${file} derives money visibility from the SERVER session, not the client`, () => {
      const source = readFileSync(resolve(ROOT, file), "utf8");
      expect(
        /const\s+canSeeMoney\s*=\s*user\.role\s*===\s*"ADMIN"/.test(source),
        `${file} must compute canSeeMoney from the server-side session role`,
      ).toBe(true);
      expect(/"use client"/.test(source), `${file} must stay a server component`).toBe(false);
    });
  }

  it("the Purchase dashboard reaches the ERP only through guardedQuery, never Prisma", () => {
    const erpModules = [
      "src/lib/purchase-data.ts",
      "src/app/(main)/dashboards/purchase/page.tsx",
      "src/app/(main)/dashboards/purchase/[poNo]/page.tsx",
    ];
    for (const file of erpModules) {
      const source = readFileSync(resolve(ROOT, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/[^\n]*$/gm, "");
      expect(/\$queryRaw/.test(source), `${file} must not use $queryRaw for ERP reads`).toBe(false);
      expect(
        /prisma\.(?!appSetting)/.test(source),
        `${file} must not read ERP tables through Prisma`,
      ).toBe(false);
    }
  });

  // ---------------------------------------------------------------------------------------------
  // erp-dashboards Phase 4 — APPEND ONLY. `/dashboards/production` (MO list + MO detail) is a
  // business-data ERP route. Unlike Sales/Purchase, Production has NO money data at all (no
  // `canSeeMoney` gate exists by design — see phase-04 report), so only the requireAuth() +
  // guardedQuery-only checks apply here.
  // ---------------------------------------------------------------------------------------------
  const PRODUCTION_DASHBOARD_PAGES = [
    "src/app/(main)/dashboards/production/page.tsx",
    "src/app/(main)/dashboards/production/[moNumber]/page.tsx",
  ];

  for (const file of PRODUCTION_DASHBOARD_PAGES) {
    it(`ERP dashboard page ${file} calls requireAuth`, () => {
      const source = readFileSync(resolve(ROOT, file), "utf8");
      expect(/export default async function/.test(source), `${file} is a default async page`).toBe(
        true,
      );
      expect(/requireAuth\(/.test(source), `${file} must call requireAuth()`).toBe(true);
    });
  }

  it("the Production dashboard reaches the ERP only through guardedQuery, never Prisma", () => {
    const erpModules = [
      "src/lib/production-data.ts",
      "src/app/(main)/dashboards/production/page.tsx",
      "src/app/(main)/dashboards/production/[moNumber]/page.tsx",
    ];
    for (const file of erpModules) {
      const source = readFileSync(resolve(ROOT, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/[^\n]*$/gm, "");
      expect(/\$queryRaw/.test(source), `${file} must not use $queryRaw for ERP reads`).toBe(false);
      expect(
        /prisma\.(?!appSetting)/.test(source),
        `${file} must not read ERP tables through Prisma`,
      ).toBe(false);
    }
  });

  // ---------------------------------------------------------------------------------------------
  // erp-dashboards Phase 5 — APPEND ONLY. The FIRST authenticated API ROUTE HANDLERS in this
  // codebase, and therefore the first to need a route-handler coverage pattern here.
  //
  // The `extractExportedActions` parser above splits on `export async function` and works for
  // server actions; a route handler is the same shape but the exported name is the HTTP verb, so
  // `extractExportedHandlers` below reuses the identical "parse the exported function, assert the
  // requireAuth call is inside it" logic, restricted to verb names.
  //
  // NOTE on the pre-existing `GET`-regex a few blocks up: that one asserts the two INTENTIONALLY
  // PUBLIC health probes do NOT call requireAuth. It is the opposite assertion to this block, not
  // an existing version of it.
  // ---------------------------------------------------------------------------------------------
  const HTTP_VERBS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

  /** Split a route module into { verb, body } chunks, one per exported HTTP handler. */
  function extractExportedHandlers(source: string): { verb: string; body: string }[] {
    const parts = source.split(/export async function\s+/g);
    return parts
      .slice(1)
      .map((chunk) => ({ verb: chunk.match(/^([A-Za-z0-9_]+)/)?.[1] ?? "<unknown>", body: chunk }))
      .filter((h) => (HTTP_VERBS as readonly string[]).includes(h.verb));
  }

  // Business-data ERP routes. Unlike `/api/health/erp` these return real rows, so EVERY exported
  // handler must be auth-guarded. `/api/test/erp-force-down` returns no business data but is a test
  // affordance, so it is guarded too (and additionally refuses to exist outside development).
  const AUTHED_API_ROUTES: { file: string; expected: string[] }[] = [
    { file: "src/app/api/dashboards/export/route.ts", expected: ["GET"] },
    { file: "src/app/api/test/erp-force-down/route.ts", expected: ["GET", "POST"] },
  ];

  for (const route of AUTHED_API_ROUTES) {
    it(`every exported handler in ${route.file} calls requireAuth`, () => {
      const source = readFileSync(resolve(ROOT, route.file), "utf8");
      const handlers = extractExportedHandlers(source);
      const verbs = handlers.map((h) => h.verb);

      // Sanity: the parser found what we expect (guards against a rename/parse drift).
      for (const verb of route.expected) {
        expect(verbs, `expected handler ${verb} present in ${route.file}`).toContain(verb);
      }

      const missing = handlers.filter((h) => !/requireAuth/.test(h.body)).map((h) => h.verb);
      expect(missing, `handlers missing a requireAuth call in ${route.file}`).toEqual([]);
    });
  }

  it("the CSV export route derives money visibility from the SERVER session, not the request", () => {
    const file = "src/app/api/dashboards/export/route.ts";
    const source = readFileSync(resolve(ROOT, file), "utf8");
    expect(
      /const\s+canSeeMoney\s*=\s*user\.role\s*===\s*"ADMIN"/.test(source),
      `${file} must compute canSeeMoney from the awaited requireAuth() result`,
    ).toBe(true);
    expect(/"use client"/.test(source), `${file} must stay server-side`).toBe(false);
  });

  it("the test-only ERP force-down route is off in production unless explicitly opted in", () => {
    const file = "src/app/api/test/erp-force-down/route.ts";
    const source = readFileSync(resolve(ROOT, file), "utf8");
    // Every handler must consult the environment gate before doing anything else.
    for (const handler of extractExportedHandlers(source)) {
      expect(
        /forceDownRouteEnabled\(\)/.test(handler.body),
        `${file}:${handler.verb} must refuse to run when the environment gate is closed`,
      ).toBe(true);
    }
    // The gate itself: production is off by default, and the opt-in accepts ONLY the exact "1".
    const guard = readFileSync(resolve(ROOT, "src/lib/erp/force-down.ts"), "utf8");
    expect(/NODE_ENV\s*!==\s*"production"/.test(guard)).toBe(true);
    expect(/ERP_TEST_FORCE_DOWN\s*===\s*"1"/.test(guard)).toBe(true);
  });

  it("the force-down toggle can never weaken the read-only guard", () => {
    const adapter = readFileSync(resolve(ROOT, "src/lib/erp/erp-adapter.ts"), "utf8");
    // It may only THROW — it must never skip, relax or branch around assertReadOnlySql.
    expect(/if \(isErpForcedDown\(\)\) \{\s*throw new ErpForcedDownError\(\);\s*\}/.test(adapter)).toBe(
      true,
    );
    expect(/assertReadOnlySql\(sql\);/.test(adapter)).toBe(true);
    // The module holds a boolean and nothing else — no SQL, no pool, no credentials. Comments are
    // stripped first: this file DOCUMENTS why an env-var-based toggle was rejected, and naming
    // `ERP_DATABASE_URL` in that explanation must not read as using it.
    const guard = readFileSync(resolve(ROOT, "src/lib/erp/force-down.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/[^\n]*$/gm, "");
    expect(/mssql|ConnectionPool|DATABASE_URL|password/i.test(guard)).toBe(false);
  });
});
