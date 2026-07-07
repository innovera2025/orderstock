import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/lib/db";

// Phase 02 hybrid gates — the 20-column MATRIX replaces the Order Pad. Cells are driven directly by
// their testid `cell-{rosterOrder}-{printOrder}` (the matrix maps rosterOrder→shopId, printOrder→
// variantId under the hood and emits the SAME cell:/note: payload saveOrderSheet parses).
// D1: enter the full 13/3/69 fixture through the matrix → save → reload → totals persist (446).
// D2: rename a CONFIRMED shop → re-save → the pre-existing cell's snapshot is UNCHANGED
//     (preserve-on-resave end-to-end).
test.use({ storageState: "e2e/.auth/staff.json" });

interface Fixture {
  date: string;
  cells: { rosterOrder: number; printOrder: number; qty: number }[];
  expectedColumnTotals: Record<string, number>;
  expectedGrandTotal: number;
}

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "../test-fixtures/sheet-13-03-69.json"), "utf8"),
) as Fixture;

async function openSheet(page: import("@playwright/test").Page, isoDate: string, location = "") {
  await page.goto("/orders");
  await page.fill('input[name="date"]', isoDate);
  if (location) await page.fill('input[name="location"]', location);
  await page.click('button:has-text("เปิดใบออเดอร์")');
  await page.waitForURL(/\/orders\/\d+$/);
}

/** Matrix cell entry: fill the numeric input identified by its row/column testid. */
async function enterCell(
  page: import("@playwright/test").Page,
  rosterOrder: number,
  printOrder: number,
  qty: number,
) {
  await page.getByTestId(`cell-${rosterOrder}-${printOrder}`).fill(String(qty));
}

test("D1: enter the 13/3/69 fixture, save, reload — column totals + grand 446 persist", async ({
  page,
}) => {
  await openSheet(page, fixture.date, "E2E-D1");

  for (const cell of fixture.cells) {
    await enterCell(page, cell.rosterOrder, cell.printOrder, cell.qty);
  }

  // Live grand total reflects the entered grid before saving.
  await expect(page.getByTestId("grand-total")).toHaveText("446");

  await page.click('button:has-text("บันทึก")');
  await expect(page.getByText(/บันทึกล่าสุด/)).toBeVisible();

  // Reload — values rehydrate from the DB and totals recompute.
  await page.reload();
  await expect(page.getByTestId("grand-total")).toHaveText("446");

  // Spot-check a few persisted per-column footer totals (always in the DOM).
  await expect(page.getByTestId("total-4")).toHaveText("137");
  await expect(page.getByTestId("total-8")).toHaveText("82");
  await expect(page.getByTestId("total-2")).toHaveText("99");
});

test("D2: rename a confirmed shop, re-save — pre-existing cell snapshot is preserved", async ({
  page,
}) => {
  // Use roster slot 26 (confirmed shop, NOT in the D1 fixture) so this flow is independent.
  const slot = 26;
  const shop = await prisma.shop.findUnique({ where: { rosterOrder: slot } });
  expect(shop, "seeded shop at roster slot 26").toBeTruthy();
  const originalName = shop!.name;

  // 1. Fresh sheet, enter one cell for the confirmed shop (printOrder 1), save → snapshot = originalName.
  await openSheet(page, "2026-03-14", "E2E-D2");
  const sheetUrl = page.url();
  const sheetId = Number(sheetUrl.match(/\/orders\/(\d+)$/)![1]);
  await enterCell(page, slot, 1, 7);
  await page.click('button:has-text("บันทึก")');
  await expect(page.getByText(/บันทึกล่าสุด/)).toBeVisible();

  const afterFirstSave = await prisma.orderLine.findFirst({
    where: { sheetId, shopId: shop!.id },
  });
  expect(afterFirstSave?.shopNameAtEntry).toBe(originalName);

  // 2. Rename the shop, keeping it CONFIRMED (needsConfirmation stays off → cascade is LOCKED).
  const renamed = `${originalName} TEST`;
  await page.goto(`/shops/${shop!.id}/edit`);
  await page.fill('input[name="name"]', renamed);
  const confirmCb = page.locator('input[name="needsConfirmation"]');
  if (await confirmCb.isChecked()) await confirmCb.uncheck();
  await page.click('button:has-text("บันทึก")');
  await page.waitForURL(/\/shops$/);

  // 3. Re-open the sheet and re-save (delete-and-recreate).
  await page.goto(sheetUrl);
  await page.click('button:has-text("บันทึก")');
  await expect(page.getByText(/บันทึกล่าสุด/)).toBeVisible();

  // 4. The snapshot must still be the ORIGINAL name (carry-forward), even though the live shop
  //    name is now the renamed value. A naive re-derive would have written the renamed value.
  const afterResave = await prisma.orderLine.findFirst({
    where: { sheetId, shopId: shop!.id },
  });
  expect(afterResave?.shopNameAtEntry).toBe(originalName);
  const liveShop = await prisma.shop.findUnique({ where: { id: shop!.id } });
  expect(liveShop?.name).toBe(renamed);

  // Cleanup: restore the original shop name so the sandbox stays close to the seed.
  await prisma.shop.update({ where: { id: shop!.id }, data: { name: originalName } });
  await prisma.$disconnect();
});
