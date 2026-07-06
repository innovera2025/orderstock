import { PRODUCT_GROUP_LABELS, type ProductGroup } from "@/lib/product-order";

// Reusable, LOGIC-FREE two-tier order-sheet header (Phase 04, decision 6). Renders the paper
// form's grouped column header: a top tier grouping columns by product group (สินค้า / เครื่องปรุง)
// and a bottom tier of individual variant names, plus the sticky ลำดับ / ร้านค้า lead columns and
// the trailing หมายเหตุ column. **Phase 05 print imports this — do not duplicate.**

export interface SheetHeaderColumn {
  printOrder: number;
  name: string;
  /** "GOODS" | "SEASONING" — drives the top-tier grouping label. */
  group: string;
}

interface SheetHeaderProps {
  columns: SheetHeaderColumn[];
  /** Extra class for the sticky lead <th>s (lets the editor add sticky positioning). */
  leadClassName?: string;
}

/** Contiguous run of columns sharing a group, for the top-tier grouped header cells. */
function groupRuns(columns: SheetHeaderColumn[]): { group: string; span: number }[] {
  const runs: { group: string; span: number }[] = [];
  for (const col of columns) {
    const last = runs[runs.length - 1];
    if (last && last.group === col.group) {
      last.span += 1;
    } else {
      runs.push({ group: col.group, span: 1 });
    }
  }
  return runs;
}

function groupLabel(group: string): string {
  return group in PRODUCT_GROUP_LABELS ? PRODUCT_GROUP_LABELS[group as ProductGroup] : group;
}

export function SheetHeader({ columns, leadClassName = "" }: SheetHeaderProps) {
  const runs = groupRuns(columns);

  return (
    <thead>
      <tr className="bg-zinc-100 text-center text-xs">
        <th rowSpan={2} className={`border px-2 py-1 ${leadClassName}`}>
          ลำดับ
        </th>
        <th rowSpan={2} className={`border px-2 py-1 ${leadClassName}`}>
          ร้านค้า
        </th>
        {runs.map((run, i) => (
          <th key={`grp-${i}`} colSpan={run.span} className="border px-2 py-1">
            {groupLabel(run.group)}
          </th>
        ))}
        <th rowSpan={2} className="border px-2 py-1">
          หมายเหตุ
        </th>
      </tr>
      <tr className="bg-zinc-50 text-center text-[11px]">
        {columns.map((col) => (
          <th key={col.printOrder} className="border px-1 py-1 align-bottom whitespace-nowrap">
            {col.name}
          </th>
        ))}
      </tr>
    </thead>
  );
}
