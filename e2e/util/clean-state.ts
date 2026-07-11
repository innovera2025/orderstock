import { prisma } from "../../src/lib/db";

// Shared e2e clean-state helper — hoisted from summary-history.spec.ts in Phase 04 (the Phase-03
// EVL residual). Deletes every OrderSheet located at an E2E marker (plus its order/note lines) and
// restores any shop renamed by a prior D2-style run, so UI-seeding specs are deterministic
// regardless of run order. Consumed by summary-history.spec.ts and mobile.spec.ts.
export const E2E_LOCATIONS = [
  "E2E-SUMMARY",
  "E2E-HIST-TODAY",
  "E2E-HIST-PAST",
  "E2E-MOBILE",
  "E2E-DEL-SUMMARY",
  "E2E-DEL-HIST",
];

/** Drop E2E-located sheets + restore shops renamed with a " TEST" suffix. */
export async function cleanState() {
  const sheets = await prisma.orderSheet.findMany({
    where: { location: { in: E2E_LOCATIONS } },
    select: { id: true },
  });
  const ids = sheets.map((s) => s.id);
  if (ids.length) {
    await prisma.orderLine.deleteMany({ where: { sheetId: { in: ids } } });
    await prisma.noteLine.deleteMany({ where: { sheetId: { in: ids } } });
    await prisma.orderSheet.deleteMany({ where: { id: { in: ids } } });
  }
  const renamed = await prisma.shop.findMany({ where: { name: { endsWith: " TEST" } } });
  for (const s of renamed) {
    await prisma.shop.update({
      where: { id: s.id },
      data: { name: s.name.replace(/ TEST$/, "") },
    });
  }
}
