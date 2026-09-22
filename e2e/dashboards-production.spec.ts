import { test, expect, type Page } from "@playwright/test";

// erp-dashboards Phase 4 — /dashboards/production gates.
//
// Precondition (Hybrid infrastructure, LOCAL ONLY): the `orderstock-sql` container is up,
// `db/erp-fixture/production-seed.sql` has been applied on top of Phase 1's base fixture, and
// `ERP_DATABASE_URL` points at `erp_fixture`. These specs NEVER touch `db_TCL`.
//
// Every scenario pins an explicit `from`/`to` covering the whole seeded range, so results do not
// drift with the calendar.
//
// The mobile-card scenario uses an in-file `test.use({ viewport })` override rather than a new
// Playwright project (Phase 2's PVL-resolved pattern) — the `mobile` project's `testMatch` regex
// does not pick up this file, and `playwright.config.ts` is owned by no phase in the registry.

const RANGE = "from=2026-08-01&to=2026-09-30";
const PRODUCTION = `/dashboards/production?${RANGE}`;

/** The seeded fixture's truth — mirrors `db/erp-fixture/production-seed.sql`. */
const FIXTURE = {
  liveMoCount: 11,
  cancelledMoNumber: "MO-2608-0012",
  pageSize: 10,
  pendingCount: 5,
  approvedCount: 4,
  closedCount: 2,
  moWithIssues: { moNumber: "MO-2609-0001", lines: 7 },
  moWithoutIssues: "MO-2608-0004",
  plannedKg: "4,761",
};

const ACTUAL_EMPTY = "ยังไม่มีข้อมูลผลิตจริง";

function ctx(browser: import("@playwright/test").Browser, role: "admin" | "staff") {
  return browser.newContext({ storageState: `e2e/.auth/${role}.json` });
}

async function openAs(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByTestId("production-dashboard")).toBeVisible();
}

