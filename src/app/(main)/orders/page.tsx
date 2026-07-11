import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ceToBeDisplay } from "@/lib/be-date";
import { NewSheetForm } from "./new-sheet-form";
import { DeleteSheetButton } from "./delete-sheet-button";

export const dynamic = "force-dynamic";

/** Normalize a @db.Date (UTC-midnight) into a local calendar date for BE display (no TZ drift). */
function normalizeDbDate(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export default async function OrdersPage() {
  const session = await auth();
  const role = session?.user?.role;

  const sheets = await prisma.orderSheet.findMany({
    where: { active: true },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    include: { _count: { select: { orderLines: true } } },
  });

  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <h1 className="mb-6 text-[var(--t-2xl)] font-semibold text-[var(--text-strong)]">ใบออเดอร์สินค้า</h1>

      <section className="mb-8 rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h2 className="mb-3 text-[var(--t-sm)] font-medium text-[var(--text-muted)]">เปิดใบออเดอร์ใหม่</h2>
        <NewSheetForm />
      </section>

      <table className="w-full border-collapse text-[var(--t-sm)]">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
            <th className="py-2 pr-2 font-medium">วันที่ (พ.ศ.)</th>
            <th className="py-2 pr-2 font-medium">สถานที่</th>
            <th className="py-2 pr-2 text-right font-medium">จำนวนรายการ</th>
            <th className="py-2 pr-2 text-right font-medium">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {sheets.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-[var(--text-faint)]">
                ยังไม่มีใบออเดอร์
              </td>
            </tr>
          )}
          {sheets.map((sheet) => (
            <tr key={sheet.id} data-testid={`sheet-row-${sheet.id}`} className="border-b border-[var(--border)]">
              <td className="py-2 pr-2 font-[var(--font-mono)]">{ceToBeDisplay(normalizeDbDate(sheet.date))}</td>
              <td className="py-2 pr-2">{sheet.location ?? "-"}</td>
              <td className="py-2 pr-2 text-right font-[var(--font-mono)]">{sheet._count.orderLines}</td>
              <td className="py-2 pr-2 text-right">
                <Link href={`/orders/${sheet.id}`} className="text-[var(--brand-int)] hover:underline">
                  เปิด/แก้ไข
                </Link>
                {role === "ADMIN" && (
                  <DeleteSheetButton
                    sheetId={sheet.id}
                    dateLabel={ceToBeDisplay(normalizeDbDate(sheet.date))}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
