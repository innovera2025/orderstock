"use client";

import * as React from "react";

// pguard Switch primitive (Phase 01). Controlled toggle; 200ms slide; green when on.
export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  className = "",
  ...aria
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={aria["aria-label"]}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-out " +
        "outline-none focus-visible:shadow-[0_0_0_4px_var(--focus-ring)] disabled:opacity-50 " +
        (checked ? "bg-[var(--brand-int)]" : "bg-[var(--border-strong)]") +
        " " +
        className
      }
    >
      <span
        className="inline-block h-5 w-5 rounded-full bg-white shadow-[var(--sh-sm)] transition-transform duration-200 ease-out"
        style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }}
      />
    </button>
  );
}
