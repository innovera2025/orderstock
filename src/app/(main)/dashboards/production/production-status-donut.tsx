import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { MO_STATUSES, formatInt, moStatusLabel } from "@/lib/production-status";
import { productionHref, type RawSearchParams } from "./production-url";

// erp-dashboards Phase 4 — "สัดส่วนสถานะใบสั่งผลิต": a COUNT donut with the total in its centre.
//
// Hand-rolled SVG arc arithmetic — no charting dependency, server-rendered, and identical in light
// and dark mode because every colour is a pguard token. Deliberately self-contained rather than
// importing Phase 2's `sales-slice-chart.tsx`: that file is Phase 2's owned blast radius.
//
// SMALL-SAMPLE NOTE (required): production volume in the real ERP is tiny (3 MOs in the pilot
// data) and two of the four derivable statuses have never been seen in real data. The footnote
// under the donut states the sample size so no one reads the proportions as a stable trend.
//
// CROSS-FILTER: `rows` comes from a query run with `skipStatus: true`, so the donut always shows
// the FULL status distribution and a user can always click a different slice.

const RADIUS = 60;
const CENTER = 70;
const INNER_RADIUS = 36;

const TONE_COLORS: Record<string, string> = {
  neutral: "var(--text-faint)",
  brand: "var(--brand-int)",
  success: "var(--success)",
  danger: "var(--danger)",
};

function polar(angle: number, radius: number): [number, number] {
  const rad = ((angle - 90) * Math.PI) / 180;
  return [CENTER + radius * Math.cos(rad), CENTER + radius * Math.sin(rad)];
}

/** Donut arc path. A single 100% slice is drawn as two half-arcs (a 360° arc cannot close). */
function arcPath(startAngle: number, endAngle: number): string {
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

export function ProductionStatusDonut({
  rows,
  selected,
  searchParams,
}: {
  rows: ReadonlyArray<{ StatusKey: string }>;
  selected: string | null;
  searchParams: RawSearchParams;
}) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.StatusKey, (counts.get(row.StatusKey) ?? 0) + 1);

  const known = MO_STATUSES.map((s) => s.key as string);
  const unknown = [...counts.keys()].filter((k) => !known.includes(k)).sort();

  const slices = [...known, ...unknown].map((key) => ({
    key,
    label: moStatusLabel(key),
    value: counts.get(key) ?? 0,
    color: TONE_COLORS[MO_STATUSES.find((s) => s.key === key)?.tone ?? "neutral"],
    // Clicking the selected slice clears the filter — a toggle, not a one-way trip.
    href: productionHref(searchParams, { status: selected === key ? null : key, page: null }),
    selected: selected === key,
  }));

  const present = slices.filter((s) => s.value > 0);
  const total = present.reduce((a, s) => a + s.value, 0);
  const arcs = present.map((slice, i) => {
    const before = present.slice(0, i).reduce((a, s) => a + s.value, 0);
    return {
      ...slice,
      start: total > 0 ? (before / total) * 360 : 0,
      sweep: total > 0 ? (slice.value / total) * 360 : 0,
    };
  });

  return (
    <Card className="flex flex-col gap-3 p-4" data-testid="production-status-donut">
      <header className="flex flex-col gap-0.5">
        <h2 className="th text-[var(--t-base)] font-semibold text-[var(--text-strong)]">
          สัดส่วนสถานะใบสั่งผลิต
        </h2>
        <p className="th text-[11px] text-[var(--text-faint)]">
          นับจำนวนใบสั่งผลิตตามสถานะ · คลิกเพื่อกรองตาราง
        </p>
      </header>

      {total === 0 ? (
        <p className="th py-6 text-center text-[var(--t-sm)] text-[var(--text-muted)]">
          ไม่มีใบสั่งผลิตในช่วงที่เลือก
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <svg
            viewBox="0 0 140 140"
            width={140}
            height={140}
            role="img"
            aria-label={`สัดส่วนสถานะใบสั่งผลิต รวม ${formatInt(total)} ใบ`}
            className="shrink-0"
          >
            {arcs.map((arc) => (
              <path
                key={arc.key}
                data-testid={`production-status-slice-${arc.key}`}
                data-value={arc.value}
                d={
                  arc.sweep >= 359.999
                    ? arcPath(0, 180) + " " + arcPath(180, 359.999)
                    : arcPath(arc.start, arc.start + arc.sweep)
                }
                fill={arc.color}
                opacity={arc.selected || selected == null ? 1 : 0.45}
              />
            ))}
            <text
              x={CENTER}
              y={CENTER - 2}
              textAnchor="middle"
              className="fill-[var(--text-strong)] text-[18px] font-semibold"
            >
              {formatInt(total)}
            </text>
            <text
              x={CENTER}
              y={CENTER + 14}
              textAnchor="middle"
              className="fill-[var(--text-muted)] text-[10px]"
            >
              ใบสั่งผลิต
            </text>
          </svg>

          <ul className="flex min-w-[160px] flex-1 flex-col gap-1">
            {slices.map((slice) => (
              <li key={slice.key}>
                <Link
                  href={slice.href}
                  data-testid={`production-status-legend-${slice.key}`}
                  aria-pressed={slice.selected}
                  className={
                    "flex items-center gap-2 rounded-[var(--r-sm)] px-1.5 py-1 text-[var(--t-xs)] hover:bg-[var(--bg-sunken)] " +
                    (slice.selected ? "bg-[var(--bg-sunken)] font-semibold" : "")
                  }
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="th flex-1 text-[var(--text)]">{slice.label}</span>
                  <span className="tabular-nums text-[var(--text-muted)]">
                    {formatInt(slice.value)} ใบ
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="th text-[11px] text-[var(--text-faint)]" data-testid="production-small-sample-note">
        ตัวอย่างข้อมูลยังน้อย (n = {formatInt(total)} ใบสั่งผลิต) สัดส่วนนี้จึงยังไม่สะท้อนแนวโน้มจริง
      </p>
    </Card>
  );
}