// ---------------------------------------------------------------------------------------------
// AC1 — the nav entry exists and opens a working page for both roles.
// ---------------------------------------------------------------------------------------------
test.describe("AC1 — access", () => {
  for (const role of ["admin", "staff"] as const) {
    test(`the แดชบอร์ด nav Production link opens a working page for ${role}`, async ({
      browser,
    }) => {
      const context = await ctx(browser, role);
      const page = await context.newPage();
      await page.goto("/orders");
      await page.locator('#app-sidebar a[href="/dashboards/production"]').click();

      await expect(page).toHaveURL(/\/dashboards\/production/);
      await expect(page.getByTestId("production-dashboard")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: "การผลิต" })).toBeVisible();
      await expect(page.getByTestId("pilot-banner")).toBeVisible();

      await context.close();
    });
  }

  test("an unauthenticated request to /dashboards/production redirects to login", async ({
    browser,
  }) => {
    const context = await browser.newContext(); // no storage state
    const page = await context.newPage();
    await page.goto(PRODUCTION);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId("production-dashboard")).toHaveCount(0);
    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// AC7 — plan-only: the actual column is always the Thai empty state, and no achievement % exists.
// ---------------------------------------------------------------------------------------------
test.describe("AC7 — plan-only, no achievement percentage", () => {
  test("every MO row's ผลิตจริง cell renders the Thai empty-state string", async ({ browser }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, PRODUCTION);

    const cells = page.getByTestId("mo-actual-produced");
    // 10 in the desktop table + 10 in the mobile card list (both are server-rendered).
    expect(await cells.count()).toBeGreaterThanOrEqual(FIXTURE.pageSize);
    for (const cell of await cells.all()) {
      await expect(cell).toHaveText(ACTUAL_EMPTY);
    }

    await expect(page.getByTestId("production-plan-only-note")).toContainText(
      "ไม่มีการคำนวณเปอร์เซ็นต์ความสำเร็จ",
    );

    await context.close();
  });

  test("no achievement percentage appears anywhere in the server-rendered HTML", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, PRODUCTION);

    const body = (await page.locator("body").innerText()).replace(
      "ไม่มีการคำนวณเปอร์เซ็นต์ความสำเร็จ",
      "",
    );
    // No "NN%" figure and no achievement wording survive once the disclaimer is removed.
    expect(body).not.toMatch(/\d\s*%/);
    expect(body).not.toContain("ความสำเร็จ");

    await context.close();
  });

  test("KPI tiles show the MO count and per-unit planned quantity, never a cross-unit total", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, PRODUCTION);

    await expect(page.getByTestId("kpi-mo-count")).toContainText(String(FIXTURE.liveMoCount));
    const unitRows = page
      .getByTestId("kpi-planned-qty-by-unit")
      .locator('[data-testid^="kpi-planned-qty-unit-"]');
    expect(await unitRows.count()).toBeGreaterThanOrEqual(2);
    await expect(page.getByTestId("kpi-planned-qty-unit-KG")).toContainText(FIXTURE.plannedKg);
    // 5,021 would be the (meaningless) sum across KG + BAG + no-unit.
    await expect(page.getByTestId("kpi-planned-qty")).not.toContainText("5,021");

    await context.close();
  });

  test("the cancelled MO never appears in the list", async ({ browser }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, `${PRODUCTION}&sort=moNo`);
    await expect(page.locator("body")).not.toContainText(FIXTURE.cancelledMoNumber);
    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// Chart + donut geometry — bars/arcs must have real, non-zero size (the Phase 2 regression).
// ---------------------------------------------------------------------------------------------
test.describe("chart and donut have real geometry", () => {
  test("every planned-quantity bar has a non-zero rendered width", async ({ browser }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, PRODUCTION);

    const bars = page.locator('[data-testid^="production-plan-bar-"]');
    const count = await bars.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      const box = await bars.nth(i).boundingBox();
      expect(box, "a bar must be laid out").not.toBeNull();
      expect(box!.width).toBeGreaterThan(2);
    }
    // The largest value must render wider than the smallest — the scale is proportional.
    const widths = await bars.evaluateAll((els) =>
      els.map((el) => ({
        v: Number((el as HTMLElement).dataset.value),
        w: (el as HTMLElement).getBoundingClientRect().width,
      })),
    );
    const max = widths.reduce((a, b) => (b.v > a.v ? b : a));
    const min = widths.reduce((a, b) => (b.v < a.v ? b : a));
    expect(max.w).toBeGreaterThan(min.w);

    await context.close();
  });

  test("the status donut renders arcs, a centre total and the small-sample note", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, PRODUCTION);

    const donut = page.getByTestId("production-status-donut");
    await expect(donut).toBeVisible();
    for (const key of ["pending", "approved", "closed"]) {
      const slice = page.getByTestId(`production-status-slice-${key}`);
      await expect(slice).toHaveCount(1);
      const box = await slice.boundingBox();
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.height).toBeGreaterThan(0);
    }
    await expect(donut).toContainText(String(FIXTURE.liveMoCount));
    await expect(page.getByTestId("production-small-sample-note")).toContainText("n = 11");

    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// AC10 — filter round-trip through the URL.
