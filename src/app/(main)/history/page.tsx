import Link from "next/link";
import { requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { ceToBeDisplay } from "@/lib/be-date";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";

// ประวัติออเดอร์ (/history) — Phase 03. READ-ONLY list of REAL OrderSheet rows (no mock data).
// Per-sheet aggregates (units + shop count) come from ONE orderLine.groupBy reduced in memory
// (no N+1); the shop count unions NoteLine-only shops so it matches the matrix orderedCount. The
// most-recent sheet whose date == today (UTC-midnight compare) is "กำลังกรอก" (live); every past
// sheet is "ปิดยอดแล้ว" (closed). weight/ปี๊บ render "—" (not persisted — backlog).
export const dynamic = "force-dynamic";

/** Normalize a @db.Date (UTC-midnight) into a local calendar date for BE display / weekday. */
function normalizeDbDate(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** UTC-midnight epoch for a @db.Date (the stable comparison key — no naive local Date compare). */
function dbDayKey(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export default async function HistoryPage() {
  await requireAuth();

  const [sheets, lineGroups, noteGroups] = await Promise.all([
    prisma.orderSheet.findMany({ orderBy: [{ date: "desc" }, { id: "desc" }] }),
    prisma.orderLine.groupBy({ by: ["sheetId", "shopId"], _sum: { qty: true } }),
    prisma.noteLine.groupBy({
      by: ["sheetId", "shopId"],
      where: { shopId: { not: null } },
    }),
  ]);

  // Reduce the ONE groupBy result to per-sheet { units, shops:Set }.
  const agg = new Map<number, { units: number; shops: Set<number> }>();
  const bucket = (sheetId: number) => {
    let b = agg.get(sheetId);
    if (!b) {
      b = { units: 0, shops: new Set<number>() };
      agg.set(sheetId, b);
    }
    return b;
  };
  for (const g of lineGroups) {
    const b = bucket(g.sheetId);
    b.units += g._sum.qty ?? 0;
    b.shops.add(g.shopId);
  }
  for (const g of noteGroups) {
    if (g.shopId == null) continue;
    bucket(g.sheetId).shops.add(g.shopId);
  }

  const rows = sheets.map((sheet) => {
    const b = agg.get(sheet.id);
    return {
      id: sheet.id,
      date: sheet.date,
      dayKey: dbDayKey(sheet.date),
      units: b?.units ?? 0,
      shopCount: b?.shops.size ?? 0,
    };
  });

  const now = new Date();
  const todayKey = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const maxUnits = Math.max(1, ...rows.map((r) => r.units));

  // Current-month footer (working days + unit sum + average). No weight aggregate (not persisted).
  const monthRows = rows.filter((r) => {
    const local = normalizeDbDate(r.date);
    return local.getFullYear() === now.getFullYear() && local.getMonth() === now.getMonth();
  });
  const monthUnits = monthRows.reduce((s, r) => s + r.units, 0);
  const monthDays = monthRows.length;
  const monthAvg = monthDays > 0 ? Math.round(monthUnits / monthDays) : 0;

  const dash = <span className="text-[var(--text-faint)]">—</span>;

  return (
    <main className="flex w-full flex-col gap-4 p-6">
      <h1 className="text-[var(--t-xl)] font-semibold text-[var(--text-strong)]">ประวัติออเดอร์</h1>

      {rows.length === 0 ? (
        <Card className="p-8">
          <p className="text-center text-[var(--text-faint)]">ยังไม่มีใบออเดอร์</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full border-collapse text-[var(--t-sm)]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-sunken)] text-left text-[var(--text-muted)]">
                <th className="px-3 py-2.5 font-medium">วันที่</th>
                <th className="px-3 py-2.5 font-medium">วัน</th>
                <th className="px-3 py-2.5 text-right font-medium">ร้านที่สั่ง</th>
                <th className="px-3 py-2.5 text-right font-medium">รวมหน่วย</th>
                <th className="px-3 py-2.5 font-medium" style={{ width: 140 }}>
                  สัดส่วน
                </th>
                <th className="px-3 py-2.5 text-right font-medium">น้ำหนัก</th>
                <th className="px-3 py-2.5 text-right font-medium">ปี๊บ</th>
                <th className="px-3 py-2.5 font-medium">สถานะ</th>
                <th className="px-3 py-2.5 text-right font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isToday = r.dayKey === todayKey;
                const local = normalizeDbDate(r.date);
                return (
                  <tr
                    key={r.id}
                    data-testid={`history-row-${r.id}`}
                    className="border-b border-[var(--border)] last:border-b-0"
                    style={isToday ? { backgroundColor: "var(--amber-50)" } : undefined}
                  >
                    <td className="px-3 py-2.5 font-[var(--font-mono)] text-[var(--text-strong)]">
                      {ceToBeDisplay(local)}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--text-muted)]">
                      {local.toLocaleDateString("th-TH", { weekday: "short" })}
                    </td>
                    <td className="px-3 py-2.5 text-right font-[var(--font-mono)] tabular-nums text-[var(--text)]">
                      {r.shopCount}
                    </td>
                    <td className="px-3 py-2.5 text-right font-[var(--font-mono)] tabular-nums text-[var(--text-strong)]">
                      {r.units}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex h-2 items-center">
                        <span
                          className="h-2 rounded-full"
                          style={{
                            width: `${(r.units / maxUnits) * 100}%`,
                            minWidth: r.units > 0 ? 2 : 0,
                            backgroundColor: isToday ? "var(--amber-500)" : "var(--green-500)",
                          }}
                        />
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">{dash}</td>
                    <td className="px-3 py-2.5 text-right">{dash}</td>
                    <td className="px-3 py-2.5">
                      {isToday ? (
                        <Chip tone="warning" data-testid={`history-status-${r.id}`}>
                          กำลังกรอก
                        </Chip>
                      ) : (
                        <Chip tone="success" data-testid={`history-status-${r.id}`}>
                          ปิดยอดแล้ว
                        </Chip>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link
                        href={`/orders/${r.id}`}
                        className="text-[var(--brand-int)] hover:underline"
                      >
                        เปิดใบงาน
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Current-month footer — no weight aggregate (not persisted). */}
      {monthDays > 0 && (
        <Card className="grid grid-cols-3 overflow-hidden p-0">
          {[
            { label: "วันทำการ (เดือนนี้)", value: `${monthDays} วัน` },
            { label: "รวมหน่วย (เดือนนี้)", value: String(monthUnits) },
            { label: "เฉลี่ยต่อวัน", value: String(monthAvg) },
          ].map((s, i) => (
            <div
              key={s.label}
              className={
                "flex flex-col items-center justify-center gap-1 px-3 py-4 " +
                (i > 0 ? "border-l border-[var(--border)]" : "")
              }
            >
              <span className="text-[12px] text-[var(--text-muted)]">{s.label}</span>
              <span className="font-[var(--font-mono)] text-[22px] text-[var(--text-strong)]">
                {s.value}
              </span>
            </div>
          ))}
        </Card>
      )}
    </main>
  );
}
