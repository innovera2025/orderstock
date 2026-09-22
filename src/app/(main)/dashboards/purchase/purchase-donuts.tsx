import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import {
  PO_STATUSES,
  PO_STATUS_UNVALIDATED_TEXT,
  formatInt,
  formatMoney,
  poStatusLabel,
} from "@/lib/purchase-calc";
import { purchaseHref, type RawSearchParams } from "./purchase-url";

// erp-dashboards Phase 3 — the two donuts: supplier share and PO-status share.
//
// Hand-rolled SVG arc arithmetic, no charting dependency, server-rendered, and identical in light
// and dark mode because every colour is a pguard token.
//
// CROSS-FILTER SEMANTICS: each donut is fed slices computed with its OWN dimension excluded from
// the filter set, so it keeps showing every slice even while one is selected — the user can always
// click a different one instead of the chart collapsing to 100% of the current selection. Every
// OTHER panel on the page IS filtered by the selection. Clicking the selected slice clears it.
//
// STATUS DONUT COUNTS CANCELLED POs on purpose (a cancelled order is a real thing that happened),
// while the money KPIs and the supplier chart exclude them — the centre caption says so out loud.

const RADIUS = 60;
const CENTER = 70;
const INNER_RADIUS = 36;

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
  href: string;
  selected: boolean;
}

function polar(angle: number, radius: number): [number, number] {
  const rad = ((angle - 90) * Math.PI) / 180;
  return [CENTER + radius * Math.cos(rad), CENTER + radius * Math.sin(rad)];
}

/** Donut arc path for one slice. A single 100% slice clamps just short of 360° so it still draws. */
function slicePath(startAngle: number, endAngle: number): string {
  const large = endAngle - startAngle > 180 ? 1 : 0;
  const [ox1, oy1] = polar(startAngle, RADIUS);
  const [ox2, oy2] = polar(endAngle, RADIUS);
  const [ix2, iy2] = polar(endAngle, INNER_RADIUS);
  const [ix1, iy1] = polar(startAngle, INNER_RADIUS);
  return (
    `M ${ox1} ${oy1} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${ox2} ${oy2} ` +
    `L ${ix2} ${iy2} A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${large} 0 ${ix1} ${iy1} Z`
  );
}

