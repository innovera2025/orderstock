import { PRODUCT_GROUP_LABELS, type ProductGroup } from "@/lib/product-order";

// Reusable, LOGIC-FREE two-/three-tier order-sheet header (Phase 04 decision 6; Phase 05 decision 4).
// Renders the paper form's grouped column header: a top tier grouping columns by product group
// (สินค้า / เครื่องปรุง), a middle tier of individual variant names, an OPTIONAL bottom tier of
// per-column sub-labels (pack size / flavor), plus the sticky ลำดับ / ร้านค้า lead columns and the
// trailing หมายเหตุ column. **Phase 05 print imports this — do not duplicate.**
//
// Phase-05 additive extension (E2): the optional `subLabel` (3rd tier) and per-column `className`
// props DEFAULT OFF, so the Phase-04 two-tier orders grid renders byte-identically. This component
// stays print-agnostic: the print ROUTE owns the mm `<colgroup>` and all print CSS.

export interface SheetHeaderColumn {
  printOrder: number;
  name: string;
  /** "GOODS" | "SEASONING" — drives the top-tier grouping label. */
  group: string;
  /** OPTIONAL 3rd-tier sub-label (pack size / flavor). When ANY column supplies one, tier 3 renders. */
  subLabel?: string;
  /** OPTIONAL per-column class (e.g. the heavy สินค้า/เครื่องปรุง seam). Inherited by the group cell. */
  className?: string;
}

interface SheetHeaderProps {
  columns: SheetHeaderColumn[];
  /** Extra class for the sticky lead <th>s (lets the editor add sticky positioning). */
  leadClassName?: string;
  /** How many physical columns the trailing หมายเหตุ header spans (print splits text + qty strip). */
  trailingColSpan?: number;
}

/** Contiguous run of columns sharing a group, for the top-tier grouped header cells. */
function groupRuns(
  columns: SheetHeaderColumn[],
): { group: string; span: number; className?: string }[] {
  const runs: { group: string; span: number; className?: string }[] = [];
  for (const col of columns) {
    const last = runs[runs.length - 1];
    if (last && last.group === col.group) {
      last.span += 1;
    } else {
      // The run inherits the className of its FIRST column, so the เครื่องปรุง seam continues
      // up into the group tier (its first column carries the heavy-left-border class).
      runs.push({ group: col.group, span: 1, className: col.className });
    }
  }
  return runs;
}

function groupLabel(group: string): string {
  return group in PRODUCT_GROUP_LABELS ? PRODUCT_GROUP_LABELS[group as ProductGroup] : group;
}

export function SheetHeader({
  columns,
  leadClassName = "",
  trailingColSpan = 1,
}: SheetHeaderProps) {
  const runs = groupRuns(columns);
  const hasSubLabels = columns.some((c) => c.subLabel != null);
  const tierCount = hasSubLabels ? 3 : 2;

  return (
    <thead>
      <tr className="bg-zinc-100 text-center text-xs">
        <th rowSpan={tierCount} className={`border px-2 py-1 ${leadClassName}`}>
          ลำดับ
        </th>
        <th rowSpan={tierCount} className={`border px-2 py-1 ${leadClassName}`}>
          ร้านค้า
        </th>
        {runs.map((run, i) => (
          <th key={`grp-${i}`} colSpan={run.span} className={`border px-2 py-1 ${run.className ?? ""}`}>
            {groupLabel(run.group)}
          </th>
        ))}
        <th rowSpan={tierCount} colSpan={trailingColSpan} className="border px-2 py-1">
          หมายเหตุ
        </th>
      </tr>
      <tr className="bg-zinc-50 text-center text-[11px]">
        {columns.map((col) => (
          <th
            key={col.printOrder}
            className={`border px-1 py-1 align-bottom whitespace-nowrap ${col.className ?? ""}`}
          >
            {col.name}
          </th>
        ))}
      </tr>
      {hasSubLabels && (
        <tr className="bg-zinc-50 text-center text-[10px]">
          {columns.map((col) => (
            <th key={col.printOrder} className={`border px-1 py-0.5 ${col.className ?? ""}`}>
              {col.subLabel}
            </th>
          ))}
        </tr>
      )}
    </thead>
  );
}
