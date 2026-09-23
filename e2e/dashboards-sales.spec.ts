import { test, expect, type Page } from "@playwright/test";

// erp-dashboards Phase 2 — /dashboards/sales gates.
//
// Precondition (Hybrid infrastructure, LOCAL ONLY): the `orderstock-sql` container is up,
// `db/erp-fixture/sales-seed.sql` has been applied on top of Phase 1's base fixture, and
// `ERP_DATABASE_URL` points at `erp_fixture`. These specs NEVER touch `db_TCL`.
//
// Every scenario pins an explicit `from`/`to` covering the whole seeded range, so results do not
// drift with the calendar.
//
// The mobile-card scenario uses an in-file `test.use({ viewport })` override rather than a new
// Playwright project — `playwright.config.ts` is owned by no phase in the registry, so this phase
// deliberately does not edit it. Phases 3 and 4 should reuse this same pattern.

const RANGE = "from=2026-08-01&to=2026-09-30";
const SALES = `/dashboards/sales?${RANGE}`;

/** The seeded fixture's truth — mirrors `db/erp-fixture/sales-seed.sql`. */
const FIXTURE = {
  doCount: 14,
  lineCount: 35,
  pricedLineCount: 6,
  total: "10,111.00",
  excludedTotal: "858,937.21",
  coverage: "17.1",
  checkedStatusCount: 5,
  pageSize: 10,
  /** Distinct ItemCode across the seeded lines — deliberately > one 10-row breakdown page. */
  productCount: 14,
  /** Distinct CustCode across the seeded headers — one breakdown page. */
  customerCount: 4,
};

async function openAs(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByTestId("sales-dashboard")).toBeVisible();
}

function ctx(browser: import("@playwright/test").Browser, role: "admin" | "staff") {
  return browser.newContext({ storageState: `e2e/.auth/${role}.json` });
}