function Donut({
  title,
  subtitle,
  unit,
  centerSub,
  slices,
  testId,
  emptyText,
  formatValue,
  headExtra,
  footNote,
}: {
  title: string;
  subtitle: string;
  unit: string;
  centerSub: string;
  slices: readonly DonutSlice[];
  testId: string;
  emptyText: string;
  formatValue: (n: number) => string;
  headExtra?: React.ReactNode;
  footNote?: React.ReactNode;
}) {
  const present = slices.filter((s) => s.value > 0);
  const total = present.reduce((a, s) => a + s.value, 0);

  // Cumulative start angle derived per slice rather than accumulated in a mutable local (the
  // repo's lint rules forbid reassigning a variable during render).
  const arcs = present.map((slice, i) => {
    const before = present.slice(0, i).reduce((a, s) => a + s.value, 0);
    const start = total > 0 ? (before / total) * 360 : 0;
    const sweep = total > 0 ? (slice.value / total) * 360 : 0;
    return { slice, d: slicePath(start, Math.min(start + sweep, 359.999)) };
  });

  return (
    <Card className="flex flex-col p-4" data-testid={testId}>
      <h2 className="th text-[var(--t-base)] font-semibold text-[var(--text-strong)]">{title}</h2>
      <p className="th mb-1 text-[var(--t-xs)] text-[var(--text-muted)]">{subtitle}</p>
      {headExtra}

      {present.length === 0 ? (
        <p className="th py-8 text-center text-[var(--t-sm)] text-[var(--text-faint)]">
          {emptyText}
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <svg
            viewBox="0 0 140 140"
            width={140}
            height={140}
            role="img"
            aria-label={`${title}: รวม ${formatValue(total)}`}
            className="shrink-0"
          >
            {arcs.map(({ slice, d }) => (
              <path
                key={slice.key}
                d={d}
                fill={slice.color}
                stroke="var(--bg-surface)"
                strokeWidth={slice.selected ? 3 : 1.5}
                opacity={slice.selected ? 1 : 0.88}
                data-testid={`${testId}-slice-${slice.key}`}
              />
            ))}
            <text
              x={CENTER}
              y={CENTER - 2}
              textAnchor="middle"
              className="fill-[var(--text-strong)]"
              style={{ fontSize: "18px", fontWeight: 600 }}
            >
              {formatInt(unit === "บาท" ? Math.round(total) : total)}
            </text>
            <text
              x={CENTER}
              y={CENTER + 14}
              textAnchor="middle"
              className="fill-[var(--text-muted)]"
              style={{ fontSize: "9px" }}
            >
              {centerSub}
            </text>
          </svg>

          <ul className="flex min-w-[10rem] flex-1 flex-col gap-1">
            {present.map((slice) => (
              <li key={slice.key}>
                <Link
                  href={slice.href}
                  data-testid={`${testId}-legend-${slice.key}`}
                  aria-pressed={slice.selected}
                  className={
                    "flex items-center gap-2 rounded-[var(--r-sm)] px-1.5 py-1 text-[var(--t-xs)] hover:bg-[var(--bg-sunken)] " +
                    (slice.selected ? "bg-[var(--bg-sunken)] font-semibold" : "")
                  }
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="th flex-1 truncate text-[var(--text)]">{slice.label}</span>
                  <span className="tabular-nums text-[var(--text-muted)]">
                    {formatValue(slice.value)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {footNote}
    </Card>
  );
}

/** Fixed slice colours, assigned by rank so a supplier keeps its colour across filter states. */
const SUPPLIER_COLORS = [
  "var(--accent)",
  "var(--brand-int)",
  "var(--success)",
  "var(--warning)",
] as const;
const OTHER_COLOR = "var(--text-faint)";

export interface SupplierDonutRow {
  supplierCode: string;
  invoiceAmount: number;
  poCount: number;
}

/**
 * "สัดส่วนยอดซื้อตามผู้ขาย" for Admin (baht, invoice basis) / "สัดส่วนใบสั่งซื้อตามผู้ขาย" for Staff
 * (PO count). Staff gets the count version rather than an empty chart — AC9 forbids the money, not
 * the picture.
 *
 * Never more than 5 slices: the top 4 suppliers by value keep their own colour and the rest fold
 * into "อื่นๆ", so the donut stays readable however many suppliers the ERP grows.
 */
export function PurchaseSupplierDonut({
  rows,
  selected,
  searchParams,
  canSeeMoney,
}: {
  rows: readonly SupplierDonutRow[];
  selected: string | null;
  searchParams: RawSearchParams;
  canSeeMoney: boolean;
}) {
  const valueOf = (row: SupplierDonutRow) => (canSeeMoney ? row.invoiceAmount : row.poCount);
  const ranked = [...rows].sort(
    (a, b) => valueOf(b) - valueOf(a) || a.supplierCode.localeCompare(b.supplierCode, "th"),
  );
  const head = ranked.slice(0, SUPPLIER_COLORS.length);
  const rest = ranked.slice(SUPPLIER_COLORS.length);

  const slices: DonutSlice[] = head.map((row, i) => ({
    key: row.supplierCode,
    label: row.supplierCode,
    value: valueOf(row),
    color: SUPPLIER_COLORS[i],
    href: purchaseHref(searchParams, {
      supplier: selected === row.supplierCode ? null : row.supplierCode,
      page: null,
    }),
    selected: selected === row.supplierCode,
  }));

  if (rest.length > 0) {
    slices.push({
      key: "other",
      label: "อื่นๆ",
      value: rest.reduce((a, r) => a + valueOf(r), 0),
      color: OTHER_COLOR,
      href: purchaseHref(searchParams, { page: null }),
      selected: false,
    });
  }

  return (
    <Donut
      title={canSeeMoney ? "สัดส่วนยอดซื้อตามผู้ขาย" : "สัดส่วนใบสั่งซื้อตามผู้ขาย"}
      subtitle={
        canSeeMoney
          ? "ยอดซื้อตามใบแจ้งหนี้ (บาท) · เฉพาะผู้ดูแลระบบ · คลิกเพื่อกรองตามผู้ขาย"
          : "นับจำนวนใบสั่งซื้อที่ไม่ถูกยกเลิก · คลิกเพื่อกรองตามผู้ขาย"
      }
      unit={canSeeMoney ? "บาท" : "ใบ"}
      centerSub={canSeeMoney ? "บาท · ตามใบแจ้งหนี้" : "ใบสั่งซื้อ"}
      slices={slices}
      testId="purchase-supplier-donut"
      emptyText={canSeeMoney ? "ไม่มีใบแจ้งหนี้ในช่วงที่เลือก" : "ไม่มีใบสั่งซื้อในช่วงที่เลือก"}
      formatValue={(n) => (canSeeMoney ? formatMoney(n) : `${formatInt(n)} ใบ`)}
      footNote={
        canSeeMoney ? undefined : (
          <p className="th mt-3 text-[11px] text-[var(--text-faint)]">
            สัดส่วนยอดซื้อ (บาท) แสดงเฉพาะผู้ดูแลระบบ — พนักงานเห็นเป็นจำนวนใบสั่งซื้อแทน
          </p>
        )
      }
    />
  );
}

const STATUS_TONE_COLORS: Record<string, string> = {
  neutral: "var(--text-faint)",
  accent: "var(--accent)",
  brand: "var(--brand-int)",
  success: "var(--success)",
  danger: "var(--danger)",
};

/**
 * "สัดส่วนสถานะใบสั่งซื้อ" — every PO in range INCLUDING cancelled ones. Carries the unvalidated
 * caveat in its header, because every status in it comes from the same LOW-confidence derived rule.
 */
export function PurchaseStatusDonut({
  counts,
  selected,
  searchParams,
}: {
  counts: ReadonlyMap<string, number>;
  selected: string | null;
  searchParams: RawSearchParams;
}) {
  const slices: DonutSlice[] = PO_STATUSES.map((status) => ({
    key: status.key,
    label: poStatusLabel(status.key),
    value: counts.get(status.key) ?? 0,
    color: STATUS_TONE_COLORS[status.tone] ?? "var(--text-faint)",
    href: purchaseHref(searchParams, {
      status: selected === status.key ? null : status.key,
      page: null,
    }),
    selected: selected === status.key,
  }));

  return (
    <Donut
      title="สัดส่วนสถานะใบสั่งซื้อ"
      subtitle="นับจำนวนใบสั่งซื้อทุกใบ รวมใบที่ยกเลิก · คลิกเพื่อกรองตาราง"
      unit="ใบ"
      centerSub="ใบสั่งซื้อ (รวมที่ยกเลิก)"
      slices={slices}
      testId="purchase-status-donut"
      emptyText="ไม่มีใบสั่งซื้อในช่วงที่เลือก"
      formatValue={(n) => `${formatInt(n)} ใบ`}
      headExtra={
        <p className="mt-2 flex flex-wrap items-center gap-1.5">
          <Chip tone="warning" className="th">
            {PO_STATUS_UNVALIDATED_TEXT}
          </Chip>
          <span className="th text-[11px] text-[var(--text-faint)]">
            สถานะทุกใบคำนวณจากข้อมูล ERP และยังไม่ได้ยืนยันกับผู้ใช้งานจริง
          </span>
        </p>
      }
    />
  );
}
