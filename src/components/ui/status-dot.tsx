import * as React from "react";

// pguard StatusDot primitive (Phase 01). The platform's signature live-status signal:
// active (green) / working (amber) / offline (red), each with a soft ring halo.
type Status = "active" | "working" | "offline";

const colors: Record<Status, { dot: string; ring: string }> = {
  active: { dot: "var(--status-active)", ring: "var(--status-active-ring)" },
  working: { dot: "var(--status-working)", ring: "var(--status-working-ring)" },
  offline: { dot: "var(--status-offline)", ring: "var(--status-offline-ring)" },
};

export interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: Status;
  size?: number;
}

export function StatusDot({ status, size = 10, className = "", style, ...props }: StatusDotProps) {
  const c = colors[status];
  return (
    <span
      className={"inline-block rounded-full " + className}
      style={{
        width: size,
        height: size,
        background: c.dot,
        boxShadow: `0 0 0 4px ${c.ring}`,
        ...style,
      }}
      {...props}
    />
  );
}
