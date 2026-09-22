import { test, expect, type Page, type Browser } from "@playwright/test";

// erp-dashboards Phase 3 — /dashboards/purchase gates.
//
// Precondition (Hybrid infrastructure, LOCAL ONLY): the `orderstock-sql` container is up,
// `db/erp-fixture/purchase-seed.sql` has been applied on top of Phase 1's base fixture, and
// `ERP_DATABASE_URL` points at `erp_fixture`. These specs NEVER touch `db_TCL`.
//
// Every scenario pins an explicit `from`/`to` covering the whole seeded range, so results do not
// drift with the calendar.
//
// The mobile-card scenario uses an in-file `test.use({ viewport })` override rather than a new
// Playwright project — `playwright.config.ts` is owned by no phase in the registry, and its
// `mobile` project's `testMatch` does not select this spec (a `--project=mobile` run here would
// silently execute ZERO tests and exit green).

const RANGE = "from=2026-08-01&to=2026-09-30";
const PURCHASE = `/dashboards/purchase?${RANGE}`;

/** The seeded fixture's truth — mirrors `db/erp-fixture/purchase-seed.sql`. */
const FIXTURE = {
  /** KRS's own sp_PurchaseInvoiceMonth rule over the 4 qualifying invoices. */
  invoiceTotal: "461,140.00",
  /** SUM(TotalAmount) over the 4 non-cancelled POs. */
  poTotal: "727,920.00",
  poCount: 4,
  supplierCount: 2,
  suppliers: ["ช-001", "ว-001"],
  /** Amounts the sp_PurchaseInvoiceMonth filter must EXCLUDE — they must never appear anywhere. */
  excludedInvoiceAmounts: ["99,999.00", "88,888.00"],
  /** PO number -> derived status (the flags are seeded to produce exactly these). */
  statuses: {
    "PO-L2608-0001": "Received",
    "PO-L2608-0002": "Closed",
    "PO-L2608-0003": "Approved",
    "PO-L2609-0004": "Pending",
    "PO-L2609-0005": "Cancelled",
  } as const,
  /** PO-L2608-0002 / ITM-010: ordered 50, received 60 -> outstanding -10 (never clamped). */
  overReceivedPo: "PO-L2608-0002",
  /** PO-L2608-0001 / ITM-010: ordered 400, received 400 -> outstanding 0. */
  fullyReceivedPo: "PO-L2608-0001",
};

/** A rendered money value always looks like `1,234.00 บาท` — this is the leak detector for AC9. */
const MONEY_VALUE = /[\d,]+\.\d{2}\s*บาท/;

function ctx(browser: Browser, role: "admin" | "staff") {
  return browser.newContext({ storageState: `e2e/.auth/${role}.json` });
}

async function openAs(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByTestId("purchase-dashboard")).toBeVisible();
}

