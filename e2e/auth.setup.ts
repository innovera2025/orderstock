import { test as setup, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

// Produces reusable ADMIN + STAFF storage-state fixtures (reused by Phases 04-06). Also ensures
// a known STAFF user exists (the seed only creates the ADMIN). Credentials come from the env so
// no plaintext is committed: ADMIN uses SEED_ADMIN_PASSWORD; STAFF uses a fixed test password.

const AUTH_DIR = resolve(__dirname, ".auth");
const ADMIN_USER = "admin";
const STAFF_USER = "staff_e2e";
const STAFF_PASSWORD = "Staff-E2E-Passw0rd";

async function login(page: import("@playwright/test").Page, username: string, password: string) {
  await page.goto("/login");
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("http://localhost:3000/");
}

setup("ensure staff user + save ADMIN and STAFF storage states", async ({ browser }) => {
  mkdirSync(AUTH_DIR, { recursive: true });

  // Ensure a STAFF user exists with a known password (idempotent).
  const existing = await prisma.user.findUnique({ where: { username: STAFF_USER } });
  if (!existing) {
    await prisma.user.create({
      data: {
        username: STAFF_USER,
        passwordHash: await hashPassword(STAFF_PASSWORD),
        role: "STAFF",
        active: true,
      },
    });
  }
  await prisma.$disconnect();

  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  expect(adminPassword, "SEED_ADMIN_PASSWORD must be set for E2E").toBeTruthy();

  // ADMIN storage state.
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await login(adminPage, ADMIN_USER, adminPassword as string);
  await adminCtx.storageState({ path: resolve(AUTH_DIR, "admin.json") });
  await adminCtx.close();

  // STAFF storage state.
  const staffCtx = await browser.newContext();
  const staffPage = await staffCtx.newPage();
  await login(staffPage, STAFF_USER, STAFF_PASSWORD);
  await staffCtx.storageState({ path: resolve(AUTH_DIR, "staff.json") });
  await staffCtx.close();
});