// ---------------------------------------------------------------------------------------------
test.describe("AC10 — filter URL round-trip", () => {
  test("submitting the status filter narrows the list and survives a reload", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, PRODUCTION);

    await page.getByTestId("production-status-filter").selectOption("closed");
    await page.getByTestId("production-apply-filters").click();

    await expect(page).toHaveURL(/status=closed/);
    await expect(page.getByTestId("production-status-donut")).toBeVisible();
    await expect(page.getByTestId("kpi-mo-count")).toContainText(String(FIXTURE.closedCount));
    await expect(page.getByTestId("chip-status")).toContainText("ปิดแล้ว");

    await page.reload();
    await expect(page.getByTestId("kpi-mo-count")).toContainText(String(FIXTURE.closedCount));

    // The donut keeps the FULL distribution so another status is still clickable.
    await expect(page.getByTestId("production-status-legend-pending")).toContainText(
      `${FIXTURE.pendingCount} ใบ`,
    );

    // Clearing the chip returns to the unfiltered list.
    await page.getByTestId("chip-status-clear").click();
    await expect(page.getByTestId("kpi-mo-count")).toContainText(String(FIXTURE.liveMoCount));

    await context.close();
  });

  test("a narrower date range is a real bound", async ({ browser }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, "/dashboards/production?from=2026-09-01&to=2026-09-30");
    await expect(page.getByTestId("kpi-mo-count")).toContainText("3");
    await context.close();
  });

  test("clicking a donut slice filters the table", async ({ browser }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, PRODUCTION);

    await page.getByTestId("production-status-legend-approved").click();
    await expect(page).toHaveURL(/status=approved/);
    await expect(page.getByTestId("kpi-mo-count")).toContainText(String(FIXTURE.approvedCount));

    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// AC8 / AC11 — MO drilldown into its raw-material issues, plus the empty state.
// ---------------------------------------------------------------------------------------------
test.describe("AC8/AC11 — material-issue drilldown", () => {
  test("clicking an MO opens its material-issue list at a bookmarkable URL", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, `${PRODUCTION}&sort=-moNo`);

    await page.getByTestId(`mo-row-${FIXTURE.moWithIssues.moNumber}`).first().click();

    await expect(page).toHaveURL(
      new RegExp(`/dashboards/production/${FIXTURE.moWithIssues.moNumber}`),
    );
    await expect(page.getByTestId("production-mo-detail")).toBeVisible();
    await expect(page.getByTestId("mo-detail-actual-produced")).toHaveText(ACTUAL_EMPTY);
    // The NULL-LotQty MO shows its Prodqty fallback note, never an "actual" claim.
    await expect(page.getByTestId("production-mo-detail")).toContainText("จำนวนสั่งผลิต (Prodqty)");

    const rows = page.getByTestId("dashboard-data-table").locator("tbody tr");
    await expect(rows).toHaveCount(FIXTURE.moWithIssues.lines);

    // Reloading the bookmarked URL reproduces the same view.
    await page.reload();
    await expect(page.getByTestId("production-mo-detail")).toBeVisible();

    // Breadcrumb returns to the filtered list.
    await page.getByTestId("production-breadcrumb-list").click();
    await expect(page.getByTestId("production-dashboard")).toBeVisible();

    await context.close();
  });

  test("an MO with no linked issues shows the Thai empty state, not an error", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await page.goto(`/dashboards/production/${FIXTURE.moWithoutIssues}?${RANGE}`);

    await expect(page.getByTestId("production-mo-detail")).toBeVisible();
    await expect(page.locator("body")).toContainText(
      "ไม่มีรายการเบิกวัตถุดิบสำหรับใบสั่งผลิตนี้",
    );

    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// AC12 — sort + paginate without losing the active filters.
// ---------------------------------------------------------------------------------------------
test.describe("AC12 — sort and paginate preserve filters", () => {
  test("sorting keeps the date range and reorders the rows", async ({ browser }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, PRODUCTION);

    const firstCell = () =>
      page.getByTestId("dashboard-data-table").locator("tbody tr").first().locator("td").first();
    const before = await firstCell().innerText();

    await page.getByTestId("sort-moNo").click();
    await expect(page).toHaveURL(/sort=moNo/);
    await expect(page).toHaveURL(/from=2026-08-01/);
    expect(await firstCell().innerText()).not.toBe(before);

    await context.close();
  });

  test("paging to page 2 keeps the filters and shows the remaining rows", async ({ browser }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, PRODUCTION);

    await expect(page.getByTestId("data-table-page-label")).toContainText("หน้า 1 จาก 2");
    await page.getByTestId("data-table-next").click();

    await expect(page).toHaveURL(/page=2/);
    await expect(page).toHaveURL(/from=2026-08-01/);
    await expect(page.getByTestId("data-table-page-label")).toContainText("หน้า 2 จาก 2");
    await expect(page.getByTestId("dashboard-data-table").locator("tbody tr")).toHaveCount(
      FIXTURE.liveMoCount - FIXTURE.pageSize,
    );

    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// AC13 — phone width renders the card list, not the desktop table.
// ---------------------------------------------------------------------------------------------
test.describe("AC13 — mobile card view", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("at 390x844 the MO list renders as cards and nothing overflows horizontally", async ({
    browser,
  }) => {
    const context = await ctx(browser, "staff");
    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await openAs(page, PRODUCTION);

    await expect(page.getByTestId("dashboard-data-cards")).toBeVisible();
    await expect(page.getByTestId("dashboard-data-table").locator("table")).toBeHidden();
    await expect(page.getByTestId("mo-actual-produced").first()).toHaveText(ACTUAL_EMPTY);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await context.close();
  });
});