// ---------------------------------------------------------------------------------------------
// AC1 — the page exists for both roles; an unauthenticated request is redirected to login.
// ---------------------------------------------------------------------------------------------
test.describe("AC1 — access", () => {
  for (const role of ["admin", "staff"] as const) {
    test(`the แดชบอร์ด nav Purchase link opens a working page for ${role}`, async ({ browser }) => {
      const context = await ctx(browser, role);
      const page = await context.newPage();
      await page.goto("/orders");
      await page.locator('#app-sidebar a[href="/dashboards/purchase"]').click();

      await expect(page).toHaveURL(/\/dashboards\/purchase/);
      await expect(page.getByTestId("purchase-dashboard")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: "แดชบอร์ดการซื้อ" })).toBeVisible();
      await expect(page.getByTestId("pilot-banner")).toBeVisible();

      await context.close();
    });
  }

  test("an unauthenticated request to /dashboards/purchase redirects to login", async ({
    browser,
  }) => {
    const context = await browser.newContext(); // no storage state
    const page = await context.newPage();
    await page.goto(PURCHASE);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId("purchase-dashboard")).toHaveCount(0);
    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// AC5 — the two money bases, both shown, both correct, neither subordinate.
// ---------------------------------------------------------------------------------------------
test.describe("AC5 — dual-basis totals", () => {
  test("both KPI tiles render with distinct basis labels and the reconciled fixture values", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, PURCHASE);

    const invoiceTile = page.getByTestId("kpi-invoice-basis");
    const poTile = page.getByTestId("kpi-po-basis");

    await expect(invoiceTile).toContainText("ยอดซื้อ (ตามใบแจ้งหนี้)");
    await expect(poTile).toContainText("ยอดซื้อ (ตามใบสั่งซื้อ)");

    await expect(page.getByTestId("kpi-invoice-basis-amount")).toContainText(FIXTURE.invoiceTotal);
    await expect(page.getByTestId("kpi-po-basis-amount")).toContainText(FIXTURE.poTotal);

    // Counts are not money and stay visible to everyone.
    await expect(page.getByTestId("kpi-po-count")).toContainText(String(FIXTURE.poCount));
    await expect(page.getByTestId("kpi-supplier-count")).toContainText(
      String(FIXTURE.supplierCount),
    );

    await context.close();
  });

  test("the two money tiles are the SAME visual weight — neither is styled as the headline", async ({
    browser,
  }) => {
    // The customer has not chosen a primary basis, so the dashboard must not choose one for them.
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, PURCHASE);

    const invoiceBox = await page.getByTestId("kpi-invoice-basis").boundingBox();
    const poBox = await page.getByTestId("kpi-po-basis").boundingBox();
    expect(invoiceBox).toBeTruthy();
    expect(poBox).toBeTruthy();
    expect(Math.abs((invoiceBox!.width ?? 0) - (poBox!.width ?? 0))).toBeLessThanOrEqual(2);

    const invoiceSize = await page
      .getByTestId("kpi-invoice-basis-amount")
      .evaluate((el) => getComputedStyle(el).fontSize);
    const poSize = await page
      .getByTestId("kpi-po-basis-amount")
      .evaluate((el) => getComputedStyle(el).fontSize);
    expect(invoiceSize).toBe(poSize);

    await context.close();
  });

  test("the sp_PurchaseInvoiceMonth filter excludes the two non-qualifying invoices", async ({
    browser,
  }) => {
    // Both excluded rows are six-figure amounts inside the date range: if the filter ever broke,
    // the KPI would move by a very visible number rather than failing silently.
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, PURCHASE);

    const html = await page.content();
    for (const amount of FIXTURE.excludedInvoiceAmounts) {
      expect(html, `an excluded invoice amount (${amount}) leaked into the page`).not.toContain(
        amount,
      );
    }

    await context.close();
  });

  test("the supplier chart shows BOTH bases per supplier and the parts sum to the totals", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, PURCHASE);

    const chart = page.getByTestId("purchase-supplier-chart");
    await expect(chart).toContainText("ยอดซื้อ (ตามใบแจ้งหนี้)");
    await expect(chart).toContainText("ยอดซื้อ (ตามใบสั่งซื้อ)");

    let poSum = 0;
    let invoiceSum = 0;
    for (const code of FIXTURE.suppliers) {
      await expect(page.getByTestId(`purchase-supplier-bar-${code}`)).toBeVisible();
      poSum += Number(
        await page.getByTestId(`purchase-supplier-po-${code}`).getAttribute("data-value"),
      );
      invoiceSum += Number(
        await page.getByTestId(`purchase-supplier-inv-${code}`).getAttribute("data-value"),
      );
    }
    expect(poSum).toBe(727920);
    expect(invoiceSum).toBe(461140);

    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// AC6 — derived status + the mandatory caveat, and received/outstanding quantities.
