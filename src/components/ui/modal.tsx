"use client";

import * as React from "react";

// pguard Modal primitive (Phase 01). Scrim rgba(8,20,15,.5) + backdrop-blur 3px, panel
// fade+scale .96→1 over 200ms, click-scrim-closes. Escape also closes.
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
}

export function Modal({ open, onClose, children, className = "", labelledBy }: ModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onMouseDown={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(8,20,15,.5)", backdropFilter: "blur(3px)" }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={
          "pguard-modal-panel w-full max-w-lg rounded-[var(--r-lg)] border border-[var(--border)] " +
          "bg-[var(--bg-raised)] p-6 shadow-[var(--sh-lg)] " +
          className
        }
        style={{ animation: "pguard-modal-in 200ms ease-out" }}
      >
        {children}
      </div>
      <style>{`@keyframes pguard-modal-in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}
