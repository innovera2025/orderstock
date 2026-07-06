---
name: note:print-pdf-fallback
description: "Backlog (deferred) — server-side Playwright/Puppeteer page.pdf() route for /print, deferred from Phase 05 with rationale (no confirmed escalation trigger)"
date: 06-07-26
metadata:
  node_type: memory
  type: note
  feature: order-system
  phase: phase-05
---

# Backlog — Server-side PDF fallback for /print (DEFERRED from Phase 05)

## What is deferred

A server-side PDF route `GET /api/print/daily/[date].pdf` (and a per-shop equivalent) that opens
the EXISTING `/print/**` route in warm headless Chromium and returns
`page.pdf({ preferCSSPageSize: true, printBackground: true })` after `document.fonts.ready`.
Requires adding `playwright` (or `puppeteer`) to `serverExternalPackages` in `next.config.ts`.

## Why deferred (Phase 05 decision 6)

The PRIMARY path is browser print (`@page { size: A4 landscape }` + `@media print`), which is
already implemented and sufficient for Phase 1. The server-side PDF route adds a ~0.5GB Chromium
binary + 200–400MB peak RAM per render and ops burden on the customer's Windows box. No escalation
trigger is currently confirmed. Phase 05 proves the Chromium PDF PIPELINE works via a TEST-SIDE
`page.pdf()` gate inside e2e (no server route shipped).

## Escalation triggers (adopt the fallback when ANY becomes true)

- Pilot users mangle printouts via print-dialog settings (scale ≠ 100%, wrong margins).
- The customer wants emailed / archived PDF copies of daily sheets.
- Any customer PC turns out to use a non-Chromium browser.

## Implementation sketch (when triggered)

1. `pnpm add playwright` + `npx playwright install chromium` on the server.
2. `next.config.ts`: `serverExternalPackages: ["playwright"]`.
3. Route handler: keep ONE warm browser; `page.goto(printUrl)` → `await page.evaluate(() => document.fonts.ready)` → `page.pdf({ preferCSSPageSize: true, printBackground: true })`.
4. Reuse the SAME `/print/**` HTML/CSS — output is pixel-identical to browser print.
