import * as React from "react";

// pguard Card primitive (Phase 01). radius --r-lg, 1px border, surface bg, NO shadow
// (structure comes from the hairline border, not glow).
export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      className={
        "rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg-surface)] " +
        className
      }
      {...props}
    />
  );
}