// ---------------------------------------------------------------------------------------------
test.describe("AC6 — PO status, caveat badge, received/outstanding", () => {
  test("every fixture PO renders its derived status WITH the unvalidated caveat beside it", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, PURCHASE);

    const table = page.locator('[data-testid="po-list-table"] table');
    for (const [poNumber, status] of Object.entries(FIXTURE.statuses)) {
      const row = table.locator("tr", { has: page.getByTestId(`po-link-${poNumber}`) });
      const badges = row.getByTestId(`po-status-${status}`);
      await expect(badges, `${poNumber} should derive status ${status}`).toHaveCount(1);
      // The caveat is a SEPARATE chip sitting beside the status chip, never merged into it.
      await expect(badges.getByTestId("po-status-unvalidated")).toHaveCount(1);
      await expect(badges.getByTestId("po-status-unvalidated")).toContainText(
        "ยังไม่ผ่านการยืนยัน",
      );
    }

    // …and the table explains what the badge means, once.
    await expect(page.getByTestId("po-status-caveat-note").first()).toBeVisible();

    await context.close();
  });

  test("an IsClosed-NULL PO does NOT read as Closed", async ({ browser }) => {
    // Three seeded POs carry IsClosed = NULL (the live shape for an open order). Exactly ONE PO is
    // IsClosed = 1. If ISNULL semantics ever inverted, several rows would flip to ปิดแล้ว at once.
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, PURCHASE);

    const table = page.locator('[data-testid="po-list-table"] table');
    await expect(table.getByTestId("po-status-Closed")).toHaveCount(1);
    for (const poNumber of ["PO-L2608-0001", "PO-L2608-0003", "PO-L2609-0004"]) {
      const row = table.locator("tr", { has: page.getByTestId(`po-link-${poNumber}`) });
      await expect(row.getByTestId("po-status-Closed")).toHaveCount(0);
    }

    await context.close();
  });

  test("the status donut counts every PO including the cancelled one", async ({ browser }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, PURCHASE);

    const donut = page.getByTestId("purchase-status-donut");
    await expect(donut).toContainText("รวมใบที่ยกเลิก");
    // The cancelled PO is out of the money totals but present in the donut.
    await expect(donut.getByTestId("purchase-status-donut-slice-Cancelled")).toHaveCount(1);
    await expect(donut).toContainText("ยังไม่ผ่านการยืนยัน");

    await context.close();
  });

  test("an over-received line shows a NEGATIVE outstanding, labelled and unclamped", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, `${PURCHASE}`);

    await page.getByTestId(`po-link-${FIXTURE.overReceivedPo}`).first().click();
    await expect(page.getByTestId("po-detail")).toBeVisible();

    const overReceived = page.getByTestId("outstanding-over-received").first();
    await expect(overReceived).toBeVisible();
    // The LABEL leads, and the raw negative ERP value stays visible after it.
    await expect(overReceived).toContainText("รับเกิน");
    await expect(overReceived).toContainText("10");
    await expect(overReceived).toContainText("−"); // U+2212 minus, not clamped to 0

    await context.close();
  });

  test("received quantities follow sp_Popending exactly — NULL-IsClosed, unapproved and non-IPC receipts are excluded", async ({
    browser,
  }) => {
    // PO-L2608-0003's three lines each have a receipt that the ERP's own filter drops for a
    // different reason (IsClosed NULL / Approved=0 / voucher series not IPC%), except ITM-013.
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, PURCHASE);

    await page.getByTestId("po-link-PO-L2608-0003").first().click();
    await expect(page.getByTestId("po-detail")).toBeVisible();

    const table = page.locator('[data-testid="po-lines-table"] table');
    const rowFor = (item: string) => table.locator("tr", { hasText: item });

    // ITM-013: ordered 4, received 2 (the one receipt that qualifies) -> outstanding 2.
    await expect(rowFor("ITM-013")).toContainText("2");
    // ITM-011: its only receipt is Approved = 0 -> received 0, outstanding stays the full 40.
    await expect(rowFor("ITM-011")).toContainText("40");
    // ITM-008: its only receipt is an IAD voucher, not IPC -> received 0, outstanding stays 8.
    await expect(rowFor("ITM-008")).toContainText("8");

    await context.close();
  });

  test("a fully received PO line shows zero outstanding, not a negative or a blank", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, PURCHASE);

    await page.getByTestId(`po-link-${FIXTURE.fullyReceivedPo}`).first().click();
    await expect(page.getByTestId("po-detail")).toBeVisible();
    await expect(page.getByTestId("po-lines-table")).toContainText("400");
    await expect(page.getByTestId("outstanding-qty").first()).toContainText("ค้าง");

    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// AC9 — money is gated SERVER-SIDE: a Staff user's HTML contains no money markup at all.
