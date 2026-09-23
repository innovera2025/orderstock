import { test, expect, type Browser, type Page } from "@playwright/test";

// erp-dashboards Phase 5 — AC15 (graceful degrade) + AC16 (data-range banner) across ALL THREE
// dashboards at once, plus the AC2 unauth-redirect re-confirmation for Purchase and Production.
//
// Precondition (Hybrid infrastructure, LOCAL ONLY): the `orderstock-sql` container is up, all
// `db/erp-fixture/*.sql` seeds are applied, and `ERP_DATABASE_URL` points at `erp_fixture`.
// These specs NEVER touch `db_TCL`.
//
// RUN REQUIREMENT: the server under test must be started with `ERP_TEST_FORCE_DOWN=1` (alongside
// `ERP_DATABASE_URL`). The e2e suite runs a real production build, where the toggle route is OFF
// unless that flag is explicitly set. Without it these AC15 scenarios fail fast on a 404 from the
// toggle — deliberately loud, rather than silently skipping the way Phase 2's own test does.
//
// HOW THE OUTAGE IS FORCED (plan Steps 0.3a/0.3b). Phase 2's own degraded-mode test SELF-SKIPS —
// it asserts the degrade UI only if the sandbox happens to already be down — so nothing in P1-P4
// can actually force the condition. Phase 5 adds a test-only, `NODE_ENV !== "production"`-gated
// route (`/api/test/erp-force-down`) that flips an in-memory flag `guardedQuery` checks per call.
//
// WHY NOT AN ENV VAR: `playwright.config.ts` reuses ONE `pnpm start` process for the whole suite
// and `getErpPool()` caches its pool as a `globalThis` singleton bound to the URL in effect at
// first connect. Changing an env var mid-suite would either break every other spec or do nothing.
//
// SEQUENCING IS LOAD-BEARING: `cache.ts` serves a stale value ONLY when a prior successful fetch
// already populated that cache key; on a cold cache it re-throws and the page renders its explicit
// "ERP unavailable" screen instead. So each scenario below WARMS the cache (visits while healthy)
// BEFORE flipping the toggle. Skipping the warm-up would false-fail onto `*-unavailable.tsx`
// rather than proving the "ข้อมูลอาจไม่ล่าสุด" degrade banner.

const RANGE = "from=2026-08-01&to=2026-09-30";

const DEGRADE_TEXT = "ข้อมูลอาจไม่ล่าสุด";
// The banner's neutral chip label (23-09-26: it reports the real ERP data range now, rather than
// repeating a fixed "pilot data" warning). Kept as the chip text so the AC16 "banner present at all
// times" checks still have a stable, wording-independent anchor.
const PILOT_TEXT = "ช่วงข้อมูล";

/** The three dashboards, their root-level testid, and the URL that shows real fixture rows. */
const DASHBOARDS = [
  { name: "sales", testId: "sales-dashboard", url: `/dashboards/sales?view=documents&${RANGE}` },
  { name: "purchase", testId: "purchase-dashboard", url: `/dashboards/purchase?${RANGE}` },
  { name: "production", testId: "production-dashboard", url: `/dashboards/production?${RANGE}` },
] as const;

function ctx(browser: Browser, role: "admin" | "staff" = "admin") {
  return browser.newContext({ storageState: `e2e/.auth/${role}.json` });
}

/**
 * Flip the server-side simulated-outage toggle. Always restored in a `finally`.
 *
 * While the toggle is on, `getCached` also bypasses TTL freshness. Without that, the 5-minute TTL
 * would keep serving a FRESH cached value, the fetcher would never run, and the outage would be
 * invisible — the scenario would pass for the wrong reason.
 */
async function setErpDown(page: Page, down: boolean) {
  const response = await page.request.post(`/api/test/erp-force-down?down=${down ? "1" : "0"}`);
  expect(response.status(), "the test-only force-down toggle must be reachable").toBe(200);
  expect(await response.json()).toEqual({ forcedDown: down });
}

