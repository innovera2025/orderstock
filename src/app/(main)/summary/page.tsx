import { requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { ceToBeDisplay } from "@/lib/be-date";
import { Card } from "@/components/ui/card";
import {
  computeColumnTotals,
  computeGrandTotal,
  type OrderLineCell,
} from "@/lib/totals";
import { topShops } from "@/lib/summary";

// สรุปยอดผลิต (/summary) — Phase 03. READ-ONLY production summary over an existing OrderSheet.
// The LEFT bars ARE the 20 computeColumnTotals columns (the literal gate); the RIGHT list is the
// per-shop top-8 from the new pure src/lib/summary.ts. Consumes totals.ts UNCHANGED — no new
// write path, no schema change. Defaults to the most-recent sheet; ?date=yyyy-mm-dd (+ ?location)
// selects a specific day using the get-sheet-for-print date convention (UTC-midnight, no naive
// new Date compare).
export const dynamic = "force-dynamic";

/** Build a UTC-midnight Date for a @db.Date column from yyyy-mm-dd (mirrors get-sheet-for-print). */
function parseDbDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

/** Normalize a @db.Date (UTC-midnight) into a local calendar date for BE display (no TZ drift). */
function normalizeDbDate(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

interface ColumnBar {
  printOrder: number;
  name: string;
  group: string;
  qty: number;
}

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; location?: string }>;
}) {
  await requireAuth();
  const { date, location } = await searchParams;

  const sheet = date
    ? await prisma.orderSheet.findFirst({
        where: { date: parseDbDate(date), ...(location != null ? { location } : {}) },
        orderBy: { id: "desc" },
      })
    : await prisma.orderSheet.findFirst({
        orderBy: [{ date: "desc" }, { id: "desc" }],
      });

  if (!sheet) {
    return (
      <main className="w-full p-8">
        <h1 className="mb-2 text-[var(--t-xl)] font-semibold text-[var(--text-strong)]">สรุปยอดผลิต</h1>
        <p className="text-[var(--t-base)] text-[var(--text-faint)]">ยังไม่มีใบออเดอร์</p>
      </main>
    );
  }

  const [shops, variants, orderLines, noteLines] = await Promise.all([
    prisma.shop.findMany({ orderBy: { rosterOrder: "asc" } }),
    prisma.productVariant.findMany({
      where: { printOrder: { not: null } },
      orderBy: { printOrder: "asc" },
      include: { product: { select: { group: true, name: true } } },
    }),
    prisma.orderLine.findMany({ where: { sheetId: sheet.id } }),
    prisma.noteLine.findMany({ where: { sheetId: sheet.id } }),
  ]);

  const rosterByShopId = new Map(shops.map((s) => [s.id, s.rosterOrder]));
  const nameByRoster = new Map(shops.map((s) => [s.rosterOrder, s.name]));
  const variantPrintOrderById = new Map(variants.map((v) => [v.id, v.printOrder as number]));

  // OrderLineCell[] for the totals engine (grid cells only; NoteLine qty is excluded by type).
  const cells: OrderLineCell[] = [];
  for (const line of orderLines) {
    const rosterOrder = rosterByShopId.get(line.shopId);
    const printOrder = variantPrintOrderById.get(line.variantId);
    if (rosterOrder == null || printOrder == null) continue;
    cells.push({ rosterOrder, printOrder, qty: line.qty });
  }

  const columnTotals = computeColumnTotals(cells);
  const grandTotal = computeGrandTotal(cells);
  const top8 = topShops(cells, 8);

  const columnBars: ColumnBar[] = variants.map((v) => {
    const printOrder = v.printOrder as number;
    return {
      printOrder,
      name: v.name,
      group: v.product.group,
      qty: columnTotals[printOrder] ?? 0,
    };
  });

  const orderedShopCount = new Set([
    ...cells.map((c) => c.rosterOrder),
    ...noteLines
      .map((n) => (n.shopId != null ? rosterByShopId.get(n.shopId) : undefined))
      .filter((r): r is number => r != null),
  ]).size;

  const maxColumn = Math.max(1, ...columnBars.map((c) => c.qty));
  const maxShop = Math.max(1, ...top8.map((s) => s.qty));

  const noteUnits = noteLines
    .filter((n) => n.shopId != null)
    .map((n) => ({
      shopName:
        (n.shopId != null ? nameByRoster.get(rosterByShopId.get(n.shopId) ?? -1) : null) ?? "—",
      text: n.text,
      qty: n.qty,
    }));

  const kpis = [
    { label: "รวมน้ำหนัก (กก.)", value: "—", mono: true, testid: undefined as string | undefined },
    { label: "รวมปี๊บ", value: "—", mono: true, testid: undefined },
    { label: "ร้านที่สั่ง", value: String(orderedShopCount), mono: true, testid: undefined },
    { label: "รวมจำนวน (หน่วย)", value: String(grandTotal), mono: true, testid: "grand-total", brand: true },
  ];

  return (
    <main className="flex w-full flex-col gap-4 p-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-[var(--t-xl)] font-semibold text-[var(--text-strong)]">สรุปยอดผลิต</h1>
        <span className="font-[var(--font-mono)] text-[13px] text-[var(--text-muted)]">
          {ceToBeDisplay(normalizeDbDate(sheet.date))}
          {sheet.location ? ` — ${sheet.location}` : ""}
        </span>
      </div>

      {/* KPI strip (reuses the order-matrix KPI markup shape). */}
      <div className="grid grid-cols-4 overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg-surface)]">
        {kpis.map((kpi, i) => (
          <div
            key={kpi.label}
            className={
              "flex flex-col items-center justify-center gap-1 px-3 py-4 " +
              (i > 0 ? "border-l border-[var(--border)]" : "")
            }
          >
            <span className="text-[12px] text-[var(--text-muted)]">{kpi.label}</span>
            <span
              data-testid={kpi.testid}
              className={
                "font-[var(--font-mono)] text-[27px] " +
                (kpi.brand ? "text-[var(--brand-int)]" : "text-[var(--text-strong)]")
              }
            >
              {kpi.value}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
        {/* LEFT — 20 per-column bars (== computeColumnTotals). */}
        <Card className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[var(--t-base)] font-semibold text-[var(--text-strong)]">
              ยอดผลิตตามสินค้า
            </h2>
            <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "var(--green-500)" }} />
                สินค้า
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "var(--amber-500)" }} />
                เครื่องปรุง
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            {columnBars.map((c) => {
              const color = c.group === "SEASONING" ? "var(--amber-500)" : "var(--green-500)";
              const pct = (c.qty / maxColumn) * 100;
              return (
                <div
                  key={c.printOrder}
                  className="grid items-center gap-2"
                  style={{ gridTemplateColumns: "180px 1fr 70px" }}
                >
                  <span className="truncate text-[12.5px] text-[var(--text)]" title={c.name}>
                    {c.name}
                  </span>
                  <span className="flex h-2 items-center">
                    <span
                      data-testid={`bar-${c.printOrder}`}
                      data-qty={c.qty}
                      className="h-2 rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: color, minWidth: c.qty > 0 ? 2 : 0 }}
                    />
                  </span>
                  <span
                    className={
                      "text-right font-[var(--font-mono)] text-[12.5px] tabular-nums " +
                      (c.qty === 0 ? "text-[var(--text-faint)]" : "text-[var(--text-strong)]")
                    }
                  >
                    {c.qty}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-1 flex items-center justify-between rounded-[var(--r-md)] bg-[var(--green-50)] px-3 py-2">
            <span className="text-[12.5px] font-semibold text-[var(--green-900,#0E3B2E)]">
              รวมทุกสินค้า
            </span>
            <span className="font-[var(--font-mono)] text-[14px] font-bold text-[var(--brand-int)]">
              {grandTotal} หน่วย
            </span>
          </div>
        </Card>

        {/* RIGHT — top-8 shops + note units. */}
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="text-[var(--t-base)] font-semibold text-[var(--text-strong)]">
              ร้านที่สั่งมากที่สุด
            </h2>
            {top8.length === 0 ? (
              <p className="text-[12.5px] text-[var(--text-faint)]">—</p>
            ) : (
              <div className="flex flex-col gap-2">
                {top8.map((s, i) => (
                  <div key={s.rosterOrder} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between">
                      <span className="truncate text-[12.5px] text-[var(--text)]">
                        <span className="mr-1.5 text-[var(--text-faint)]">{i + 1}.</span>
                        {nameByRoster.get(s.rosterOrder) ?? `#${s.rosterOrder}`}
                      </span>
                      <span className="font-[var(--font-mono)] text-[12.5px] tabular-nums text-[var(--text-strong)]">
                        {s.qty}
                      </span>
                    </div>
                    <span className="flex h-[5px] items-center">
                      <span
                        className="h-[5px] rounded-full"
                        style={{
                          width: `${(s.qty / maxShop) * 100}%`,
                          backgroundColor: "var(--green-500)",
                        }}
                      />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <h2 className="text-[var(--t-base)] font-semibold text-[var(--text-strong)]">
              หน่วยพิเศษจากหมายเหตุ
            </h2>
            {noteUnits.length === 0 ? (
              <p className="text-[12.5px] text-[var(--text-faint)]">—</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {noteUnits.map((n, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-2">
                    <span className="text-[12px] text-[var(--text)]">
                      <span className="text-[var(--text-muted)]">{n.shopName}</span> · {n.text}
                    </span>
                    {n.qty != null && (
                      <span className="font-[var(--font-mono)] text-[12px] tabular-nums text-[var(--text-strong)]">
                        {n.qty}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}