// ---------------------------------------------------------------------------------------------
// AC1 / AC2 — the page exists for both roles; an unauthenticated request is redirected to login.
// ---------------------------------------------------------------------------------------------
test.describe("AC1/AC2 — access", () => {
  for (const role of ["admin", "staff"] as const) {
    test(`the แดชบอร์ด nav Sales link opens a working page for ${role}`, async ({ browser }) => {
      const context = await ctx(browser, role);
      const page = await context.newPage();
      await page.goto("/orders");
      await page.locator('#app-sidebar a[href="/dashboards/sales"]').click();

      await expect(page).toHaveURL(/\/dashboards\/sales/);
      await expect(page.getByTestId("sales-dashboard")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: "ยอดขาย" })).toBeVisible();
      await expect(page.getByTestId("pilot-banner")).toBeVisible();

      await context.close();
    });
  }

  test("an unauthenticated request to /dashboards/sales redirects to login", async ({ browser }) => {
    const context = await browser.newContext(); // no storage state
    const page = await context.newPage();
    await page.goto(SALES);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId("sales-dashboard")).toHaveCount(0);
    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// AC3 / AC4 — the reconciled figures, the coverage %, and the footnote that names the excluded pool.
// ---------------------------------------------------------------------------------------------
test.describe("AC3/AC4 — reconciliation, coverage and footnote", () => {
  test("KPI tiles show the reconciled DO count, line count and per-unit quantities", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, SALES);

    await expect(page.getByTestId("kpi-do-count")).toContainText(String(FIXTURE.doCount));
    await expect(page.getByTestId("kpi-line-count")).toContainText(String(FIXTURE.lineCount));

    // Quantities render one row PER UNIT — never a single combined cross-unit number.
    const unitRows = page.getByTestId("kpi-qty-by-unit").locator('[data-testid^="kpi-qty-unit-"]');
    expect(await unitRows.count()).toBeGreaterThanOrEqual(2);

    await context.close();
  });

  test("the money tile shows the priced-only label, the coverage %, and the excluded-total footnote", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, SALES);

    const money = page.getByTestId("kpi-money");
    await expect(money).toContainText("ยอดเงินเฉพาะรายการที่มีราคา");
    await expect(page.getByTestId("kpi-money-amount")).toContainText(FIXTURE.total);

    await expect(page.getByTestId("kpi-money-coverage")).toContainText(`${FIXTURE.coverage}%`);
    await expect(page.getByTestId("kpi-money-coverage")).toContainText(
      String(FIXTURE.pricedLineCount),
    );

    // The footnote must NAME the excluded amount, and sit inside the same tile as the figure so it
    // can never be hidden separately from it.
    const footnote = page.getByTestId("kpi-money-footnote");
    await expect(footnote).toBeVisible();
    await expect(footnote).toContainText(FIXTURE.excludedTotal);
    await expect(footnote).toContainText("SalesInvoiceHdr");
    await expect(money.getByTestId("kpi-money-footnote")).toHaveCount(1);

    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// AC9 — money is gated SERVER-SIDE: a Staff user's HTML contains no money markup at all.
// ---------------------------------------------------------------------------------------------
test.describe("AC9 — money visibility role gate", () => {
  test("ADMIN sees the money tile, chart and columns", async ({ browser }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, SALES);

    await expect(page.getByTestId("kpi-money")).toBeVisible();
    await expect(page.getByTestId("sales-money-chart")).toBeVisible();

    await page.goto(`${SALES}&view=documents`);
    await expect(page.getByTestId("do-list-table")).toContainText("ยอดเงิน");

    await context.close();
  });

  test("STAFF never receives money markup — not hidden, absent from the server-rendered HTML", async ({
    browser,
  }) => {
    const context = await ctx(browser, "staff");
    const page = await context.newPage();
    await openAs(page, SALES);

    await expect(page.getByTestId("kpi-money")).toHaveCount(0);
    await expect(page.getByTestId("kpi-money-amount")).toHaveCount(0);
    await expect(page.getByTestId("kpi-money-footnote")).toHaveCount(0);
    await expect(page.getByTestId("sales-money-chart")).toHaveCount(0);
    await expect(page.getByTestId("kpi-money-locked")).toBeVisible();

    // The figures themselves must not appear ANYWHERE in the markup — a CSS hide would still leave
    // them in the DOM, so this is the assertion that distinguishes server gating from hiding.
    const html = await page.content();
    expect(html).not.toContain(FIXTURE.total);
    expect(html).not.toContain(FIXTURE.excludedTotal);

    // The DO list must also omit the money column entirely for Staff.
    await page.goto(`${SALES}&view=documents`);
    const listHtml = await page.content();
    expect(listHtml).not.toContain(FIXTURE.total);
    await expect(page.getByTestId("do-list-table")).not.toContainText("ยอดเงิน");

    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// AC10 — the date filter round-trips through the URL.
// ---------------------------------------------------------------------------------------------
test.describe("AC10 — filter URL round-trip", () => {
  test("narrowing from/to changes the figures and a reload reproduces the same view", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, SALES);
    await expect(page.getByTestId("kpi-do-count")).toContainText(String(FIXTURE.doCount));

    // August only — a strict subset of the seeded range.
    await page.goto("/dashboards/sales?from=2026-08-01&to=2026-08-31");
    await expect(page.getByTestId("sales-dashboard")).toBeVisible();
    const augustCount = (await page.getByTestId("kpi-do-count").innerText()).match(/(\d+) ใบ/)?.[1];
    expect(augustCount).toBeTruthy();
    expect(Number(augustCount)).toBeLessThan(FIXTURE.doCount);

    // The form fields reflect the URL, and a reload is idempotent.
    await expect(page.getByTestId("sales-from")).toHaveValue("2026-08-01");
    await expect(page.getByTestId("sales-to")).toHaveValue("2026-08-31");
    await page.reload();
    await expect(page.getByTestId("kpi-do-count")).toContainText(`${augustCount} ใบ`);

    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// AC8 — the สัปดาห์ / เดือน / ปี period toggle.
// ---------------------------------------------------------------------------------------------
test.describe("AC8 — period-toggle round-trip", () => {
  test("defaults to เดือน, changes the bin count per granularity, and round-trips through the URL", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, SALES);

    // Default is เดือน with no `period` param in the URL.
    await expect(page.getByTestId("sales-period-month")).toHaveAttribute("aria-pressed", "true");
    const bars = page.getByTestId("sales-count-bars").locator('[data-testid^="sales-count-bars-bar-"]');
    const monthBins = await bars.count();
    expect(monthBins).toBe(2); // 2026-08 and 2026-09

    // ปี collapses the same range into one bar.
    await page.getByTestId("sales-period-year").click();
    await expect(page).toHaveURL(/period=year/);
    await expect(page.getByTestId("sales-period-year")).toHaveAttribute("aria-pressed", "true");
    expect(await bars.count()).toBe(1);

    // สัปดาห์ produces more bins than เดือน.
    await page.getByTestId("sales-period-week").click();
    await expect(page).toHaveURL(/period=week/);
    const weekBins = await bars.count();
    expect(weekBins).toBeGreaterThan(monthBins);

    // A reload reproduces the selected bin exactly.
    await page.reload();
    await expect(page.getByTestId("sales-period-week")).toHaveAttribute("aria-pressed", "true");
    expect(await bars.count()).toBe(weekBins);

    // BOTH charts share the bin set — the Admin money chart has the same number of bars.
    const moneyBars = page
      .getByTestId("sales-money-bars")
      .locator('[data-testid^="sales-money-bars-bar-"]');
    expect(await moneyBars.count()).toBe(weekBins);

    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// Cross-filter semantics — the donut and pie render, a slice filters every OTHER panel, and each
// chart's OWN dimension stays unfiltered by its own selection.
// ---------------------------------------------------------------------------------------------
test.describe("status donut + category pie cross-filter", () => {
  test("both charts render with slices", async ({ browser }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, SALES);

    await expect(page.getByTestId("sales-status-donut")).toBeVisible();
    await expect(page.getByTestId("sales-category-pie")).toBeVisible();
    expect(
      await page
        .getByTestId("sales-status-donut")
        .locator('[data-testid^="sales-status-donut-slice-"]')
        .count(),
    ).toBeGreaterThan(1);
    expect(
      await page
        .getByTestId("sales-category-pie")
        .locator('[data-testid^="sales-category-pie-slice-"]')
        .count(),
    ).toBeGreaterThan(1);

    await context.close();
  });

  test("selecting a status slice filters the other panels but NOT the donut's own dimension", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, SALES);

    const donut = page.getByTestId("sales-status-donut");
    const slicesBefore = await donut.locator('[data-testid^="sales-status-donut-slice-"]').count();

    await page.getByTestId("sales-status-donut-legend-checked").click();
    await expect(page).toHaveURL(/status=checked/);

    // Other panels ARE filtered: the DO count drops to just that status.
    await expect(page.getByTestId("kpi-do-count")).toContainText(
      String(FIXTURE.checkedStatusCount),
    );
    // A dismissible chip shows what is narrowing the view.
    await expect(page.getByTestId("chip-status")).toBeVisible();

    // The donut itself is NOT filtered by its own selection — every status is still clickable.
    expect(await donut.locator('[data-testid^="sales-status-donut-slice-"]').count()).toBe(
      slicesBefore,
    );
    await expect(page.getByTestId("sales-status-donut-legend-approved")).toBeVisible();

    // Clicking a different slice switches the selection rather than being unreachable.
    await page.getByTestId("sales-status-donut-legend-approved").click();
    await expect(page).toHaveURL(/status=approved/);

    // Clearing the chip removes the filter entirely.
    await page.getByTestId("chip-status-clear").click();
    await expect(page).not.toHaveURL(/status=/);
    await expect(page.getByTestId("kpi-do-count")).toContainText(String(FIXTURE.doCount));

    await context.close();
  });

  test("selecting a category slice filters the other panels but NOT the pie's own dimension", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, SALES);

    const pie = page.getByTestId("sales-category-pie");
    const slicesBefore = await pie.locator('[data-testid^="sales-category-pie-slice-"]').count();
    const linesBefore = await page.getByTestId("kpi-line-count").innerText();

    await page.getByTestId("sales-category-pie-legend-R").click();
    await expect(page).toHaveURL(/cat=R/);

    await expect(page.getByTestId("chip-cat")).toBeVisible();
    expect(await page.getByTestId("kpi-line-count").innerText()).not.toBe(linesBefore);

    // The pie keeps every category visible so another one can still be chosen.
    expect(await pie.locator('[data-testid^="sales-category-pie-slice-"]').count()).toBe(
      slicesBefore,
    );
    await expect(page.getByTestId("sales-category-pie-legend-F")).toBeVisible();

    await context.close();
  });

  // DEFECT GATE (23-09-26): the live pie showed "หมวด W" — a raw ItemGRP code with no Thai label —
  // because the label map was hardcoded in the app. Labels now come from dbo.tbl_ItemGroup.
  test("the category legend shows the ERP's own Thai labels, and still filters by CODE", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, SALES);

    const pie = page.getByTestId("sales-category-pie");

    // F and R both exist in the fixture's tbl_ItemGroup, so both must read as the ERP's label.
    await expect(pie.getByTestId("sales-category-pie-legend-F")).toContainText("สินค้าสำเร็จรูป");
    await expect(pie.getByTestId("sales-category-pie-legend-R")).toContainText("วัตถุดิบหลัก");

    // No legend entry anywhere may be the raw-code fallback for a code the ERP CAN label.
    await expect(pie).not.toContainText("หมวด F");
    await expect(pie).not.toContainText("หมวด R");

    // The filter identity is still the CODE, never the Thai label.
    await expect(pie.getByTestId("sales-category-pie-legend-R")).toHaveAttribute(
      "href",
      /[?&]cat=R(&|$)/,
    );
    await pie.getByTestId("sales-category-pie-legend-R").click();
    await expect(page).toHaveURL(/cat=R/);
    await expect(page).not.toHaveURL(/%E0%B8%A7%E0%B8%B1%E0%B8%95/); // วัต… never in the URL
    await expect(page.getByTestId("chip-cat")).toContainText("วัตถุดิบหลัก");

    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// AC11 — breakdown row → DO list → DO lines.
// ---------------------------------------------------------------------------------------------
test.describe("AC11 — drilldown navigation", () => {
  test("customer breakdown → DO list → DO line items", async ({ browser }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, SALES);

    await expect(page.getByTestId("sales-customer-breakdown")).toBeVisible();
    await page
      .getByTestId("sales-customer-breakdown")
      .locator('[data-testid^="sales-customer-breakdown-row-"] a')
      .first()
      .click();

    await expect(page).toHaveURL(/customer=CUS-/);
    await expect(page.getByTestId("do-list-table")).toBeVisible();
    await expect(page.getByTestId("chip-customer")).toBeVisible();

    await page.locator('[data-testid^="do-link-DO-"]').first().click();
    await expect(page).toHaveURL(/doNo=DO-/);
    await expect(page.getByTestId("do-lines-table")).toBeVisible();
    await expect(page.getByTestId("do-lines-table")).toContainText("ใบส่งสินค้า");

    // The breadcrumb walks back up the same chain.
    await page.getByTestId("sales-breadcrumb-documents").click();
    await expect(page.getByTestId("do-list-table")).toBeVisible();

    await context.close();
  });

  test("product breakdown drills into the DO list filtered by that product", async ({ browser }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, SALES);

    await page
      .getByTestId("sales-product-breakdown")
      .locator('[data-testid^="sales-product-breakdown-row-"] a')
      .first()
      .click();

    await expect(page).toHaveURL(/product=/);
    await expect(page.getByTestId("do-list-table")).toBeVisible();
    await expect(page.getByTestId("chip-product")).toBeVisible();

    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// AC12 — sorting and paging the DO list must not lose the active filters.
// ---------------------------------------------------------------------------------------------
test.describe("AC12 — sort + paginate preserve filters", () => {
  test("paging keeps the date range, and sorting keeps both range and status filter", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await page.goto(`${SALES}&view=documents`);
    await expect(page.getByTestId("do-list-table")).toBeVisible();

    // 14 DOs at a page size of 10 → two pages.
    await expect(page.getByTestId("data-table-page-label")).toContainText("หน้า 1 จาก 2");
    // The shared data table renders the desktop table AND the mobile card list in the same
    // markup (one is CSS-hidden per breakpoint), so DO links must be scoped to one of them or
    // every row is counted twice.
    const desktopDoLinks = page.locator(
      '[data-testid="dashboard-data-table"] table [data-testid^="do-link-DO-"]',
    );
    const firstPageDo = await desktopDoLinks.first().innerText();

    await page.getByTestId("data-table-next").click();
    await expect(page).toHaveURL(/from=2026-08-01/);
    await expect(page).toHaveURL(/to=2026-09-30/);
    await expect(page.getByTestId("data-table-page-label")).toContainText("หน้า 2 จาก 2");
    const secondPageDo = await desktopDoLinks.first().innerText();
    expect(secondPageDo).not.toBe(firstPageDo);

    // Sort by DO number with a status filter active — both must survive.
    await page.goto(`${SALES}&view=documents&status=checked`);
    await expect(page.getByTestId("do-list-table")).toBeVisible();
    await page.getByTestId("sort-doNo").click();

    await expect(page).toHaveURL(/status=checked/);
    await expect(page).toHaveURL(/from=2026-08-01/);
    await expect(page).toHaveURL(/sort=doNo/);
    await expect(page.getByTestId("chip-status")).toBeVisible();

    const sorted = await desktopDoLinks.allInnerTexts();
    expect(sorted).toEqual([...sorted].sort());

    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// sales-breakdown-pagination (23-09-26) — the two summary breakdown tables must PAGE, not render
// every row. They shipped hand-rolled and unbounded: on the live ERP that was 135 products and a
// ~9,000px page. The local fixture deliberately seeds 14 distinct products so this is a real
// assertion rather than a vacuous one (10 products would fit on one page and prove nothing).
// ---------------------------------------------------------------------------------------------
test.describe("breakdown tables paginate at 10 rows and keep the filters", () => {
  /** Rows of one breakdown table, scoped to the DESKTOP table so the mobile cards are not counted. */
  function breakdownRows(page: Page, testId: string) {
    return page.locator(`[data-testid="${testId}"] table [data-testid^="${testId}-row-"]`);
  }

  test("the product breakdown shows at most one page of rows, with a page footer", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, SALES);

    const productTable = page.getByTestId("sales-product-breakdown");
    await expect(productTable).toBeVisible();

    // The defect this guards: every row rendered, no footer at all.
    expect(await breakdownRows(page, "sales-product-breakdown").count()).toBe(FIXTURE.pageSize);
    expect(FIXTURE.productCount).toBeGreaterThan(FIXTURE.pageSize);
    await expect(productTable.getByTestId("data-table-page-label")).toContainText("หน้า 1 จาก 2");

    // The customer table has one page of its own and must show the same footer wording.
    const customerTable = page.getByTestId("sales-customer-breakdown");
    expect(await breakdownRows(page, "sales-customer-breakdown").count()).toBe(
      FIXTURE.customerCount,
    );
    await expect(customerTable.getByTestId("data-table-page-label")).toContainText("หน้า 1 จาก 1");

    await context.close();
  });

  test("paging the product breakdown keeps the active filters and leaves the other table alone", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    // The pinned date range plus a non-default period — both must survive the page turn. A status
    // filter is deliberately NOT used here: it narrows the product set to a single page, which
    // would leave no "ถัดไป" link to click and make the assertion vacuous.
    await openAs(page, `${SALES}&period=week`);

    const productTable = page.getByTestId("sales-product-breakdown");
    const firstPage = await breakdownRows(page, "sales-product-breakdown").allInnerTexts();

    await productTable.getByTestId("data-table-next").click();
    await expect(productTable.getByTestId("data-table-page-label")).toContainText("หน้า 2 จาก");

    // Every filter preserved, and only the product table's own page key was written.
    await expect(page).toHaveURL(/from=2026-08-01/);
    await expect(page).toHaveURL(/to=2026-09-30/);
    await expect(page).toHaveURL(/period=week/);
    await expect(page).toHaveURL(/productPage=2/);
    await expect(page).not.toHaveURL(/customerPage=/);
    // The date filter is still the one in force, i.e. paging rewrote nothing but its own page key.
    await expect(page.getByTestId("sales-from")).toHaveValue("2026-08-01");
    await expect(page.getByTestId("sales-to")).toHaveValue("2026-09-30");

    // Genuinely different rows, and still bounded by the page size.
    const secondPage = await breakdownRows(page, "sales-product-breakdown").allInnerTexts();
    expect(secondPage.length).toBeGreaterThan(0);
    expect(secondPage.length).toBeLessThanOrEqual(FIXTURE.pageSize);
    expect(secondPage[0]).not.toBe(firstPage[0]);

    // The customer table did not move.
    await expect(
      page.getByTestId("sales-customer-breakdown").getByTestId("data-table-page-label"),
    ).toContainText("หน้า 1 จาก 1");

    // Drilling down from page 2 still filters by the clicked product and clears the page keys.
    await breakdownRows(page, "sales-product-breakdown").first().locator("a").first().click();
    await expect(page).toHaveURL(/product=/);
    await expect(page).not.toHaveURL(/productPage=/);
    await expect(page.getByTestId("do-list-table")).toBeVisible();

    await context.close();
  });

  test("the page is not an unbounded single-page dump — the summary view stays a sane height", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAs(page, SALES);

    // With 14 products the old unbounded markup added rows without limit; paginated, the whole
    // summary view stays within a few screens.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(height).toBeLessThan(4000);

    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// AC13 — mobile card view at phone width (in-file viewport override; no playwright.config.ts edit).
// ---------------------------------------------------------------------------------------------
test.describe("AC13 — mobile card view", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the DO list renders as cards, not a table, at 390x844", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/admin.json",
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto(`${SALES}&view=documents`);

    await expect(page.getByTestId("dashboard-data-cards")).toBeVisible();
    // A card shows the title column's VALUE (the DO number) and the remaining columns as
    // label/value pairs — the title column's own label is not repeated.
    await expect(page.getByTestId("dashboard-data-cards")).toContainText("DO-2569-");
    await expect(page.getByTestId("dashboard-data-cards")).toContainText("ลูกค้า");
    await expect(page.getByTestId("dashboard-data-cards")).toContainText("สถานะการส่งมอบ");

    // The desktop table is present in the DOM but hidden below `md` by the shared component.
    await expect(page.locator('[data-testid="dashboard-data-table"] table')).toBeHidden();

    // KPI tiles still render at phone width.
    await expect(page.getByTestId("sales-kpis")).toBeVisible();

    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// ERP-unreachable resilience (erp-dashboards Phase 2, EVL fix cycle 1 — 22-09-26).
//
// Phase 1's `getCached()` re-throws when a live ERP read fails and nothing has ever been cached
// (cold process, or an outage that starts before the first successful read). That throw used to
// escape the page and render Next's generic 500 — a broken-looking screen with no Thai explanation.
//
// These two gates are deliberately DB-INDEPENDENT: the first holds in every environment, and the
// second self-skips when the ERP connection IS healthy (there is then nothing to degrade from).
// Together they prove the fix without needing the fixture to be up.
// ---------------------------------------------------------------------------------------------
test.describe("ERP-unreachable resilience", () => {
  async function erpHealthy(page: Page): Promise<boolean> {
    const res = await page.request.get("/api/health/erp");
    if (!res.ok()) return false;
    return ((await res.json()) as { ok?: boolean }).ok === true;
  }

  test("the page always renders a dashboard root — never Next's generic error page", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();

    const response = await page.goto(SALES);
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId("sales-dashboard")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "ยอดขาย" })).toBeVisible();
    // Next's built-in error screens — neither may ever be what a user sees here.
    await expect(page.locator("body")).not.toContainText("A server error occurred");
    await expect(page.locator("body")).not.toContainText("This page couldn't load");

    await context.close();
  });

  test("with the ERP unreachable it shows the Thai unavailable notice and no figures", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();

    test.skip(await erpHealthy(page), "ERP connection is healthy — nothing to degrade from.");

    await page.goto(SALES);
    const notice = page.getByTestId("sales-erp-unavailable");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("ไม่สามารถเชื่อมต่อระบบ ERP ได้ในขณะนี้");
    // The filter bar must survive, so a retry after the ERP recovers keeps the user's date range.
    await expect(page.getByTestId("sales-from")).toHaveValue("2026-08-01");
    await expect(page.getByTestId("sales-period-month")).toHaveAttribute("aria-pressed", "true");
    // No figures at all means no money markup either — for any role.
    await expect(page.getByTestId("kpi-do-count")).toHaveCount(0);
    await expect(page.getByTestId("kpi-money")).toHaveCount(0);
    await expect(page.getByTestId("kpi-money-amount")).toHaveCount(0);

    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// REGRESSION GATE — bar GEOMETRY, not just bar COUNT.
//
// The charts once shipped visibly broken: every bar collapsed to a 2px stub at the baseline
// because a percentage height resolved against an auto-height parent. Counting bars passed the
// whole time. These assertions measure the rendered marks, so a flat chart fails CI.
// ---------------------------------------------------------------------------------------------
test.describe("period charts — bars have real, proportional height", () => {
  // A range whose first two months are empty, so a zero bin and a tall bin coexist.
  const ZERO_BIN_RANGE = "/dashboards/sales?from=2026-06-01&to=2026-09-30";
  const PLOT_HEIGHT = 168;

  async function marks(page: Page, testId: string) {
    const nodes = page.getByTestId(testId).locator(`[data-testid^="${testId}-mark-"]`);
    const n = await nodes.count();
    const out: { value: number; height: number }[] = [];
    for (let i = 0; i < n; i += 1) {
      const node = nodes.nth(i);
      const box = await node.boundingBox();
      out.push({ value: Number(await node.getAttribute("data-value")), height: box?.height ?? 0 });
    }
    return out;
  }

  test("the tallest bar fills most of the plot and a zero bin is a flat baseline stub", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, ZERO_BIN_RANGE);

    for (const testId of ["sales-count-bars", "sales-money-bars"]) {
      const bars = await marks(page, testId);
      expect(bars.length, `${testId} rendered no bars`).toBeGreaterThan(1);

      const nonZero = bars.filter((b) => b.value > 0);
      const zero = bars.filter((b) => b.value === 0);
      expect(nonZero.length, `${testId} has no non-zero bin in this range`).toBeGreaterThan(0);
      expect(zero.length, `${testId} has no zero bin in this range`).toBeGreaterThan(0);

      const tallest = Math.max(...nonZero.map((b) => b.height));
      // A substantial fraction of the plot — the bug rendered 2px here.
      expect(tallest, `${testId} tallest bar is only ${tallest}px`).toBeGreaterThan(
        PLOT_HEIGHT * 0.5,
      );
      expect(tallest, `${testId} tallest bar overflows the plot`).toBeLessThanOrEqual(PLOT_HEIGHT);

      // Every zero bin stays a flat stub, and is far shorter than the tallest bar.
      for (const b of zero) {
        expect(b.height).toBeLessThanOrEqual(4);
        expect(tallest - b.height).toBeGreaterThan(PLOT_HEIGHT * 0.4);
      }
    }

    await context.close();
  });

  test("bar heights track their values proportionally", async ({ browser }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, ZERO_BIN_RANGE);

    // The money series has two different non-zero months, so ratio is observable.
    const bars = (await marks(page, "sales-money-bars")).filter((b) => b.value > 0);
    expect(bars.length).toBeGreaterThanOrEqual(2);

    const peak = bars.reduce((a, b) => (b.value > a.value ? b : a));
    for (const b of bars) {
      const expected = (b.value / peak.value) * peak.height;
      expect(
        Math.abs(b.height - expected),
        `bar for ${b.value} is ${b.height}px, expected ~${Math.round(expected)}px`,
      ).toBeLessThanOrEqual(3);
    }

    await context.close();
  });

  test("no horizontal overflow at 1440 / 820 / 390", async ({ browser }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();

    for (const width of [1440, 820, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await openAs(page, ZERO_BIN_RANGE);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `page scrolls horizontally at ${width}px`).toBeLessThanOrEqual(1);

      // Bars still have height at every breakpoint.
      const bars = await marks(page, "sales-count-bars");
      expect(Math.max(...bars.map((b) => b.height))).toBeGreaterThan(PLOT_HEIGHT * 0.5);
    }

    await context.close();
  });
});
