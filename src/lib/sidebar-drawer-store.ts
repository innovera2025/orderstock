"use client";

import * as React from "react";

// Responsive sidebar drawer store (responsive-drawer-sidebar plan). Mirrors theme-toggle.tsx's
// external-mutable-state pattern (CustomEvent + matchMedia dual-subscribe, useSyncExternalStore) so
// two client siblings (Topbar hamburger + SidebarShell drawer) share one state without React
// Context.
//
// Tri-state `open`:
//  - null  = auto: defer to the pure-CSS responsive default (closed <lg, open >=lg). Zero
//            SSR/hydration risk — server and client render byte-identical class attributes for null.
//  - true  = forced open at ALL breakpoints.
//  - false = forced closed at ALL breakpoints (incl. lg+ — this is what makes the desktop collapse
//            real).
type DrawerState = boolean | null;

const SIDEBAR_EVENT = "pguard-sidebar-change";
const DESKTOP_QUERY = "(min-width: 1024px)";

let open: DrawerState = null;

function emit() {
  window.dispatchEvent(new Event(SIDEBAR_EVENT));
}

/** True when the viewport is currently at the desktop tier (>=1024px). */
function isDesktop(): boolean {
  return window.matchMedia?.(DESKTOP_QUERY).matches ?? false;
}

export function openDrawer() {
  open = true;
  emit();
}

export function closeDrawer() {
  // Always set an explicit false (never back to null) so an Escape/route/backdrop close at tablet
  // does not silently reopen the sidebar if the viewport is later resized past 1024px this session.
  if (open !== false) {
    open = false;
    emit();
  }
}

export function toggleDrawer() {
  // In the null (auto) case, "currently visible" differs by breakpoint, so resolve it via matchMedia
  // and set the explicit opposite. Once explicit, later toggles are a plain boolean flip.
  const currentlyVisible = open === null ? isDesktop() : open;
  open = !currentlyVisible;
  emit();
}

function getSnapshot(): DrawerState {
  return open;
}

function getServerSnapshot(): DrawerState {
  return null;
}

function subscribeStore(callback: () => void): () => void {
  window.addEventListener(SIDEBAR_EVENT, callback);
  return () => window.removeEventListener(SIDEBAR_EVENT, callback);
}

function subscribeStoreAndMedia(callback: () => void): () => void {
  window.addEventListener(SIDEBAR_EVENT, callback);
  const mq = window.matchMedia?.(DESKTOP_QUERY);
  mq?.addEventListener("change", callback);
  return () => {
    window.removeEventListener(SIDEBAR_EVENT, callback);
    mq?.removeEventListener("change", callback);
  };
}

/** Raw tri-state hook (boolean | null). */
export function useDrawerOpen(): DrawerState {
  return React.useSyncExternalStore(subscribeStore, getSnapshot, getServerSnapshot);
}

/**
 * Resolved-visible boolean hook — "is the sidebar ACTUALLY visible right now". Subscribes to BOTH
 * the store event AND the desktop media query (mirrors theme-toggle.tsx's two-source subscribe) so
 * it recomputes on toggle AND on viewport crossing the lg boundary. Used for aria-expanded and any
 * JS branch that needs true visibility rather than the raw tri-state.
 */
export function useDrawerVisible(): boolean {
  return React.useSyncExternalStore(
    subscribeStoreAndMedia,
    () => (open === null ? isDesktop() : open),
    () => false,
  );
}
