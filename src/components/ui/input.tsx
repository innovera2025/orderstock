import * as React from "react";

// pguard Input primitive (Phase 01). 1px border, green focus ring (0 0 0 4px --focus-ring).
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        className={
          "h-10 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-surface)] " +
          "px-3 text-[var(--t-base)] text-[var(--text)] placeholder:text-[var(--text-faint)] " +
          "outline-none transition-[box-shadow,border-color] duration-100 ease-out " +
          "focus-visible:border-[var(--brand-int)] focus-visible:shadow-[0_0_0_4px_var(--focus-ring)] " +
          "disabled:opacity-50 " +
          className
        }
        {...props}
      />
    );
  },
);
