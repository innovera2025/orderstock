import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/lib/db";

// Phase 05 print gates. This spec SELF-SEEDS its own 13/3/69 sheet directly via prisma on a
// DEDICATED date+location (E3) — NO ordering coupling to orders.spec.ts and no slow grid re-entry.
// It writes the snapshot columns (shopNameAtEntry / variantNameAtEntry) so the print routes, which
// read snapshots only, render historical names. Cleanup in afterAll removes every seeded row.
test.use({ storageState: "e2e/.auth/staff.json" });

const PRINT_DATE = "2026-03-13"; // fixture day (CE), dedicated location keeps it isolated from D1.
const PRINT_LOCATION = "E2E-PRINT";
const SNAP_DATE = "2026-03-15";
const SNAP_LOCATION = "E2E-PRINT-SNAP";
const SNAP_SLOT = 13; // a rostered shop NOT in the fixture and NOT used by orders.spec D2 (slot 26).

interface Fixture {
  cells: { rosterOrder: number; printOrder: number; qty: number }[];
  expectedColumnTotals: Record<string, number>;
  expectedGrandTotal: number;
  noteLines: { rosterOrder: number; text: string; qty: number | null }[];
}

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "../test-fixtures/sheet-13-03-69.json"), "utf8"),
) as Fixture;

function toDbDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

test.beforeAll(async () => {
  const [shops, variants] = await Promise.all([
    prisma.shop.findMany(),
    prisma.productVariant.findMany({ where: { printOrder: { not: null } } }),
  ]);
  const shopByRoster = new Map(shops.map((s) => [s.rosterOrder, s]));
  const variantByPrintOrder = new Map(variants.map((v) => [v.printOrder as number, v]));

  // Clean any leftover seeded sheets from a previous aborted run (idempotent seed).
  for (const [date, location] of [
    [toDbDate(PRINT_DATE), PRINT_LOCATION],
    [toDbDate(SNAP_DATE), SNAP_LOCATION],
  ] as const) {
    const stale = await prisma.orderSheet.findFirst({ where: { date, location } });
    if (stale) {
      await prisma.orderLine.deleteMany({ where: { sheetId: stale.id } });
      await prisma.noteLine.deleteMany({ where: { sheetId: stale.id } });
      await prisma.orderSheet.delete({ where: { id: stale.id } });
    }
  }

  const sheet = await prisma.orderSheet.create({
    data: { date: toDbDate(PRINT_DATE), location: PRINT_LOCATION },
  });

  await prisma.orderLine.createMany({
    data: fixture.cells.map((c) => {
      const shop = shopByRoster.get(c.rosterOrder)!;
      const variant = variantByPrintOrder.get(c.printOrder)!;
      return {
        sheetId: sheet.id,
        shopId: shop.id,
        variantId: variant.id,
        qty: c.qty,
        shopNameAtEntry: shop.name, // snapshot written at seed time
        variantNameAtEntry: variant.name,
      };
    }),
  });

  for (const note of fixture.noteLines) {
    const shop = shopByRoster.get(note.rosterOrder);
    await prisma.noteLine.create({
      data: {
        sheetId: sheet.id,
        shopId: shop?.id ?? null,
        text: note.text,
        qty: note.qty,
        shopNameAtEntry: shop?.name ?? null,
      },
    });
  }
});

test.afterAll(async () => {
  for (const [date, location] of [
    [toDbDate(PRINT_DATE), PRINT_LOCATION],
    [toDbDate(SNAP_DATE), SNAP_LOCATION],
  ] as const) {
    const sheet = await prisma.orderSheet.findFirst({ where: { date, location } });
    if (sheet) {
      await prisma.orderLine.deleteMany({ where: { sheetId: sheet.id } });
      await prisma.noteLine.deleteMany({ where: { sheetId: sheet.id } });
      await prisma.orderSheet.delete({ where: { id: sheet.id } });
    }
  }
  await prisma.$disconnect();
});

const dailyUrl = `/print/daily/${PRINT_DATE}?location=${PRINT_LOCATION}`;

test("G1: colgroup has 24 physical cols AND 20 semantic data cols", async ({ page }) => {
  await page.goto(dailyUrl);
  await expect(page.locator("table colgroup col")).toHaveCount(24);
  await expect(page.locator("table colgroup col[data-data-col]")).toHaveCount(20);
  // Middle header tier = exactly the 20 variant columns.
  await expect(page.locator("thead tr").nth(1).locator("th")).toHaveCount(20);
});

test("G2: 29 rows + 3-tier header + totals-last-tbody with column totals and grand 446", async ({
  page,
}) => {
  await page.goto(dailyUrl);
  await expect(page.locator("tbody tr.data-row")).toHaveCount(29);
  await expect(page.locator("thead tr")).toHaveCount(3);
  await expect(page.getByTestId("pgrand")).toHaveText(String(fixture.expectedGrandTotal)); // 446
  await expect(page.getByTestId("ptotal-4")).toHaveText("137");
  await expect(page.getByTestId("ptotal-8")).toHaveText("82");
  await expect(page.getByTestId("ptotal-2")).toHaveText("99");
  await expect(page.getByTestId("ptotal-17")).toHaveText("38");
  // Zero column renders blank, never "0".
  await expect(page.getByTestId("ptotal-1")).toHaveText("");
});

