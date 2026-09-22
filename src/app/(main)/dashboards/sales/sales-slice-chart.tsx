import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatInt } from "@/lib/sales-basis-core";

// erp-dashboards Phase 2 — the shared SVG slice-chart renderer behind the status DONUT and the
// category PIE. Hand-rolled (Defaults Taken #5): pure SVG path arithmetic, no charting dependency,
// server-rendered, and identical in light and dark mode because every colour is a pguard token.
//
// `pie: true` draws a full pie (category share, per the approved mockup); `pie: false` draws a
// donut with the total in its centre (delivery-status share, per the same mockup).
//
// CROSS-FILTER SEMANTICS (plan § Scope): the caller passes slices computed with this chart's OWN
// dimension EXCLUDED from the filter set. The chart therefore keeps showing every slice even while
// one of them is selected, so a user can always click a different one instead of the chart
// collapsing to 100% of the current selection. Every OTHER panel on the page IS filtered by it.

export interface ChartSlice {
  key: string;
  label: string;
  value: number;
  color: string;
  href: string;
  selected: boolean;
}

const RADIUS = 60;
const CENTER = 70;
const INNER_RADIUS = 36;

function polar(angle: number, radius: number): [number, number] {
  const rad = ((angle - 90) * Math.PI) / 180;
  return [CENTER + radius * Math.cos(rad), CENTER + radius * Math.sin(rad)];
}

/** Arc path for one slice. A single 100% slice is drawn as a full circle (arcs cannot close 360°). */
function slicePath(startAngle: number, endAngle: number, pie: boolean): string {
  const large = endAngle - startAngle > 180 ? 1 : 0;
  const [ox1, oy1] = polar(startAngle, RADIUS);
  const [ox2, oy2] = polar(endAngle, RADIUS);

  if (pie) {
    return `M ${CENTER} ${CENTER} L ${ox1} ${oy1} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${ox2} ${oy2} Z`;
  }
  const [ix2, iy2] = polar(endAngle, INNER_RADIUS);
  const [ix1, iy1] = polar(startAngle, INNER_RADIUS);
  return (
    `M ${ox1} ${oy1} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${ox2} ${oy2} ` +
    `L ${ix2} ${iy2} A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${large} 0 ${ix1} ${iy1} Z`
  );
}

export function SalesSliceChart({
  title,
  subtitle,
  unit,
  centerSub,
  slices,
  pie = false,
  testId,
  emptyText,
}: {
  title: string;
  subtitle: string;
  unit: string;
  centerSub: string;
  slices: readonly ChartSlice[];
  pie?: boolean;
  testId: string;
  emptyText: string;
}) {
  const present = slices.filter((s) => s.value > 0);
  const total = present.reduce((a, s) => a + s.value, 0);

  // Cumulative start angle per slice, derived rather than accumulated in a mutable local (the
  // repo's lint rules forbid reassigning a variable during render).
  const arcs = present.map((slice, i) => {
    const before = present.slice(0, i).reduce((a, s) => a + s.value, 0);
    const start = total > 0 ? (before / total) * 360 : 0;
    const sweep = total > 0 ? (slice.value / total) * 360 : 0;
    // Clamp just short of a full turn so a single 100% slice still renders as a path, not a
    // zero-length arc.
    const end = Math.min(start + sweep, 359.999);
    return { slice, d: slicePath(start, end, pie) };
  });

  return (
    <Card className="flex flex-col p-4" data-testid={testId}>
      <h2 className="th text-[var(--t-base)] font-semibold text-[var(--text-strong)]">{title}</h2>
      <p className="th mb-3 text-[var(--t-xs)] text-[var(--text-muted)]">{subtitle}</p>

      {present.length === 0 ? (
        <p className="th py-8 text-center text-[var(--t-sm)] text-[var(--text-faint)]">
          {emptyText}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <svg
            viewBox="0 0 140 140"
            width={140}
            height={140}
            role="img"
            aria-label={`${title}: รวม ${formatInt(total)} ${unit}`}
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
            {!pie && (
              <>
                <text
                  x={CENTER}
                  y={CENTER - 2}
                  textAnchor="middle"
                  className="fill-[var(--text-strong)]"
                  style={{ fontSize: "20px", fontWeight: 600 }}
                >
                  {formatInt(total)}
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
              </>
            )}
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
                    {formatInt(slice.value)} {unit}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
