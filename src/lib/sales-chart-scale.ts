// erp-dashboards Phase 2 — pure bar-geometry maths for the period column charts.
//
// WHY THIS FILE EXISTS (regression gate): the first cut of `sales-chart.tsx` sized each bar with a
// CSS percentage height (`height: ${pct}%`) on a span whose nearest block ancestor was a flex item
// with an AUTO height (the row used `items-end`, so items were shrink-to-fit). A percentage height
// against an indeterminate parent height computes to `auto`, so every bar collapsed to its 2px
// `min-height` floor — the data was right and the chart was flat. Percentages are only safe under a
// definite-height ancestor, so the geometry now resolves to PIXELS here, in a pure, unit-tested
// helper, instead of being inline CSS arithmetic no test could see.

/** Plot height in px, shared by the count chart and the money chart. */
export const PLOT_HEIGHT = 168;

/**
 * "Nice" axis ticks from 0 up to a rounded top >= max (1/2/5 x 10^n steps).
 * `integer` keeps document counts on whole-number steps.
 */
export function niceTicks(max: number, count = 4, integer = false): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0];
  const rough = max / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  const stepRaw = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const step = integer ? Math.max(1, Math.round(stepRaw)) : stepRaw;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let i = 0; i * step <= top + step * 1e-9; i += 1) {
    ticks.push(Number((i * step).toPrecision(12)));
  }
  return ticks;
}

/**
 * Bar height in px, proportional to `top` (the axis maximum).
 * `top` -> full plot height, `top/2` -> half, 0 -> 0. Never negative, never overflows the plot.
 */
export function barHeightPx(value: number, top: number, plotHeight = PLOT_HEIGHT): number {
  if (!Number.isFinite(value) || !Number.isFinite(top) || top <= 0 || value <= 0) return 0;
  return Math.round(Math.min(value / top, 1) * plotHeight);
}

export interface BarScale {
  /** Axis maximum (>= series max), 0 when the series is empty/all-zero. */
  top: number;
  /** Ascending tick values from 0 to `top`. */
  ticks: number[];
  /** Bar height in px per input value, index-aligned with `values`. */
  heights: number[];
}

/** One-shot geometry for a whole series. */
export function computeBarScale(
  values: readonly number[],
  { plotHeight = PLOT_HEIGHT, integer = false }: { plotHeight?: number; integer?: boolean } = {},
): BarScale {
  const max = values.length > 0 ? Math.max(...values, 0) : 0;
  const ticks = niceTicks(max, 4, integer);
  const top = ticks[ticks.length - 1] ?? 0;
  return { top, ticks, heights: values.map((v) => barHeightPx(v, top, plotHeight)) };
}

/** Width in px of the y-axis gutter, sized to the widest rendered tick label. */
export function yAxisWidth(tickLabels: readonly string[], min = 44): number {
  const longest = tickLabels.reduce((a, s) => Math.max(a, s.length), 0);
  return Math.max(min, 12 + longest * 7);
}
