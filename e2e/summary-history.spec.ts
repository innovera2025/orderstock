import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/lib/db";
import { cleanState } from "./util/clean-state";

// Phase 03 hybrid gates (validate-contract G6 + G7). Both screens are READ-ONLY views over real
// data, so these tests SEED real OrderSheet rows via prisma (E2E-located) then assert the rendered
// output. A `beforeEach` clean-state helper (the Phase-02 EVL residual) deletes E2E-located sheets
// and restores any shop renamed by a prior failed D2 run, so /history is deterministic regardless
// of run order.
test.use({ storageState: "e2e/.auth/admin.json" });

interface Fixture {
  date: string;
  cells: { rosterOrder: number; printOrder: number; qty: number }[];
  expectedGrandTotal: number;
}

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "../test-fixtures/sheet-13-03-69.json"), "utf8"),
) as Fixture;

/** Seed one OrderSheet from the 13/3/69 fixture at a given date (yyyy-mm-dd) + location. */
async function seedSheet(dateStr: string, location: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));

  const [shops, variants] = await Promise.all([
    prisma.shop.findMany(),
    prisma.productVariant.findMany({ where: { printOrder: { not: null } } }),
  ]);
  const shopByRoster = new Map(shops.map((s) => [s.rosterOrder, s]));
  const variantByPrint = new Map(variants.map((v) => [v.printOrder as number, v]));

  const sheet = await prisma.orderSheet.create({ data: { date, location } });
  const data = fixture.cells
    .map((c) => {
      const shop = shopByRoster.get(c.rosterOrder);
      const variant = variantByPrint.get(c.printOrder);
      if (!shop || !variant) return null;
      return {
        sheetId: sheet.id,
        shopId: shop.id,
        variantId: variant.id,
        qty: c.qty,
        shopNameAtEntry: shop.name,
        variantNameAtEntry: variant.name,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
  await prisma.orderLine.createMany({ data });
  return sheet;
}

test.beforeEach(cleanState);
test.afterAll(async () => {
  await cleanState();
  await prisma.$disconnect();
});

test("G6: /summary shows grand total 446 + 20 product bars for the seeded day", async ({ page }) => {
  await seedSheet(fixture.date, "E2E-SUMMARY");

  await page.goto(`/summary?date=${fixture.date}&location=E2E-SUMMARY`);

  await expect(page.getByTestId("grand-total")).toHaveText("446");
  await expect(page.locator('[data-testid^="bar-"]')).toHaveCount(20);
  // Per-column bars carry the exact computeColumnTotals value.
  await expect(page.getByTestId("bar-4")).toHaveAttribute("data-qty", "137");
  await expect(page.getByTestId("bar-2")).toHaveAttribute("data-qty", "99");
  await expect(page.getByTestId("bar-8")).toHaveAttribute("data-qty", "82");
});

test("G7: /history lists today (live) + past (closed) with weight dash", async ({ page }) => {
  const n = new Date();
  const todayIso = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(
    n.getDate(),
  ).padStart(2, "0")}`;

  const todaySheet = await seedSheet(todayIso, "E2E-HIST-TODAY");
  const pastSheet = await seedSheet("2026-03-13", "E2E-HIST-PAST");

  await page.goto("/history");

  await expect(page.getByTestId(`history-status-${todaySheet.id}`)).toContainText("กำลังกรอก");
  await expect(page.getByTestId(`history-status-${pastSheet.id}`)).toContainText("ปิดยอดแล้ว");
  // weight / ปี๊บ render "—" (not persisted).
  await expect(page.getByTestId(`history-row-${pastSheet.id}`)).toContainText("—");
  // "เปิดใบงาน" links to the real order sheet.
  await expect(
    page.getByTestId(`history-row-${pastSheet.id}`).getByRole("link", { name: "เปิดใบงาน" }),
  ).toHaveAttribute("href", `/orders/${pastSheet.id}`);
});
