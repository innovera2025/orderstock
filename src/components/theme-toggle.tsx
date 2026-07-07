"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";

// pguard dark-mode toggle (Phase 01, C3). Flips data-theme on <html>, persists to
// localStorage (read pre-paint by the no-flash script in the root layout). The current theme
// is EXTERNAL mutable state (a DOM attribute set by that script), so it is read via
// useSyncExternalStore — this hydrates without a mismatch and needs no setState-in-effect.
type Theme = "light" | "dark";

const THEME_EVENT = "pguard-theme-change";

function getSnapshot(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(THEME_EVENT, callback);
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  mq?.addEventListener("change", callback);
  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    mq?.removeEventListener("change", callback);
  };
}

export function ThemeToggle() {
  const theme = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignore persistence failure */
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] text-[var(--text-muted)] transition-colors duration-100 hover:bg-[var(--bg-sunken)] hover:text-[var(--text)] outline-none focus-visible:shadow-[0_0_0_4px_var(--focus-ring)]"
    >
      {isDark ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
    </button>
  );
}
