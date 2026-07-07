import { requireAuth } from "@/lib/auth-guard";

// สรุปยอดผลิต stub (Phase 01, E1). Prevents 404 from the new sidebar link + keeps e2e green;
// the full build (bars from computeColumnTotals) lands in Phase 03. Auth-guarded (E-STUB-AUTH).
export default async function SummaryPage() {
  await requireAuth();
  return (
    <div className="flex flex-col gap-2 p-8">
      <h2 className="th text-[var(--t-h3)] font-semibold text-[var(--text-strong)]">
        สรุปยอดผลิต
      </h2>
      <p className="th text-[var(--t-base)] text-[var(--text-muted)]">กำลังพัฒนา (เฟส 03)</p>
    </div>
  );
}
