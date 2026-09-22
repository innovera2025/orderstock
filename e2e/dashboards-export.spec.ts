import { test, expect, type Browser, type Page } from "@playwright/test";

// erp-dashboards Phase 5 — AC14: CSV export across all three dashboards, both roles.
//
// Precondition (Hybrid infrastructure, LOCAL ONLY): the `orderstock-sql` container is up, all
// `db/erp-fixture/*.sql` seeds are applied, and `ERP_DATABASE_URL` points at `erp_fixture`. These
// specs NEVER touch `db_TCL`.
//
// WHAT THIS PROVES THAT THE UNIT AUDIT CANNOT: the button that Phase 5 wired into Phase 1's shared
// table really renders on every table, its href really carries the current filters, and the bytes
// that come back over real HTTP — through the real auth cookie, the real session, the real route —
// are BOM-prefixed, Thai-headed, BE-dated, and money-free for STAFF.
//
// Every scenario pins an explicit `from`/`to` covering the whole seeded range, so results never
// drift with the calendar. The file is picked up by the `chromium` project (no config change).

const RANGE = "from=2026-08-01&to=2026-09-30";

/** Money column headers that must never appear in a STAFF export. */
const MONEY_HEADERS = ["ยอดเงิน", "จำนวนเงิน", "ราคา/หน่วย", "ราคาต่อหน่วย"];

const BOM = "﻿";

function ctx(browser: Browser, role: "admin" | "staff") {
  return browser.newContext({ storageState: `e2e/.auth/${role}.json` });
}

/** The export link Phase 5 adds inside Phase 1's shared data table. */
function exportLink(page: Page) {
  return page.getByTestId("data-table-export-csv").first();
}

interface Csv {
  bytes: Buffer;
  text: string;
  headers: string[];
  lines: string[];
  status: number;
  contentType: string;
  disposition: string;
}

/**
 * Read the export the page is offering: take the href off the REAL button (so the wiring is under
 * test, not a URL this spec invented), then fetch it with the page's own cookies.
 */
async function downloadFrom(page: Page, url: string): Promise<Csv> {
  await page.goto(url);
  const link = exportLink(page);
  await expect(link, `an export button must render on ${url}`).toBeVisible();
  const href = await link.getAttribute("href");
  expect(href, "the export button must carry an href").toBeTruthy();

  const response = await page.request.get(href as string);
  const bytes = await response.body();
  // Decode WITHOUT stripping the BOM, so its presence is genuinely asserted below.
  const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
  const lines = text.replace(BOM, "").trimEnd().split("\r\n");
  return {
    bytes,
    text,
    lines,
    headers: (lines[0] ?? "").split(",").map((h) => h.replace(/^"|"$/g, "")),
    status: response.status(),
    contentType: response.headers()["content-type"] ?? "",
    disposition: response.headers()["content-disposition"] ?? "",
  };
}

/** Every export, whatever the dashboard or role, must satisfy this. */
function assertCommonCsvContract(csv: Csv, label: string) {
  expect(csv.status, `${label}: export must return 200`).toBe(200);
  // EF BB BF — the literal bytes Excel looks for before decoding Thai as UTF-8.
  expect([csv.bytes[0], csv.bytes[1], csv.bytes[2]], `${label}: UTF-8 BOM`).toEqual([
    0xef, 0xbb, 0xbf,
  ]);
  expect(csv.contentType, `${label}: content type`).toContain("text/csv");
  expect(csv.contentType, `${label}: charset`).toContain("charset=utf-8");
  expect(csv.disposition, `${label}: attachment disposition`).toContain("attachment;");

  const filename = csv.disposition.match(/filename="([^"]+)"/)?.[1] ?? "";
  expect(filename, `${label}: filename present`).toMatch(/\.csv$/);
  // ASCII-only: some OS/browser combinations mangle a non-ASCII download filename.
  expect(/^[\x20-\x7e]+$/.test(filename), `${label}: filename "${filename}" must be ASCII`).toBe(
    true,
  );

  // Thai headers, and at least one data row from the fixture.
  expect(csv.headers.length, `${label}: header row`).toBeGreaterThan(1);
  expect(csv.headers.some((h) => /[฀-๿]/.test(h)), `${label}: Thai headers`).toBe(true);
  expect(csv.lines.length, `${label}: at least one data row`).toBeGreaterThan(1);
}

