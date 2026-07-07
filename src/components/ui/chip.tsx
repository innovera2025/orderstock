import * as React from "react";

// pguard Chip / pill primitive (Phase 01). Rounded-full label; tone controls color.
type Tone = "neutral" | "brand" | "accent" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-[var(--bg-sunken)] text-[var(--text-muted)]",
  brand: "bg-[var(--green-50)] text-[var(--green-800)]",
  accent: "bg-[var(--amber-50)] text-[var(--amber-800)]",
  success: "bg-[var(--success-bg)] text-[var(--success)]",
  warning: "bg-[var(--warning-bg)] text-[var(--warning)]",
  danger: "bg-[var(--danger-bg)] text-[var(--danger)]",
};

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Chip({ tone = "neutral", className = "", ...props }: ChipProps) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-[var(--r-full)] px-2.5 py-0.5 text-[var(--t-xs)] font-medium " +
        tones[tone] +
        " " +
        className
      }
      {...props}
    />
  );
}
