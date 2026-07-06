import Link from "next/link";
import { prisma } from "@/lib/db";
import { ceToBeDisplay } from "@/lib/be-date";
import { NewSheetForm } from "./new-sheet-form";

export const dynamic = "force-dynamic";

/** Normalize a @db.Date (UTC-midnight) into a local calendar date for BE display (no TZ drift). */
function normalizeDbDate(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export default async function OrdersPage() {
  const sheets = await prisma.orderSheet.findMany({
    orderBy: [{ date: "desc" }, { id: "desc" }],
    include: { _count: { select: { orderLines: true } } },
  });

  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <h1 className="mb-6 text-2xl font-bold">ใบออเดอร์สินค้า</h1>

      <section className="mb-8 rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium text-zinc-600">เปิดใบออเดอร์ใหม่</h2>
        <NewSheetForm />
      </section>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-zinc-500">
            <th className="py-2 pr-2">วันที่ (พ.ศ.)</th>
            <th className="py-2 pr-2">สถานที่</th>
            <th className="py-2 pr-2 text-right">จำนวนรายการ</th>
            <th className="py-2 pr-2 text-right">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {sheets.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-zinc-400">
                ยังไม่มีใบออเดอร์
              </td>
            </tr>
          )}
          {sheets.map((sheet) => (
            <tr key={sheet.id} className="border-b">
              <td className="py-2 pr-2">{ceToBeDisplay(normalizeDbDate(sheet.date))}</td>
              <td className="py-2 pr-2">{sheet.location ?? "-"}</td>
              <td className="py-2 pr-2 text-right">{sheet._count.orderLines}</td>
              <td className="py-2 pr-2 text-right">
                <Link href={`/orders/${sheet.id}`} className="text-blue-600">
                  เปิด/แก้ไข
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