/** The six exportable tables, and how to reach each one. */
const LIST_VIEWS = [
  { name: "sales", url: `/dashboards/sales?view=documents&${RANGE}`, money: true },
  { name: "purchase", url: `/dashboards/purchase?${RANGE}`, money: true },
  { name: "production", url: `/dashboards/production?${RANGE}`, money: false },
] as const;

// ---------------------------------------------------------------------------------------------
// AC14 — the export button exists on every dashboard's main table and produces a valid CSV.
// ---------------------------------------------------------------------------------------------
test.describe("AC14 — CSV export, main tables", () => {
  for (const view of LIST_VIEWS) {
    test(`${view.name}: ADMIN export is a valid, BOM-prefixed Thai CSV`, async ({ browser }) => {
      const context = await ctx(browser, "admin");
      const page = await context.newPage();
      const csv = await downloadFrom(page, view.url);
      assertCommonCsvContract(csv, `${view.name} admin`);

      if (view.money) {
        expect(
          csv.headers.some((h) => MONEY_HEADERS.includes(h)),
          `${view.name}: the ADMIN export must contain a money column`,
        ).toBe(true);
      }
      await context.close();
    });

    test(`${view.name}: STAFF export contains no money column at all`, async ({ browser }) => {
      const adminCtx = await ctx(browser, "admin");
      const adminPage = await adminCtx.newPage();
      const admin = await downloadFrom(adminPage, view.url);
      await adminCtx.close();

      const staffCtx = await ctx(browser, "staff");
      const staffPage = await staffCtx.newPage();
      const staff = await downloadFrom(staffPage, view.url);
      assertCommonCsvContract(staff, `${view.name} staff`);

      for (const money of MONEY_HEADERS) {
        expect(staff.headers, `${view.name}: STAFF header row`).not.toContain(money);
        // Not merely blanked — the string must not occur anywhere in the file.
        expect(staff.text, `${view.name}: STAFF body`).not.toContain(money);
      }

      if (view.money) {
        // The column count must strictly DROP: a Staff CSV has fewer columns, never a blanked one.
        expect(staff.headers.length).toBeLessThan(admin.headers.length);
      } else {
        // Production carries no money at all, so both roles get byte-identical files.
        expect(staff.text).toBe(admin.text);
      }
      await staffCtx.close();
    });
  }
});

