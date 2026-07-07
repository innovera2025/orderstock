import * as React from "react";

// pguard Button primitive (Phase 01, presentational, token-driven).
// Variants: primary (green --brand-int, active press), secondary (white +1.5px border),
// danger-ghost (red text, subtle red hover). Green focus ring via --focus-ring.
type Variant = "primary" | "secondary" | "danger-ghost";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--r-md)] font-medium " +
  "transition-[background,box-shadow,transform,color,border-color] duration-100 ease-out " +
  "outline-none focus-visible:shadow-[0_0_0_4px_var(--focus-ring)] " +
  "disabled:opacity-50 disabled:pointer-events-none active:translate-y-px";

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[var(--t-sm)]",
  md: "h-10 px-4 text-[var(--t-base)]",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--brand-int)] text-[var(--text-on-brand)] hover:bg-[var(--brand-int-hover)]",
  secondary:
    "bg-[var(--bg-surface)] text-[var(--text)] border-[1.5px] border-[var(--border-strong)] hover:bg-[var(--bg-sunken)]",
  "danger-ghost":
    "bg-transparent text-[var(--danger)] hover:bg-[var(--danger-bg)]",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", className = "", type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
        {...props}
      />
    );
  },
);