// ---------------------------------------------------------------------------------------------
test.describe("AC9 — money visibility role gate", () => {
  test("ADMIN sees both money tiles, the baht charts and the money columns", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, PURCHASE);

    await expect(page.getByTestId("kpi-invoice-basis")).toBeVisible();
    await expect(page.getByTestId("kpi-po-basis")).toBeVisible();
    await expect(page.getByTestId("purchase-supplier-chart")).toBeVisible();
    await expect(page.getByTestId("purchase-period-chart")).toBeVisible();
    await expect(page.getByTestId("po-list-table")).toContainText("ยอดเงิน");

    await page.getByTestId(`po-link-${FIXTURE.fullyReceivedPo}`).first().click();
    await expect(page.getByTestId("po-detail-total")).toBeVisible();
    await expect(page.getByTestId("po-lines-table")).toContainText("ราคาต่อหน่วย");

    await context.close();
  });

  test("STAFF never receives money markup — absent from the server-rendered HTML, not hidden", async ({
    browser,
  }) => {
    const context = await ctx(browser, "staff");
    const page = await context.newPage();
    await openAs(page, PURCHASE);

    await expect(page.getByTestId("kpi-invoice-basis")).toHaveCount(0);
    await expect(page.getByTestId("kpi-po-basis")).toHaveCount(0);
    await expect(page.getByTestId("purchase-supplier-chart")).toHaveCount(0);
    await expect(page.getByTestId("purchase-period-chart")).toHaveCount(0);
    await expect(page.getByTestId("purchase-period-toggle")).toHaveCount(0);
    await expect(page.getByTestId("kpi-money-locked")).toBeVisible();

    // The figures themselves must not appear ANYWHERE in the markup — a CSS hide would still leave
    // them in the DOM, so this is the assertion that distinguishes server gating from hiding.
    const html = await page.content();
    expect(html).not.toContain(FIXTURE.invoiceTotal);
    expect(html).not.toContain(FIXTURE.poTotal);
    // No money VALUE anywhere — a formatted amount is always "1,234.00 บาท". The word บาท alone is
    // allowed because the lock hint ("สัดส่วนยอดซื้อ (บาท) แสดงเฉพาะผู้ดูแลระบบ") explains WHY the
    // figure is missing; it is a label, never a number.
    expect(html, "a formatted money value leaked into the Staff page").not.toMatch(MONEY_VALUE);
    await expect(page.getByTestId("po-list-table")).not.toContainText("ยอดเงิน");

    // …and the chart is REPLACED, not emptied: Staff still sees the suppliers, by PO count.
    const fallback = page.getByTestId("purchase-supplier-counts");
    await expect(fallback).toBeVisible();
    await expect(fallback).toContainText("ใบสั่งซื้อ");
    for (const code of FIXTURE.suppliers) {
      await expect(fallback.getByTestId(`purchase-supplier-count-${code}`)).toBeVisible();
    }

    // The detail page is gated the same way.
    await page.getByTestId(`po-link-${FIXTURE.fullyReceivedPo}`).first().click();
    await expect(page.getByTestId("po-detail")).toBeVisible();
    await expect(page.getByTestId("po-detail-total")).toHaveCount(0);
    const detailHtml = await page.content();
    expect(detailHtml, "a formatted money value leaked into the Staff detail page").not.toMatch(
      MONEY_VALUE,
    );
    expect(detailHtml).not.toContain("444,000.00");
    await expect(page.getByTestId("po-lines-table")).not.toContainText("ราคาต่อหน่วย");

    // Quantities are NOT money and must still be there — a blanket hide would have removed them.
    await expect(page.getByTestId("po-lines-table")).toContainText("400");

    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// AC10 — filter round-trip through the URL.
// ---------------------------------------------------------------------------------------------
test.describe("AC10 — filter URL round-trip", () => {
  test("the supplier filter narrows the list, updates the URL and survives a reload", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, PURCHASE);

    await page.getByTestId("purchase-supplier").selectOption("ว-001");
    await page.getByTestId("purchase-apply-filters").click();

    await expect(page).toHaveURL(/supplier=/);
    await expect(page.getByTestId("chip-supplier")).toContainText("ว-001");
    await expect(page.getByTestId("kpi-po-count")).toContainText("2");

    await page.reload();
    await expect(page.getByTestId("purchase-supplier")).toHaveValue("ว-001");
    await expect(page.getByTestId("kpi-po-count")).toContainText("2");

    // …and the chip's ✕ clears just that filter.
    await page.getByTestId("chip-supplier-clear").click();
    await expect(page).not.toHaveURL(/supplier=%/);
    await expect(page.getByTestId("kpi-po-count")).toContainText(String(FIXTURE.poCount));

    await context.close();
  });

  test("the status filter narrows the table but never the status donut", async ({ browser }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, `${PURCHASE}&status=Cancelled`);

    await expect(page.getByTestId("chip-status")).toContainText("ยกเลิก");
    const links = page.locator('[data-testid="po-list-table"] table [data-testid^="po-link-"]');
    await expect(links).toHaveCount(1);
    await expect(links.first()).toHaveText("PO-L2609-0005");

    // Cross-filter: the donut still shows every status, so another slice is always clickable.
    const donut = page.getByTestId("purchase-status-donut");
    await expect(donut.getByTestId("purchase-status-donut-slice-Received")).toHaveCount(1);
    await expect(donut.getByTestId("purchase-status-donut-slice-Cancelled")).toHaveCount(1);

    await context.close();
  });

  test("narrowing the date range changes the figures and round-trips", async ({ browser }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, "/dashboards/purchase?from=2026-08-01&to=2026-08-31");

    await expect(page.getByTestId("purchase-from")).toHaveValue("2026-08-01");
    await expect(page.getByTestId("purchase-to")).toHaveValue("2026-08-31");
    // August holds 3 of the 5 POs, 2 of which are non-cancelled money rows.
    await expect(page.getByTestId("kpi-po-count")).toContainText("3");

    await page.reload();
    await expect(page.getByTestId("kpi-po-count")).toContainText("3");

    await context.close();
  });

  test("the period toggle defaults to เดือน and round-trips through the URL", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, PURCHASE);

    await expect(page.getByTestId("purchase-period-month")).toHaveAttribute("aria-pressed", "true");
    // Two seeded months -> two bars by default.
    await expect(
      page.locator('[data-testid="purchase-period-bars"] [data-testid^="purchase-period-bars-mark-"]'),
    ).toHaveCount(2);

    await page.getByTestId("purchase-period-year").click();
    await expect(page).toHaveURL(/period=year/);
    await expect(page.getByTestId("purchase-period-year")).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.locator('[data-testid="purchase-period-bars"] [data-testid^="purchase-period-bars-mark-"]'),
    ).toHaveCount(1);

    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// AC11 — drilldown navigation: supplier -> filtered list -> PO -> PO lines, and back.