// ---------------------------------------------------------------------------------------------
// AC14 — the line/detail tables export too, including the two nested-route drilldowns.
// ---------------------------------------------------------------------------------------------
test.describe("AC14 — CSV export, line/detail tables", () => {
  test("sales DO lines: ADMIN has price+amount columns, STAFF has neither", async ({ browser }) => {
    const adminCtx = await ctx(browser, "admin");
    const adminPage = await adminCtx.newPage();

    // Reach the line view exactly the way a user does: click the first DO in the list.
    await adminPage.goto(`/dashboards/sales?view=documents&${RANGE}`);
    await adminPage.locator('[data-testid^="do-link-"]').first().click();
    await expect(adminPage.getByTestId("do-lines-table")).toBeVisible();
    const lineUrl = adminPage.url();

    const admin = await downloadFrom(adminPage, lineUrl);
    assertCommonCsvContract(admin, "sales lines admin");
    expect(admin.headers).toContain("ยอดเงิน");
    expect(admin.headers).toContain("ราคา/หน่วย");
    await adminCtx.close();

    const staffCtx = await ctx(browser, "staff");
    const staffPage = await staffCtx.newPage();
    const staff = await downloadFrom(staffPage, lineUrl);
    expect(staff.headers).not.toContain("ยอดเงิน");
    expect(staff.headers).not.toContain("ราคา/หน่วย");
    expect(staff.headers.length).toBe(admin.headers.length - 2);
    await staffCtx.close();
  });

  test("purchase PO lines (nested route): money columns vanish for STAFF", async ({ browser }) => {
    const adminCtx = await ctx(browser, "admin");
    const adminPage = await adminCtx.newPage();
    await adminPage.goto(`/dashboards/purchase?${RANGE}`);
    await adminPage.locator('[data-testid^="po-link-"]').first().click();
    await expect(adminPage.getByTestId("po-lines-table")).toBeVisible();
    const detailUrl = adminPage.url();

    const admin = await downloadFrom(adminPage, detailUrl);
    assertCommonCsvContract(admin, "purchase lines admin");
    expect(admin.headers).toContain("ราคาต่อหน่วย");
    expect(admin.headers).toContain("จำนวนเงิน");
    // Quantities always ship with their unit — never summed across units.
    expect(admin.headers).toContain("หน่วย");
    await adminCtx.close();

    const staffCtx = await ctx(browser, "staff");
    const staffPage = await staffCtx.newPage();
    const staff = await downloadFrom(staffPage, detailUrl);
    assertCommonCsvContract(staff, "purchase lines staff");
    for (const money of MONEY_HEADERS) {
      expect(staff.text).not.toContain(money);
    }
    expect(staff.headers.length).toBe(admin.headers.length - 2);
    await staffCtx.close();
  });

  test("production material issues (nested route) export for both roles", async ({ browser }) => {
    for (const role of ["admin", "staff"] as const) {
      const context = await ctx(browser, role);
      const page = await context.newPage();
      // MO-2609-0001 is the seeded MO that genuinely has linked material issues.
      const csv = await downloadFrom(page, `/dashboards/production/MO-2609-0001?${RANGE}`);
      assertCommonCsvContract(csv, `production lines ${role}`);
      expect(csv.headers).toEqual(["รหัสสินค้า", "ชื่อสินค้า", "จำนวน", "หน่วย", "วันที่เบิก"]);
      for (const money of MONEY_HEADERS) {
        expect(csv.text).not.toContain(money);
      }
      await context.close();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// AC14 — "the current filtered view": the file must follow the URL, not the whole table.
// ---------------------------------------------------------------------------------------------
test.describe("AC14 — the export honours the current filters and sort", () => {
  test("a narrower date range yields strictly fewer rows", async ({ browser }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();

    const wide = await downloadFrom(page, `/dashboards/sales?view=documents&${RANGE}`);
    const narrow = await downloadFrom(
      page,
      "/dashboards/sales?view=documents&from=2026-09-01&to=2026-09-30",
    );
    expect(narrow.lines.length).toBeLessThan(wide.lines.length);
    expect(narrow.lines.length).toBeGreaterThan(1);
    await context.close();
  });

  test("the export href carries the active sort, and the row order follows it", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();

    await page.goto(`/dashboards/sales?view=documents&${RANGE}`);
    await page.getByTestId("sort-doNo").click();
    // Wait for the NAVIGATION, not just for the table to be visible: the old page's table is
    // already visible, so asserting visibility alone can read the pre-click href.
    await page.waitForURL(/sort=doNo/);
    await expect(page.getByTestId("do-list-table")).toBeVisible();

    const href = await exportLink(page).getAttribute("href");
    expect(href).toContain("sort=doNo");

    const ascending = await downloadFrom(page, page.url());
    const descending = await downloadFrom(
      page,
      `/dashboards/sales?view=documents&sort=-doNo&${RANGE}`,
    );
    expect(ascending.lines[1]).not.toBe(descending.lines[1]);
    await context.close();
  });

  test("dates in the exported body are Buddhist Era, never raw CE", async ({ browser }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();
    const csv = await downloadFrom(page, `/dashboards/sales?view=documents&${RANGE}`);
    // CE 2026 -> BE 2569; the d/m/yy convention renders the year as `69`.
    expect(csv.text).toMatch(/\d{1,2}\/\d{1,2}\/69/);
    expect(csv.text).not.toMatch(/2026-0[89]-\d{2}/);
    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// AC14 — access control on the export endpoint itself.
// ---------------------------------------------------------------------------------------------
test.describe("AC14 — export endpoint access", () => {
  test("an unauthenticated request to the export route is refused", async ({ browser }) => {
    // A brand-new context: no storage state, so no session cookie.
    const context = await browser.newContext();
    const response = await context.request.get(
      `/api/dashboards/export?dashboard=sales&table=list&${RANGE}`,
      { maxRedirects: 0 },
    );
    expect(response.status(), "no session must not yield a 200 CSV").not.toBe(200);
    expect(response.headers()["content-type"] ?? "").not.toContain("text/csv");
    await context.close();
  });

  test("an unknown dashboard/table pair is rejected with 400 and no file", async ({ browser }) => {
    const context = await ctx(browser, "admin");
    const response = await context.request.get(
      "/api/dashboards/export?dashboard=payroll&table=list",
    );
    expect(response.status()).toBe(400);
    expect(response.headers()["content-type"] ?? "").not.toContain("text/csv");
    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// AC9 — the SERVER-RENDERED HTML half of the cross-dashboard money audit.
//
// The unit audit proves the export bytes and sweeps the source for a `canSeeMoney` gate; this
// proves the other surface — that what actually reaches a STAFF browser contains no money at all.
// Phase 2 and 3 each assert this for their own dashboard; this block asserts the SET, in one place,
// which is what "cross-dashboard" means and what no single-phase spec could do.
//
// The assertion is on `page.content()` — the raw server-rendered markup — so a value that were
// rendered and then hidden with CSS would still be caught.
// ---------------------------------------------------------------------------------------------
test.describe("AC9 — no money reaches a STAFF browser on any dashboard", () => {
  // THE LEAK DETECTOR is a money VALUE, not the word "ยอดเงิน".
  //
  // Asserting the label is absent would be wrong and would fail on correct behaviour: Sales
  // deliberately renders a LOCKED tile labelled "ยอดเงิน" whose body reads
  // "ยอดเงินแสดงเฉพาะผู้ดูแลระบบ", and the DO-lines card carries the same disclosure. Those are the
  // feature working — the label is present, the number is not. So the assertion matches how money
  // is actually RENDERED: `formatMoney()` always emits `1,234.00 บาท`.
  const MONEY_VALUE = /[\d,]+\.\d{2}\s*บาท/;

  const SCREENS = [
    { name: "sales summary", url: `/dashboards/sales?${RANGE}`, testId: "sales-dashboard" },
    {
      name: "sales documents",
      url: `/dashboards/sales?view=documents&${RANGE}`,
      testId: "sales-dashboard",
    },
    { name: "purchase", url: `/dashboards/purchase?${RANGE}`, testId: "purchase-dashboard" },
    { name: "production", url: `/dashboards/production?${RANGE}`, testId: "production-dashboard" },
  ] as const;

  test("STAFF markup carries no money VALUE on any dashboard", async ({ browser }) => {
    const context = await ctx(browser, "staff");
    const page = await context.newPage();

    for (const screen of SCREENS) {
      await page.goto(screen.url);
      await expect(page.getByTestId(screen.testId)).toBeVisible();
      // `page.content()` is the server-rendered markup: a value rendered and then hidden with CSS
      // would still be caught here.
      expect(
        await page.content(),
        `${screen.name}: STAFF markup must not contain a rendered money value`,
      ).not.toMatch(MONEY_VALUE);
    }
    await context.close();
  });

  test("ADMIN does see money values (so the STAFF assertion means something)", async ({
    browser,
  }) => {
    const context = await ctx(browser, "admin");
    const page = await context.newPage();

    for (const screen of SCREENS.filter((s) => s.name !== "production")) {
      await page.goto(screen.url);
      await expect(page.getByTestId(screen.testId)).toBeVisible();
      expect(
        await page.content(),
        `${screen.name}: the ADMIN markup must contain a money value`,
      ).toMatch(MONEY_VALUE);
    }
    await context.close();
  });

  test("Sales shows STAFF the locked money tile — label present, value absent", async ({
    browser,
  }) => {
    const context = await ctx(browser, "staff");
    const page = await context.newPage();
    await page.goto(`/dashboards/sales?${RANGE}`);
    await expect(page.getByTestId("sales-dashboard")).toBeVisible();

    // The disclosure is the correct behaviour: STAFF is TOLD the figure exists and is restricted.
    await expect(page.getByTestId("kpi-money-locked")).toBeVisible();
    await expect(page.getByTestId("kpi-money-locked")).toContainText("ยอดเงินแสดงเฉพาะผู้ดูแลระบบ");
    // ...and the unlocked tile that carries the actual number is simply not rendered.
    await expect(page.getByTestId("kpi-money")).toHaveCount(0);
    await context.close();
  });

  test("STAFF sees no money value on either drilldown route", async ({ browser }) => {
    const context = await ctx(browser, "staff");
    const page = await context.newPage();

    // Sales DO lines.
    await page.goto(`/dashboards/sales?view=documents&${RANGE}`);
    await page.locator('[data-testid^="do-link-"]').first().click();
    await expect(page.getByTestId("do-lines-table")).toBeVisible();
    expect(await page.content(), "sales DO lines").not.toMatch(MONEY_VALUE);

    // Purchase PO detail (nested route).
    await page.goto(`/dashboards/purchase?${RANGE}`);
    await page.locator('[data-testid^="po-link-"]').first().click();
    await expect(page.getByTestId("po-lines-table")).toBeVisible();
    expect(await page.content(), "purchase PO detail").not.toMatch(MONEY_VALUE);

    // Production MO detail — money-free for every role by design.
    await page.goto(`/dashboards/production/MO-2609-0001?${RANGE}`);
    await expect(page.getByTestId("production-mo-detail")).toBeVisible();
    expect(await page.content(), "production MO detail").not.toMatch(MONEY_VALUE);

    await context.close();
  });
});
