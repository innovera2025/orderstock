"use client";

import * as React from "react";

// pguard Toast primitive (Phase 01). green-900 bg, bottom-center, auto-dismisses (~2.2s).
// Presentational + self-timing: parent controls `open`; onDone fires after the duration so the
// parent can reset its state.
export interface ToastProps {
  open: boolean;
  message: string;
  onDone?: () => void;
  durationMs?: number;
}

export function Toast({ open, message, onDone, durationMs = 2200 }: ToastProps) {
  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => onDone?.(), durationMs);
    return () => clearTimeout(t);
  }, [open, durationMs, onDone]);

  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-[var(--r-md)] px-4 py-2.5 text-[var(--t-sm)] text-white shadow-[var(--sh-lg)]"
      style={{ background: "var(--green-900)", animation: "pguard-toast-in 160ms ease-out" }}
    >
      {message}
      <style>{`@keyframes pguard-toast-in{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
    </div>
  );
}
