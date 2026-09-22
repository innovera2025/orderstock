import { test, expect } from "@playwright/test";

// erp-dashboards Phase 1 — gate AC1-infra (the nav-shell half of "Staff or Admin sees the
// dashboards"). Runs under BOTH the `chromium` project (desktop sidebar) and the `mobile`
// project (390×844 bottom tab bar); each block skips itself outside its own tier so the file is
// safe in either project.
//
// Read-only: navigates an authenticated route and asserts nav shell contents. No DB writes, no
// ERP connection. The 3 dashboard routes 404 until Phases 2/3/4 land their pages — this spec
// asserts the LINKS exist, never that the pages render.

const DASHBOARD_LINKS = [
  { href: "/dashboards/sales", label: "ยอดขาย" },
  { href: "/dashboards/purchase", label: "การจัดซื้อ" },
  { href: "/dashboards/production", label: "การผลิต" },
];

// ---------------------------------------------------------------------------------------
// Desktop sidebar (chromium project) — the group renders for BOTH roles.
// ---------------------------------------------------------------------------------------
test.describe("แดชบอร์ด nav group — desktop sidebar", () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? 1280) < 768,
    "desktop sidebar tier only",
  );

  for (const role of ["admin", "staff"] as const) {
    test(`renders all 3 dashboard links for ${role}`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: `e2e/.auth/${role}.json` });
      const page = await ctx.newPage();
      await page.goto("/orders");

      const sidebar = page.locator("#app-sidebar");
      await expect(sidebar.getByText("แดชบอร์ด", { exact: true })).toBeVisible();

      for (const link of DASHBOARD_LINKS) {
        const anchor = sidebar.locator(`a[href="${link.href}"]`);
        await expect(anchor).toHaveCount(1);
        await expect(anchor).toContainText(link.label);
      }

      await ctx.close();
    });
  }

  test("the 3 links point at exactly the agreed dashboard routes", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "e2e/.auth/staff.json" });
    const page = await ctx.newPage();
    await page.goto("/orders");

    const hrefs = await page
      .locator('#app-sidebar a[href^="/dashboards/"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    expect(hrefs).toEqual(DASHBOARD_LINKS.map((l) => l.href));

    await ctx.close();
  });
});

// ---------------------------------------------------------------------------------------
// Phone tier (mobile project, 390×844) — the bottom tab bar must be UNCHANGED at 3 tabs.
// This is the non-regression half: adding a nav group must not leak into the phone tab bar.
// ---------------------------------------------------------------------------------------
test.describe("phone bottom tab bar — unchanged by the dashboards group", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) >= 768, "phone tier only");

  test("still shows exactly 3 tabs for ADMIN and no dashboard tab", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "e2e/.auth/admin.json" });
    const page = await ctx.newPage();
    await page.goto("/orders");

    const tabBar = page.getByLabel("แถบเมนูล่าง");
    await expect(tabBar).toBeVisible();
    await expect(tabBar.locator("a")).toHaveCount(3);
    await expect(page.getByTestId("tab-orders")).toBeVisible();
    await expect(page.getByTestId("tab-summary")).toBeVisible();
    await expect(page.getByTestId("tab-users")).toBeVisible();
    await expect(tabBar.locator('a[href^="/dashboards/"]')).toHaveCount(0);

    await ctx.close();
  });

  test("still shows exactly 2 tabs for STAFF and no dashboard tab", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "e2e/.auth/staff.json" });
    const page = await ctx.newPage();
    await page.goto("/orders");

    const tabBar = page.getByLabel("แถบเมนูล่าง");
    await expect(tabBar.locator("a")).toHaveCount(2);
    await expect(tabBar.locator('a[href^="/dashboards/"]')).toHaveCount(0);

    await ctx.close();
  });

  test("the sidebar (and its dashboards group) stays hidden at phone width", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: "e2e/.auth/admin.json" });
    const page = await ctx.newPage();
    await page.goto("/orders");

    // The sidebar is off-canvas/hidden below md — no visible dashboard link at phone width.
    await expect(page.locator('#app-sidebar a[href="/dashboards/sales"]')).toBeHidden();

    await ctx.close();
  });
});