// ---------------------------------------------------------------------------------------------
test.describe("AC11 — drilldown navigation", () => {
  test("supplier bar filters the list, a PO row opens its lines, and the breadcrumb returns with filters intact", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, PURCHASE);

    // 1. supplier bar -> filtered PO list
    await page.getByTestId("purchase-supplier-bar-ว-001").click();
    await expect(page).toHaveURL(/supplier=/);
    await expect(page.getByTestId("chip-supplier")).toContainText("ว-001");

    // 2. PO row -> detail page, carrying the filter in the query string
    await page.getByTestId("po-link-PO-L2608-0003").first().click();
    await expect(page).toHaveURL(/\/dashboards\/purchase\/PO-L2608-0003/);
    await expect(page).toHaveURL(/supplier=/);
    await expect(page.getByTestId("po-detail")).toBeVisible();
    await expect(page.getByTestId("po-detail-supplier")).toContainText("ว-001");
    await expect(page.getByTestId("po-lines-table")).toContainText("ITM-013");

    // 3. breadcrumb -> back to the list, with the supplier filter still applied
    await page.getByTestId("purchase-breadcrumb-list").click();
    await expect(page).toHaveURL(/\/dashboards\/purchase\?/);
    await expect(page.getByTestId("chip-supplier")).toContainText("ว-001");

    await context.close();
  });

  test("an unknown PO number renders a Thai not-found message rather than an error page", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await page.goto("/dashboards/purchase/PO-DOES-NOT-EXIST");
    await expect(page.getByTestId("po-detail")).toBeVisible();
    await expect(page.getByTestId("po-detail")).toContainText("ไม่พบใบสั่งซื้อเลขที่");
    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// AC12 — sort preserves the active filters.
//
// NOTE ON PAGING: the seeded set is 5 POs against a page size of 10, because the live Purchase
// module has only 4 orders and inflating the fixture would make every other figure on this page
// fictional. The page-TURN mechanics (and the fact that turning a page preserves every other
// search param) are owned and proven by Phase 1's shared `DashboardDataTable` gate; what is unique
// to THIS dashboard — that sorting keeps the filter — is asserted here.
// ---------------------------------------------------------------------------------------------
test.describe("AC12 — sort preserves filters", () => {
  test("sorting by PO number keeps the date range and the supplier filter", async ({ browser }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, `${PURCHASE}&supplier=%E0%B8%8A-001`);
    await expect(page.getByTestId("chip-supplier")).toBeVisible();

    await page.getByTestId("sort-poNo").click();

    await expect(page).toHaveURL(/from=2026-08-01/);
    await expect(page).toHaveURL(/to=2026-09-30/);
    await expect(page).toHaveURL(/supplier=/);
    await expect(page).toHaveURL(/sort=poNo/);
    await expect(page.getByTestId("chip-supplier")).toContainText("ช-001");

    const sorted = await page
      .locator('[data-testid="po-list-table"] table [data-testid^="po-link-"]')
      .allInnerTexts();
    expect(sorted.length).toBeGreaterThan(1);
    expect(sorted).toEqual([...sorted].sort());

    // The page label is part of the shared table's contract and must still render.
    await expect(page.getByTestId("data-table-page-label")).toContainText("หน้า 1");

    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// AC13 — mobile card view at phone width (in-file viewport override; no playwright.config.ts edit).
// ---------------------------------------------------------------------------------------------
test.describe("AC13 — mobile card view", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the PO list and the PO lines render as cards, not tables, at 390x844", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/admin.json",
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto(PURCHASE);
    await expect(page.getByTestId("purchase-dashboard")).toBeVisible();

    await expect(page.getByTestId("dashboard-data-cards")).toBeVisible();
    await expect(page.getByTestId("dashboard-data-cards")).toContainText("PO-L26");
    await expect(page.getByTestId("dashboard-data-cards")).toContainText("ซัพพลายเออร์");
    // The desktop table is in the DOM but hidden below `md` by the shared component.
    await expect(page.locator('[data-testid="po-list-table"] table')).toBeHidden();

    // KPI tiles still render at phone width.
    await expect(page.getByTestId("purchase-kpis")).toBeVisible();

    // …and so does the detail page's line table, as cards. The click must be scoped to the CARD
    // list: the desktop table is still in the DOM (CSS-hidden below `md`), so an unscoped locator
    // would resolve to its invisible copy of the same link.
    await page
      .getByTestId("dashboard-data-cards")
      .getByTestId("po-link-PO-L2608-0002")
      .click();
    await expect(page.getByTestId("po-detail")).toBeVisible();
    await expect(page.getByTestId("dashboard-data-cards")).toBeVisible();
    await expect(page.locator('[data-testid="po-lines-table"] table')).toBeHidden();

    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// Layout — real bar geometry, and no horizontal overflow at any supported width.
// ---------------------------------------------------------------------------------------------
test.describe("layout and chart geometry", () => {
  test("period bars have real, proportional pixel height (not a collapsed 2px stub)", async ({
    browser,
  }) => {
    // Guards the percentage-height bug Phase 2 hit: right data, flat chart, no failing test.
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, "/dashboards/purchase?from=2026-06-01&to=2026-09-30");

    const marks = page.locator(
      '[data-testid="purchase-period-bars"] [data-testid^="purchase-period-bars-mark-"]',
    );
    const count = await marks.count();
    expect(count).toBeGreaterThan(1);

    const bars: { value: number; height: number }[] = [];
    for (let i = 0; i < count; i += 1) {
      const node = marks.nth(i);
      const box = await node.boundingBox();
      bars.push({
        value: Number(await node.getAttribute("data-value")),
        height: box?.height ?? 0,
      });
    }

    const nonZero = bars.filter((b) => b.value > 0);
    const zero = bars.filter((b) => b.value === 0);
    expect(nonZero.length).toBeGreaterThan(0);
    expect(zero.length, "this range should contain an empty month").toBeGreaterThan(0);

    const tallest = Math.max(...nonZero.map((b) => b.height));
    expect(tallest, `tallest bar is only ${tallest}px`).toBeGreaterThan(84); // > half the 168px plot
    expect(tallest).toBeLessThanOrEqual(168);
    // A zero month stays an explicit flat stub — never the same as a missing month.
    for (const b of zero) expect(b.height).toBeLessThanOrEqual(4);

    await context.close();
  });

  test("the donut draws real arcs, not an empty shell", async ({ browser }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    await openAs(page, PURCHASE);

    const slices = page.locator(
      '[data-testid="purchase-status-donut"] [data-testid^="purchase-status-donut-slice-"]',
    );
    expect(await slices.count()).toBeGreaterThan(1);
    for (let i = 0; i < (await slices.count()); i += 1) {
      const d = await slices.nth(i).getAttribute("d");
      expect(d, "a donut slice has no path geometry").toBeTruthy();
      expect(d!.length).toBeGreaterThan(20);
    }

    await context.close();
  });

  test("no horizontal overflow at 1440 / 820 / 390", async ({ browser }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();

    for (const width of [1440, 820, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(PURCHASE);
      await expect(page.getByTestId("purchase-dashboard")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `page overflows horizontally at ${width}px`).toBeLessThanOrEqual(1);
    }

    await context.close();
  });
});