// ---------------------------------------------------------------------------------------------
// AC16 — the pilot banner is present on all three dashboards under NORMAL conditions ("at all
// times", per the SPEC — so it is asserted here as a set, not just per dashboard).
// ---------------------------------------------------------------------------------------------
test.describe("AC16 — data-range banner on all three dashboards", () => {
  for (const role of ["admin", "staff"] as const) {
    test(`every dashboard shows "${PILOT_TEXT}" for ${role}`, async ({ browser }) => {
      const context = await ctx(browser, role);
      const page = await context.newPage();

      for (const dashboard of DASHBOARDS) {
        await page.goto(dashboard.url);
        await expect(page.getByTestId(dashboard.testId)).toBeVisible();
        const banner = page.getByTestId("pilot-banner");
        await expect(banner, `${dashboard.name}: pilot banner visible`).toBeVisible();
        await expect(banner).toContainText(PILOT_TEXT);
      }
      await context.close();
    });
  }

  // USER DECISION GATE (23-09-26, option 3): the banner must state each dashboard's REAL data
  // range, not a fixed warning. These strings are the `erp_fixture` seeds' actual first/last
  // document dates and row counts, in Buddhist Era — a hardcoded or filter-derived range would
  // fail here.
  //
  //   sales      SalesInvoiceHdr      3 rows, 2026-08-31 .. 2026-09-20 -> 31/8/69 .. 20/9/69
  //              + tbl_DOhdr         14 rows, 2026-08-03 .. 2026-09-22 ->  3/8/69 .. 22/9/69
  //              the span is the UNION of both (earliest 3/8/69, latest 22/9/69) and the counts
  //              follow in render order, invoice first, because the headline figure is now
  //              invoice-based
  //   purchase   PurchaseOrderHdr     5 rows, 2026-08-14 .. 2026-09-11 -> 14/8/69 .. 11/9/69
  //   production tbl_MoHdr           12 rows, 2026-08-20 .. 2026-09-08 -> 20/8/69 .. 8/9/69
  //
  // The counts include rows the dashboards themselves filter out (cancelled POs/MOs): the notice
  // reports what the ERP HOLDS, which is exactly the point of the change.
  const EXPECTED_RANGE_TEXT: Record<string, string> = {
    sales:
      "ข้อมูลในระบบ ERP มีตั้งแต่ 3/8/69 ถึง 22/9/69 · ใบแจ้งหนี้ขาย 3 ใบ · ใบส่งสินค้า 14 ใบ",
    purchase: "ข้อมูลในระบบ ERP มีตั้งแต่ 14/8/69 ถึง 11/9/69 · ใบสั่งซื้อ 5 ใบ",
    production: "ข้อมูลในระบบ ERP มีตั้งแต่ 20/8/69 ถึง 8/9/69 · ใบสั่งผลิต 12 ใบ",
  };

  test("each banner states the fixture's REAL first/last document dates and count", async ({
    browser,
  }) => {
    const context = await ctx(browser);
    const page = await context.newPage();

    for (const dashboard of DASHBOARDS) {
      await page.goto(dashboard.url);
      await expect(page.getByTestId(dashboard.testId)).toBeVisible();
      await expect(
        page.getByTestId("pilot-banner"),
        `${dashboard.name}: the banner must report the ERP's real data range`,
      ).toContainText(EXPECTED_RANGE_TEXT[dashboard.name]);
    }

    // And it must NOT change when the page's own date filter narrows: the notice describes the
    // ERP, not the current selection.
    await page.goto("/dashboards/sales?from=2026-09-01&to=2026-09-05");
    await expect(page.getByTestId("sales-dashboard")).toBeVisible();
    await expect(page.getByTestId("pilot-banner")).toContainText(EXPECTED_RANGE_TEXT.sales);

    await context.close();
  });

  test("the retired fixed pilot sentence is gone from every dashboard", async ({ browser }) => {
    const context = await ctx(browser);
    const page = await context.newPage();
    for (const dashboard of DASHBOARDS) {
      await page.goto(dashboard.url);
      await expect(page.getByTestId(dashboard.testId)).toBeVisible();
      await expect(page.locator("body")).not.toContainText("ข้อมูลชุดนี้อยู่ระหว่างช่วงนำร่อง");
    }
    await context.close();
  });

  test("the pilot banner is also present on both drilldown routes", async ({ browser }) => {
    const context = await ctx(browser);
    const page = await context.newPage();

    await page.goto(`/dashboards/purchase?${RANGE}`);
    await page.locator('[data-testid^="po-link-"]').first().click();
    await expect(page.getByTestId("po-lines-table")).toBeVisible();
    await expect(page.getByTestId("pilot-banner")).toContainText(PILOT_TEXT);

    await page.goto(`/dashboards/production/MO-2609-0001?${RANGE}`);
    await expect(page.getByTestId("production-mo-detail")).toBeVisible();
    await expect(page.getByTestId("pilot-banner")).toContainText(PILOT_TEXT);

    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// AC15 — all three dashboards degrade gracefully, SIMULTANEOUSLY, under a forced ERP outage.
// ---------------------------------------------------------------------------------------------
test.describe("AC15 — graceful degrade across the whole dashboard set", () => {
  test("all three show last-cached figures + the degrade banner, never an error or blank page", async ({
    browser,
  }) => {
    const context = await ctx(browser);
    const page = await context.newPage();

    try {
      // 1. WARM: visit each dashboard while the ERP is healthy so every cache key is populated,
      //    and capture what each one rendered.
      await setErpDown(page, false);
      const healthy: Record<string, string> = {};
      for (const dashboard of DASHBOARDS) {
        await page.goto(dashboard.url);
        await expect(page.getByTestId(dashboard.testId)).toBeVisible();
        await expect(page.getByTestId("degrade-banner")).toHaveCount(0);
        healthy[dashboard.name] =
          (await page.getByTestId(dashboard.testId).textContent()) ?? "";
        expect(healthy[dashboard.name].length).toBeGreaterThan(0);
      }

      // 2. FAIL: force the outage. Every subsequent ERP read throws before touching the pool.
      await setErpDown(page, true);

      // 3. RELOAD: each dashboard must still render its content, now behind the degrade banner.
      for (const dashboard of DASHBOARDS) {
        await page.goto(dashboard.url);

        await expect(
          page.getByTestId(dashboard.testId),
          `${dashboard.name}: the dashboard must still render during an outage`,
        ).toBeVisible();

        const banner = page.getByTestId("degrade-banner");
        await expect(banner, `${dashboard.name}: degrade banner`).toBeVisible();
        await expect(banner).toContainText(DEGRADE_TEXT);

        // Never a generic error page, and never a blank screen.
        await expect(page.locator("body")).not.toContainText("Application error");
        await expect(page.locator("body")).not.toContainText("Internal Server Error");

        // The LAST-CACHED figures are what is being shown — not an empty shell.
        const degraded = (await page.getByTestId(dashboard.testId).textContent()) ?? "";
        expect(
          degraded.length,
          `${dashboard.name}: degraded render must still carry the cached content`,
        ).toBeGreaterThan(0);
      }

      // 4. The pilot banner survives the outage too (AC16 says "at all times").
      await expect(page.getByTestId("pilot-banner")).toContainText(PILOT_TEXT);
    } finally {
      // Always restore, even on failure — a stuck flag would poison every later spec.
      await setErpDown(page, false);
      await context.close();
    }
  });

  test("the degrade banner disappears once the ERP recovers", async ({ browser }) => {
    const context = await ctx(browser);
    const page = await context.newPage();
    const sales = DASHBOARDS[0];

    try {
      await setErpDown(page, false);
      await page.goto(sales.url);
      await expect(page.getByTestId(sales.testId)).toBeVisible();

      await setErpDown(page, true);
      await page.goto(sales.url);
      await expect(page.getByTestId("degrade-banner")).toBeVisible();

      await setErpDown(page, false);
      await page.goto(sales.url);
      await expect(page.getByTestId(sales.testId)).toBeVisible();
      await expect(page.getByTestId("degrade-banner")).toHaveCount(0);
    } finally {
      await setErpDown(page, false);
      await context.close();
    }
  });

  test("the ERP health probe reports the outage rather than 500ing", async ({ browser }) => {
    const context = await ctx(browser);
    const page = await context.newPage();
    try {
      await setErpDown(page, true);
      const response = await page.request.get("/api/health/erp");
      // The degrade contract: a served response, never an error page.
      expect(response.status()).toBe(200);
      expect((await response.json()).ok).toBe(false);
    } finally {
      await setErpDown(page, false);
      await context.close();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// AC2 re-confirmation — Purchase and Production only.
//
// Sales' AC2 is already proved by Phase 2's own spec and is deliberately NOT re-derived here.
// Phase 3 and Phase 4 each already added an unauth-redirect assertion for their own route
// (confirmed during RESEARCH Step 0), so these two are a mechanical re-confirmation of the pair
// as a SET — cheap, and it fails loudly if either phase's own assertion is ever removed.
// ---------------------------------------------------------------------------------------------
test.describe("AC2 — unauthenticated access to Purchase and Production redirects to login", () => {
  for (const route of ["/dashboards/purchase", "/dashboards/production"] as const) {
    test(`an unauthenticated request to ${route} redirects to login`, async ({ browser }) => {
      const context = await browser.newContext(); // no storage state => no session
      const page = await context.newPage();
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
      await context.close();
    });
  }
});
