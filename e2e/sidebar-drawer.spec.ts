import { test, expect } from "@playwright/test";

// responsive-drawer-sidebar plan — TABLET-tier gates. Runs ONLY under the `tablet` project
// (820×1180, testMatch in playwright.config.ts) — excluded from `chromium` via testIgnore because
// these assertions ("drawer hidden by default via CSS auto") only hold below the lg (1024px) tier.
// Read-only: navigates to an authenticated route and asserts the drawer shell behavior; no DB seed.
test.use({ storageState: "e2e/.auth/admin.json" });

/** Bounding-box x of the sidebar aside; large-negative when translated off-canvas, ~0 when open. */
async function sidebarX(page: import("@playwright/test").Page): Promise<number> {
  const box = await page.locator("#app-sidebar").boundingBox();
  return box?.x ?? Number.NEGATIVE_INFINITY;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/orders");
});

test("drawer + backdrop are hidden by default at tablet width", async ({ page }) => {
  // Off-canvas: the aside is translated -100% (x ≈ -216), not at x=0.
  expect(await sidebarX(page)).toBeLessThan(0);
  await expect(page.getByTestId("sidebar-backdrop")).toHaveCount(0);
  await expect(page.locator("#sidebar-hamburger")).toHaveAttribute("aria-expanded", "false");
});

test("hamburger opens the drawer + shows the backdrop, aria-expanded flips true", async ({
  page,
}) => {
  await page.locator("#sidebar-hamburger").click();

  await expect.poll(() => sidebarX(page)).toBeGreaterThanOrEqual(0);
  await expect(page.getByTestId("sidebar-backdrop")).toBeVisible();
  await expect(page.locator("#sidebar-hamburger")).toHaveAttribute("aria-expanded", "true");
});

test("clicking the backdrop closes the drawer", async ({ page }) => {
  await page.locator("#sidebar-hamburger").click();
  await expect(page.getByTestId("sidebar-backdrop")).toBeVisible();

  await page.getByTestId("sidebar-backdrop").click();

  await expect.poll(() => sidebarX(page)).toBeLessThan(0);
  await expect(page.getByTestId("sidebar-backdrop")).toHaveCount(0);
  await expect(page.locator("#sidebar-hamburger")).toHaveAttribute("aria-expanded", "false");
});

test("Escape closes the drawer", async ({ page }) => {
  await page.locator("#sidebar-hamburger").click();
  await expect.poll(() => sidebarX(page)).toBeGreaterThanOrEqual(0);

  await page.keyboard.press("Escape");

  await expect.poll(() => sidebarX(page)).toBeLessThan(0);
  await expect(page.locator("#sidebar-hamburger")).toHaveAttribute("aria-expanded", "false");
});

test("order-matrix does not force page-level horizontal overflow at tablet width", async ({
  page,
}) => {
  // The 20-column matrix scrolls inside its own overflow-x-auto container; the page/document must
  // not gain horizontal scroll (small tolerance for sub-pixel rounding).
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
});
