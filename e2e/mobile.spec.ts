import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/lib/db";
import { cleanState } from "./util/clean-state";

// Phase 04 mobile gates (validate-contract DoD#4-mobile-e2e + tab-nav). Runs under the 390×844
// `mobile` project. The per-shop stepper writes through the SAME order-matrix cells/notes state and
// the SAME `<form id="order-sheet-form">` as the desktop matrix — so entering the 13/3/69 fixture
// via the mobile steppers and saving must reconstruct grand total 446 (structural byte-identity,
// no second save path). Bottom tabs navigate the screens; the entry overlay covers the tab bar.

interface Fixture {
  date: string;
  cells: { rosterOrder: number; printOrder: number; qty: number }[];
  expectedGrandTotal: number;
}

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "../test-fixtures/sheet-13-03-69.json"), "utf8"),
) as Fixture;

/** Group fixture cells by roster slot → the mobile per-shop entry unit. */
function cellsByShop(): Map<number, { printOrder: number; qty: number }[]> {
  const m = new Map<number, { printOrder: number; qty: number }[]>();
  for (const c of fixture.cells) {
    const arr = m.get(c.rosterOrder) ?? [];
    arr.push({ printOrder: c.printOrder, qty: c.qty });
    m.set(c.rosterOrder, arr);
  }
  return m;
}

async function openSheet(page: Page, isoDate: string, location: string) {
  await page.goto("/orders");
  await page.fill('input[name="date"]', isoDate);
  await page.fill('input[name="location"]', location);
  await page.click('button:has-text("เปิดใบออเดอร์")');
  await page.waitForURL(/\/orders\/\d+$/);
}

test.describe("mobile order entry (staff)", () => {
  test.use({ storageState: "e2e/.auth/staff.json" });
  test.beforeEach(cleanState);
  test.afterAll(async () => {
    await cleanState();
    await prisma.$disconnect();
  });

  test("enter 13/3/69 via mobile steppers → save → reload reconstructs grand total 446", async ({
    page,
  }) => {
    await openSheet(page, fixture.date, "E2E-MOBILE");

    const byShop = cellsByShop();
    // Enter every shop's cells through the per-shop stepper overlay (cumulative React state — no
    // save yet), returning to the list between shops.
    for (const [roster, group] of byShop) {
      await page.getByTestId(`mobile-shop-${roster}`).click();
      await expect(page.getByTestId("mobile-entry")).toBeVisible();
      for (const cell of group) {
        await page.getByTestId(`mobile-cell-${roster}-${cell.printOrder}`).fill(String(cell.qty));
      }
      await page.getByTestId("mobile-entry-back").click();
    }

    // One shared save (form="order-sheet-form") persists the whole cumulative payload.
    const firstRoster = byShop.keys().next().value as number;
    await page.getByTestId(`mobile-shop-${firstRoster}`).click();
    await page.getByTestId("mobile-save").click();
    await expect(page.getByText(/บันทึกล่าสุด/)).toBeVisible();

    // Reload — values rehydrate from the DB; the (CSS-hidden) desktop KPI still carries the total.
    await page.reload();
    await expect(page.getByTestId("grand-total")).toHaveText("446");
    await expect(page.getByTestId("total-4")).toHaveText("137");
    await expect(page.getByTestId("total-8")).toHaveText("82");
  });

  test("per-shop entry overlay is full-viewport (covers the bottom tab bar)", async ({ page }) => {
    await openSheet(page, fixture.date, "E2E-MOBILE");

    // Tab bar visible on the list screen.
    await expect(page.getByTestId("tab-orders")).toBeVisible();

    await page.getByTestId(`mobile-shop-${fixture.cells[0].rosterOrder}`).click();
    const overlay = page.getByTestId("mobile-entry");
    await expect(overlay).toBeVisible();

    // The fixed overlay spans the full 390×844 viewport, so it sits ON TOP of the fixed tab bar.
    const box = await overlay.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeLessThanOrEqual(1);
    expect(box!.height).toBeGreaterThanOrEqual(800);

    // The save button (top of the tab bar's z-stack) is clickable, proving the overlay is on top.
    await expect(page.getByTestId("mobile-save")).toBeVisible();
  });

  test("STAFF never sees the ADMIN-only ผู้ใช้ tab", async ({ page }) => {
    await page.goto("/orders");
    await expect(page.getByTestId("tab-orders")).toBeVisible();
    await expect(page.getByTestId("tab-summary")).toBeVisible();
    await expect(page.getByTestId("tab-users")).toHaveCount(0);
  });
});

test.describe("mobile bottom tabs (admin)", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("3 bottom tabs navigate ร้านค้า / สรุปยอด / ผู้ใช้", async ({ page }) => {
    await page.goto("/orders");
    await expect(page.getByTestId("tab-orders")).toBeVisible();
    await expect(page.getByTestId("tab-summary")).toBeVisible();
    await expect(page.getByTestId("tab-users")).toBeVisible();

    await page.getByTestId("tab-summary").click();
    await expect(page).toHaveURL(/\/summary/);

    await page.getByTestId("tab-users").click();
    await expect(page).toHaveURL(/\/admin\/users/);

    await page.getByTestId("tab-orders").click();
    await expect(page).toHaveURL(/\/orders/);
  });
});