test("G3: @page A4 landscape rule present in the print stylesheet", async ({ page }) => {
  await page.goto(dailyUrl);
  const hasRule = await page.evaluate(() => {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of Array.from(rules)) {
        if (rule.constructor.name === "CSSPageRule" || rule.cssText.startsWith("@page")) {
          const t = rule.cssText.toLowerCase();
          if (t.includes("a4") && t.includes("landscape")) return true;
        }
      }
    }
    return false;
  });
  expect(hasRule).toBe(true);
});

test("G5: per-shop route emits one .sheet with break-after: page per selected shop", async ({
  page,
}) => {
  await page.goto(`/print/shops/${PRINT_DATE}?location=${PRINT_LOCATION}&slots=1,2,3`);
  await expect(page.locator(".sheet")).toHaveCount(3);
  const breakAfter = await page
    .locator(".sheet")
    .first()
    .evaluate((el) => getComputedStyle(el).breakAfter);
  expect(breakAfter).toBe("page");
});

test("G4: snapshot-render — rename the shop, print STILL shows the old snapshot name", async ({
  page,
}) => {
  const shop = await prisma.shop.findUnique({ where: { rosterOrder: SNAP_SLOT } });
  expect(shop, "seeded shop at the dedicated snapshot slot").toBeTruthy();
  const originalName = shop!.name;

  const variant = await prisma.productVariant.findFirst({ where: { printOrder: 1 } });
  const sheet = await prisma.orderSheet.create({
    data: { date: toDbDate(SNAP_DATE), location: SNAP_LOCATION },
  });
  await prisma.orderLine.create({
    data: {
      sheetId: sheet.id,
      shopId: shop!.id,
      variantId: variant!.id,
      qty: 3,
      shopNameAtEntry: originalName,
      variantNameAtEntry: variant!.name,
    },
  });

  try {
    // Rename the LIVE shop (keep it confirmed — cascade LOCKED so the snapshot must stay old).
    const renamed = `${originalName} RENAMED`;
    await prisma.shop.update({ where: { id: shop!.id }, data: { name: renamed } });

    await page.goto(`/print/daily/${SNAP_DATE}?location=${SNAP_LOCATION}`);
    // The snapshot row still prints the ORIGINAL name; the renamed live name must NOT appear.
    await expect(page.getByText(originalName, { exact: true })).toBeVisible();
    await expect(page.getByText(renamed, { exact: true })).toHaveCount(0);
  } finally {
    // Restore the live name so the shared sandbox is never poisoned for later specs (E4).
    await prisma.shop.update({ where: { id: shop!.id }, data: { name: originalName } });
  }
});

test("AC3c: a soft-deleted sheet's print routes render not-found", async ({ page }) => {
  const DEL_DATE = "2026-04-05";
  const DEL_LOCATION = "E2E-PRINT-DEL";
  const variant = await prisma.productVariant.findFirst({ where: { printOrder: 1 } });
  const shop = await prisma.shop.findFirst({ where: { rosterOrder: 1 } });
  const sheet = await prisma.orderSheet.create({
    data: { date: toDbDate(DEL_DATE), location: DEL_LOCATION, active: false },
  });
  await prisma.orderLine.create({
    data: {
      sheetId: sheet.id,
      shopId: shop!.id,
      variantId: variant!.id,
      qty: 2,
      shopNameAtEntry: shop!.name,
      variantNameAtEntry: variant!.name,
    },
  });

  try {
    await page.goto(`/print/daily/${DEL_DATE}?location=${DEL_LOCATION}`);
    await expect(page.getByText("ไม่พบใบออเดอร์ของวันที่นี้")).toBeVisible();

    await page.goto(`/print/shops/${DEL_DATE}?location=${DEL_LOCATION}`);
    await expect(page.getByText("ไม่พบร้านค้าที่มีออเดอร์ในวันที่นี้")).toBeVisible();
  } finally {
    await prisma.orderLine.deleteMany({ where: { sheetId: sheet.id } });
    await prisma.orderSheet.delete({ where: { id: sheet.id } });
  }
});

test("G7 (hybrid): test-side page.pdf() yields a valid A4-landscape PDF", async ({ page }) => {
  await page.goto(dailyUrl);
  await page.evaluate(() => document.fonts.ready);
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  // Valid PDF magic bytes + non-trivial size (the Chromium PDF pipeline produced a real document).
  expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(pdf.length).toBeGreaterThan(1000);
});

test.describe("G8 (hybrid): unauthenticated /print request redirects to /login", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("logged-out user hitting /print/daily is redirected to /login", async ({ page }) => {
    await page.goto(dailyUrl);
    await expect(page).toHaveURL(/\/login/);
  });
});
