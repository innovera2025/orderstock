# Printing a Pixel-Faithful A4-Landscape Thai Form from Next.js — Research Reference (July 2026)

Scope: reproduce a dense paper order form ("ใบออเดอร์สินค้า") — ~30 columns (1 กก. / 1/2 กก. sub-columns, seasonings group), ~29 shop rows, header fields, per-column totals footer, notes column — as (a) a combined daily sheet and (b) per-shop sheets, printed on A4 landscape from a Next.js app used on the customer's Windows PCs.

---

## 1. Browser print with `@page { size: A4 landscape }` + `@media print`

### Reliability in Chrome/Edge (2026)

- `@page` with the `size` descriptor (`size: A4 landscape`) has been supported in Chromium (Chrome, Edge, Opera) for many years and is the de-facto standard path for fixed-format browser printing. As of **December 2024 it is "Baseline — Newly available"**: Firefox (133) and Safari (18.2) finally joined, so all major engines now honor it, though Chromium remains the most battle-tested. Sources: [MDN `@page` size](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@page/size), [CSS-Tricks `@page`](https://css-tricks.com/almanac/rules/p/page/), [Setting page size when printing HTML](https://www.naveenmk.me/blog/setting-page-size-when-printing-html/).
- Edge is Chromium, so Chrome and Edge behave identically for print layout. Declaring `size: A4 landscape` **pre-selects landscape + A4 in the Chromium print dialog**, so users don't have to change orientation manually ([Controlling Chrome's Print Dialogue with CSS](https://excessivelyadequate.com/posts/print.html)).
- Supported values include ISO sizes (A4, A3, A5, B4/B5), `portrait`/`landscape` keywords, and custom `<length>` pairs (e.g. `size: 297mm 210mm`) ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@page/size)).

### Margins

- `@page { margin: 8mm }` (and per-side longhands) works in Chromium and overrides the dialog's "Default" margins. **Named margin-box at-rules** (`@top-center { content: ... }` etc., for running headers/footers) are **NOT supported in any browser** — only in paged-media processors like Prince/WeasyPrint. Design page furniture inside the body instead. Sources: [MDN `@page`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@page), [DiDoesDigital print styles](https://didoesdigital.com/blog/print-styles/), [CSS for printing to paper](https://voussoir.net/writing/css_for_printing).
- Practical constraints:
  - Chrome's own **"Headers and footers"** checkbox (URL/date/title) prints into the margin area; instruct users to untick it once (Chrome remembers it) or keep it — with your own margins it doesn't overlap content. `@page { margin: 0 }` also suppresses it but risks clipping.
  - Real printers have **hardware non-printable margins (~4–6mm)**; `margin: 0` layouts get clipped on physical printers. Use 6–10mm page margins for a paper-form reproduction ([CSS for printing to paper](https://voussoir.net/writing/css_for_printing)).
  - Users can still override scale/margins in the dialog — this is the fundamental limit of browser printing for "pixel-faithful" output (mitigation: one-page instruction sheet, or the PDF fallback in §2).

### Repeating table headers / footers

- Chromium repeats `<thead>` on every printed page **when `thead { display: table-header-group; break-inside: avoid; }` is set** — the Chromium team explicitly agreed to "repeat the header group if it has break-inside:avoid" ([Chromium issue 24826 / 40321210](https://issues.chromium.org/issues/40321210), [dev030 blog on repeating headers in headless-Chrome PDFs](https://blog.dev030.com/posts/repeating-table-headers-pdf-downloads-using-headless-chrome), [Jessica Schillinger](https://jessicaschillinger.com/print-repeating-header-browser/)). Chrome 108+ runs everything on LayoutNG block fragmentation, which fixed most legacy print-fragmentation bugs for tables/flex/grid ([Chrome RenderingNG fragmentation deep-dive](https://developer.chrome.com/docs/chromium/renderingng-fragmentation)).
- Standard print-table recipe ([W3Docs page-break handling](https://www.w3docs.com/snippets/html/how-to-handle-page-breaks-when-printing-a-large-html-table.html)):
  ```css
  @media print {
    thead { display: table-header-group; break-inside: avoid; }
    tr    { break-inside: avoid; }
  }
  ```
- Caution for this form: a repeated `tfoot` (`display: table-footer-group`) prints on **every** page — for a totals row that must appear only once, put totals in the last `<tbody>` row instead of `<tfoot>`.
- Note: this form is designed to fit **one physical page** (29 rows is the paper form's capacity), so header repetition is a safety net, not a core mechanism.

### Fitting ~30 columns into A4-landscape width

- Usable width: 297mm − 2×8mm margins ≈ **281mm → ~9mm average per column** (wider for shop-name + notes, ~7–8mm for numeric sub-columns). This is achievable with `table-layout: fixed`, explicit `mm` column widths (`<colgroup>`), Sarabun at ~7.5–9pt, `border-collapse: collapse`, and rotated (`writing-mode: vertical-rl`) or abbreviated product-name headers. Designing at true mm dimensions is the faithful approach — the paper form itself is the spec.
- **Avoid `transform: scale()` for print fitting**: transforms don't affect layout (overflow/page-break geometry is computed pre-transform) and interact badly with pagination; Prince/PDF forums and print guides consistently report page-break breakage ([Prince forum: scaling with CSS](https://www.princexml.com/forum/topic/4571/scaling-with-css), [codegenes scaling tables](https://www.codegenes.net/blog/scale-html-table-before-printing-using-css/)). If global shrink is ever needed, prefer (a) the print dialog's Scale setting, (b) Puppeteer/Playwright's `scale` PDF option, or (c) Chromium's now-standardized `zoom` property (does affect layout) — but a fixed-mm design shouldn't need any of them.
- Backgrounds (shaded header cells): add `print-color-adjust: exact; -webkit-print-color-adjust: exact;` — but the user's "Background graphics" checkbox can still win, so **prefer pure border-based styling** (the paper form is essentially black rules anyway) ([MDN print-color-adjust](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/print-color-adjust), [CSS-Tricks](https://css-tricks.com/almanac/properties/p/print-color-adjust/)).

### Page-break control

- Modern properties `break-before / break-after / break-inside` (values `page`, `avoid`, `avoid-page`) are well supported in Chromium; legacy `page-break-*` aliases still work. For per-shop sheets: render all selected shops in one print document with `.sheet { break-after: page; }` (one shop per page). For the combined sheet: it targets exactly one page; `tr { break-inside: avoid }` + repeated `thead` handle accidental overflow. Sources: [W3Docs](https://www.w3docs.com/snippets/html/how-to-handle-page-breaks-when-printing-a-large-html-table.html), [DiDoesDigital](https://didoesdigital.com/blog/print-styles/).
- Next.js implementation shape: a dedicated print route (e.g. `/print/daily/[date]` and `/print/shop/[shopId]?date=`) rendering only the sheet markup (no app chrome), `window.print()` trigger or user Ctrl+P; print CSS in a plain stylesheet with `@media print` + on-screen preview styled with the same mm dimensions (`width: 297mm` container) so screen ≈ paper.

---

## 2. Server-side PDF generation alternatives

### Playwright / Puppeteer (headless Chromium HTML→PDF)

- Both drive the same Chrome DevTools Protocol printing pipeline, so **PDF output is essentially identical Chromium print output** — i.e., the exact same rendering as §1, made deterministic (no user dialog settings). Options supported by both: `format: 'A4'`, `landscape: true`, `printBackground`, `margin`, `scale`, `pageRanges`, `displayHeaderFooter`, `headerTemplate/footerTemplate`, `preferCSSPageSize` ([Puppeteer PDFOptions](https://pptr.dev/api/puppeteer.pdfoptions), [Playwright page.pdf](https://playwright.dev/docs/api/class-page), [PDF4.dev comparison 2026](https://pdf4.dev/blog/playwright-vs-puppeteer-pdf)).
- Gotcha: if the page declares `@page { size: ... }`, use `preferCSSPageSize: true` (or don't fight it) — CSS page rules and the `format/landscape` options can conflict ([Puppeteer issue #4505](https://github.com/puppeteer/puppeteer/issues/4505)).
- **Playwright `page.pdf()` works only in headless Chromium** (not Firefox/WebKit, not headed) ([Playwright docs](https://playwright.dev/docs/api/class-page), [Checkly guide](https://www.checklyhq.com/docs/learn/playwright/generating-pdfs/)).
- 2026 comparisons favor **Playwright for new projects** (better TS types, docs, release cadence, native builds incl. aarch64; benchmarks show it faster warm) while Puppeteer remains fine and slightly leaner (Chromium-only download) ([PDF4.dev benchmark 2026](https://pdf4.dev/blog/html-to-pdf-benchmark-2026), [PDF4.dev Playwright-vs-Puppeteer](https://pdf4.dev/blog/playwright-vs-puppeteer-pdf), [Firecrawl comparison](https://www.firecrawl.dev/blog/playwright-vs-puppeteer)).
- Next.js integration: call from a Route Handler; add `puppeteer` / `playwright` (or `puppeteer-core`) to `serverExternalPackages` in `next.config` so it isn't bundled ([Next.js serverExternalPackages docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages), [Next.js+Puppeteer walkthroughs](https://strapi.io/blog/build-a-pdf-generation-engine-with-nextjs-puppeteer-and-strapi)). Reuse the SAME print route from §1: `page.goto(printUrl)` → `page.pdf(...)`.
- Windows/customer environment: both install and run fine on Windows (they download their own Chromium build at `npm install` / `npx playwright install chromium` — needs internet or a pre-seeded browser cache; corporate proxies can block the download). Footprint is the main cost: ~300–500MB browser install, 200–400MB peak RAM per render; keep a warm browser instance for 50–200ms renders ([PDF4.dev](https://pdf4.dev/blog/playwright-vs-puppeteer-pdf)). Not viable on tiny serverless plans, but irrelevant for a self-hosted Windows/VPS server.
- Font gotcha: wait for `document.fonts.ready` before `page.pdf()` so the Thai webfont is loaded; self-hosted `@font-face`/`next/font` fonts served over HTTP work reliably (avoid `file://`) ([Puppeteer issue #3183](https://github.com/puppeteer/puppeteer/issues/3183), [issue #422](https://github.com/puppeteer/puppeteer/issues/422), [browserless font guide](https://www.browserless.io/blog/puppeteer-print), [Generate PDF with non-Latin fonts + Puppeteer (Thai author)](https://medium.com/@surasith_aof/generate-pdf-support-non-latin-fonts-with-puppeteer-d6ca6c982f1c)).
- Pros for this form: exact Chromium fidelity, one layout codebase (HTML/CSS shared with browser print), correct Thai shaping via Chromium's HarfBuzz, deterministic output, archivable PDFs. Cons: heavy dependency, server needs the browser binary, ops care on the customer box.

### @react-pdf/renderer

- React components → PDF with its own Yoga-based layout engine (no HTML/CSS). Would mean **re-implementing the entire 30-column form a second time** in a different layout system.
- **Known Thai-script defects**: Thai sara am (ำ, U+0E33) is normalized to ◌ํ + า but length bookkeeping uses the pre-normalization string, truncating text (e.g. "กำก" → "กํา") ([react-pdf issue #3295](https://github.com/diegomura/react-pdf/issues/3295)); long-standing Thai support complaints ([issue #633](https://github.com/diegomura/react-pdf/issues/633)); no font-fallback across scripts ([issue #933](https://github.com/diegomura/react-pdf/issues/933)). Related ecosystem bug class: Thai tone marks (e.g. ไม้เอก U+0E48) vanish when a run starts with Latin text ([pdfme issue #1347](https://github.com/pdfme/pdfme/issues/1347)). Workarounds exist (pre-decomposing ำ, forcing a single Thai+Latin font like Sarabun, `subset: false`) but they are fragile for a business document.
- Verdict: **not recommended** for an exact-layout Thai form — double layout work + shaky Thai shaping.

### pdfmake

- Declarative JSON doc-definition on top of pdfkit; strong Thai community usage with TH Sarabun New embedded via the VFS mechanism (`node build-vfs.js "./fonts"`), incl. ready-made packages ([pdfmake custom-fonts/VFS docs](https://pdfmake.github.io/docs/0.1/fonts/custom-fonts-client-side/vfs/), [pdfmake-thai example repo](https://github.com/pumzth/pdfmake-thai), [pdfmake issue #2554: Thai Google font](https://github.com/bpampuch/pdfmake/issues/2554), Thai tutorials: [Medium/Urbanice](https://medium.com/urbanice/%E0%B8%AA%E0%B8%A3%E0%B9%89%E0%B8%B2%E0%B8%87-pdf-%E0%B8%A0%E0%B8%B2%E0%B8%A9%E0%B8%B2%E0%B9%84%E0%B8%97%E0%B8%A2-%E0%B8%94%E0%B9%89%E0%B8%A7%E0%B8%A2-reactjs-%E0%B8%81%E0%B8%B1%E0%B8%9A-pdfmake-bcd4144ffb2c)).
- Weaknesses for this use: line breaking is space-based — Thai has no inter-word spaces, so long Thai strings won't wrap inside cells unless you pre-insert zero-width spaces (U+200B), and pdfmake historically doesn't honor ZWSP either ([pdfmake issue #733](https://github.com/bpampuch/pdfmake/issues/733), [SAP blog fix via ZWSP](https://community.sap.com/t5/technology-blog-posts-by-members/fix-pdfmake-table-width-issues-with-long-continuous-text-and-special/ba-p/14303195)). Layout is again a second implementation; matching a scanned form's exact grid is tedious. Fine for simple receipts; **secondary choice at best** here.

### Summary table

| Approach | Layout fidelity to paper form | Thai shaping | Extra layout work | Runs on customer Windows | Ship speed |
|---|---|---|---|---|---|
| Browser print CSS (Chrome/Edge) | High (Chromium engine) | Excellent (HarfBuzz) | None beyond print CSS | Yes — just a browser | Fastest |
| Playwright/Puppeteer PDF | Identical to above, deterministic | Excellent (same engine) | None (reuses print route) | Yes (browser binary on server) | Fast (after §1 exists) |
| @react-pdf/renderer | Medium (own engine) | Buggy (ำ truncation, marks) | Full re-implementation | Yes | Slow |
| pdfmake | Medium-low for dense grids | OK glyphs, broken Thai wrapping | Full re-implementation | Yes | Slow |

---

## 3. Thai font choice + embedding

### Licensing lineage (important for a commercial delivery)

- **TH SarabunPSK**: original 2007 SIPA "13 national fonts" release by designer Suppakit Chalermlarp; ships under the DIP/SIPA license, which is **not compatible with standard open-source licenses** and has known technical bugs — avoid bundling ([kitty.in.th history of TH Sarabun](https://kitty.in.th/index.php/2025/01/26/about-th-sarabun/)).
- **TH Sarabun New**: the designer's fixed re-release under **GPL v2 + Font Exception** — embedding in documents is permitted, but GPL-adjacent licensing is awkward to reason about in a commercial app ([kitty.in.th](https://kitty.in.th/index.php/2025/01/26/about-th-sarabun/)).
- **Sarabun (Google Fonts)**: the same designer's modern re-issue (via Cadson Demak), **SIL Open Font License 1.1**, 8 weights, Latin+Thai, described as the most complete/cleanest version and the recommended replacement for official documents. Free for commercial use, modification, redistribution, and embedding. ([Google Fonts specimen](https://fonts.google.com/specimen/Sarabun), [google/fonts OFL directory entry](https://github.com/google/fonts/blob/main/ofl/sarabun/DESCRIPTION.en_us.html), [kitty.in.th](https://kitty.in.th/index.php/2025/01/26/about-th-sarabun/)).
- **Choice: Sarabun (OFL)**. It looks like TH Sarabun New (same designer/skeleton), so the printout will read as "the same official-looking Thai form". Self-host it (do not hit Google CDN — customer LAN may be offline): `next/font/local` with the woff2/ttf files, or plain `@font-face`. Keep `font-family: Sarabun, 'TH Sarabun New', sans-serif` as fallback chain.

### Thai rendering correctness (tone marks: ่ ้ ๊ ๋, sara am ำ, above/below vowels)

- **Chromium (browser print AND Puppeteer/Playwright PDFs)**: text is shaped with HarfBuzz — full GSUB/GPOS mark positioning; Thai tone marks stack correctly, and the generated PDF embeds subsetted glyphs, so output is correct without workarounds. Practical requirements: the font must actually be loaded before printing (`document.fonts.ready`), and for server PDF prefer webfonts served over HTTP; `--font-render-hinting=none` can improve spacing ([Puppeteer #3183](https://github.com/puppeteer/puppeteer/issues/3183), [#422](https://github.com/puppeteer/puppeteer/issues/422), [browserless](https://www.browserless.io/blog/puppeteer-print), [Thai Puppeteer guide](https://medium.com/@surasith_aof/generate-pdf-support-non-latin-fonts-with-puppeteer-d6ca6c982f1c)).
- **@react-pdf/renderer**: its own shaping path has documented Thai defects (see §2: ำ truncation [#3295](https://github.com/diegomura/react-pdf/issues/3295), historical Thai issues [#633](https://github.com/diegomura/react-pdf/issues/633)); community workaround is registering Sarabun and pre-decomposing ำ — workable but risky.
- **pdfmake (pdfkit/fontkit)**: glyph placement with TH Sarabun New is generally acceptable (large Thai community usage), but Thai **line breaking** is broken without injected zero-width spaces ([#733](https://github.com/bpampuch/pdfmake/issues/733)); dense multi-line Thai cells are a hazard.
- Cross-cutting: never rely on system fonts on the customer PC ("TH SarabunPSK installed on Windows") — embed the webfont so screen, browser print, and server PDF all use identical metrics.

---

## 4. Recommendation

### PRIMARY: HTML print route + `@media print` / `@page { size: A4 landscape }`, printed from Chrome/Edge

Build dedicated print pages in Next.js (`/print/daily/[date]`, `/print/shops/[date]?ids=...`) that render ONLY the form at true paper dimensions:

```css
@page { size: A4 landscape; margin: 8mm; }
@media print {
  html, body { width: 297mm; }
  table { table-layout: fixed; border-collapse: collapse; width: 100%; }
  thead { display: table-header-group; break-inside: avoid; }
  tr    { break-inside: avoid; }
  .sheet { break-after: page; }   /* one shop per page */
}
body { font-family: Sarabun, 'TH Sarabun New', sans-serif; }
```

Why primary:
1. **Fastest to ship**: one layout implementation; the on-screen preview and the printout are the same HTML/CSS; no server-side browser to operate in Phase 1.
2. **Faithful layout**: Chromium's print engine (LayoutNG, HarfBuzz Thai shaping, mm units, fixed table layout) reproduces a ruled A4 grid precisely; `@page size` pre-sets A4 landscape in the dialog.
3. **Works on customer Windows PCs with real printers**: Chrome/Edge → Windows print spooler → any installed printer driver; Edge is preinstalled on every Windows 10/11 machine, so zero extra software.
4. Per-shop batch printing = one document with `break-after: page`, a single print job.

Guard-rails: design with borders not background fills (dodge the "Background graphics" checkbox); keep 6–10mm margins (printer hardware margins); tell users once to set Scale=100% ("Default") and optionally untick "Headers and footers"; state "Chrome หรือ Edge" as the supported browsers.

### FALLBACK: server-side PDF via Playwright (or Puppeteer) rendering the SAME print route

Add a Route Handler (`GET /api/print/daily/[date].pdf`) that opens the existing print URL in warm headless Chromium and returns `page.pdf({ preferCSSPageSize: true, printBackground: true })` after `document.fonts.ready`. Because it reuses the exact same HTML/CSS and rendering engine, output is pixel-identical to the primary path but immune to user print-dialog settings, gives a downloadable/archivable PDF, and prints via any PDF viewer. Playwright preferred for new 2026 projects (types/docs/speed; native Chromium builds), Puppeteer an equally valid leaner alternative; both run on Windows servers (mind the Chromium download behind corporate proxies, ~0.5GB footprint, keep one warm browser instance). ([PDF4.dev 2026 benchmark](https://pdf4.dev/blog/html-to-pdf-benchmark-2026), [Playwright page.pdf](https://playwright.dev/docs/api/class-page), [Next.js serverExternalPackages](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages))

**Escalation trigger**: adopt the fallback if pilot users mangle printouts via dialog settings, if the customer wants emailed/archived PDFs, or if any PC turns out to use a non-Chromium browser.

**Rejected**: @react-pdf/renderer (Thai shaping bugs — ำ truncation, tone-mark issues — plus a full second layout implementation) and pdfmake (space-based line breaking breaks Thai wrapping; tedious to match a dense scanned grid). Both solve a problem (no-browser PDF) this project doesn't have, at the cost of the project's hardest requirement (exact Thai layout).

**Font**: bundle **Sarabun (OFL 1.1)** self-hosted via `next/font/local`; do not depend on Google CDN or fonts installed on customer PCs.

---

## Sources (all)

- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@page/size
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@page
- https://css-tricks.com/almanac/rules/p/page/
- https://didoesdigital.com/blog/print-styles/
- https://voussoir.net/writing/css_for_printing
- https://www.naveenmk.me/blog/setting-page-size-when-printing-html/
- https://excessivelyadequate.com/posts/print.html
- https://developer.chrome.com/docs/chromium/renderingng-fragmentation
- https://issues.chromium.org/issues/40321210
- https://blog.dev030.com/posts/repeating-table-headers-pdf-downloads-using-headless-chrome
- https://jessicaschillinger.com/print-repeating-header-browser/
- https://www.w3docs.com/snippets/html/how-to-handle-page-breaks-when-printing-a-large-html-table.html
- https://www.codegenes.net/blog/scale-html-table-before-printing-using-css/
- https://www.princexml.com/forum/topic/4571/scaling-with-css
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/print-color-adjust
- https://css-tricks.com/almanac/properties/p/print-color-adjust/
- https://pdf4.dev/blog/html-to-pdf-benchmark-2026
- https://pdf4.dev/blog/playwright-vs-puppeteer-pdf
- https://www.firecrawl.dev/blog/playwright-vs-puppeteer
- https://pptr.dev/api/puppeteer.pdfoptions
- https://github.com/puppeteer/puppeteer/issues/4505
- https://playwright.dev/docs/api/class-page
- https://www.checklyhq.com/docs/learn/playwright/generating-pdfs/
- https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages
- https://strapi.io/blog/build-a-pdf-generation-engine-with-nextjs-puppeteer-and-strapi
- https://github.com/puppeteer/puppeteer/issues/3183
- https://github.com/puppeteer/puppeteer/issues/422
- https://www.browserless.io/blog/puppeteer-print
- https://medium.com/@surasith_aof/generate-pdf-support-non-latin-fonts-with-puppeteer-d6ca6c982f1c
- https://github.com/diegomura/react-pdf/issues/3295
- https://github.com/diegomura/react-pdf/issues/633
- https://github.com/diegomura/react-pdf/issues/933
- https://github.com/pdfme/pdfme/issues/1347
- https://pdfmake.github.io/docs/0.1/fonts/custom-fonts-client-side/vfs/
- https://github.com/pumzth/pdfmake-thai
- https://github.com/bpampuch/pdfmake/issues/2554
- https://github.com/bpampuch/pdfmake/issues/733
- https://community.sap.com/t5/technology-blog-posts-by-members/fix-pdfmake-table-width-issues-with-long-continuous-text-and-special/ba-p/14303195
- https://fonts.google.com/specimen/Sarabun
- https://github.com/google/fonts/blob/main/ofl/sarabun/DESCRIPTION.en_us.html
- https://kitty.in.th/index.php/2025/01/26/about-th-sarabun/

---

## Load-Bearing Claims (print)

- CSS @page { size: A4 landscape } is fully supported in Chrome and Edge (Chromium) and pre-selects A4 landscape in the print dialog; since December 2024 it is Baseline (Firefox 133, Safari 18.2 also support it).
- Named @page margin-box at-rules (@top-center etc.) are not supported in any browser — only in Prince/WeasyPrint-class tools — so page furniture must live in the body; plain @page margin shorthand does work in Chromium.
- transform: scale() is unsafe for shrinking a wide table to fit a printed page because transforms do not affect layout and break page-break/fragmentation geometry; fixed mm-based table design (table-layout: fixed, ~281mm usable width at 8mm margins, ~9mm avg per column for 30 columns) is the faithful approach.
- Playwright and Puppeteer PDF output is generated by the same headless-Chromium print pipeline as browser printing, so a server-side PDF fallback reusing the same print route renders identically; page.pdf() is Chromium-headless-only, and both run on Windows servers with a ~0.5GB browser footprint and 200-400MB peak RAM.
- For server-side Chromium PDFs, the Thai webfont must be loaded before page.pdf() (await document.fonts.ready) and served over HTTP, otherwise text falls back to a wrong font.
- @react-pdf/renderer has documented Thai-script defects: sara am (U+0E33) normalization causes text truncation (issue #3295, still affecting current versions as of 2026) and long-standing Thai support problems (#633, #933), making it risky for an exact-layout Thai business form.
- Sarabun on Google Fonts is licensed under SIL OFL 1.1 (free commercial use, embedding, redistribution) and is the same designer's (Suppakit Chalermlarp) modern re-issue of TH Sarabun New; TH Sarabun New is GPL v2 + Font Exception, and the original TH SarabunPSK carries a restrictive DIP/SIPA license — so Sarabun (OFL) is the safe bundled font.
- Chromium (browser print and headless PDF) shapes Thai with HarfBuzz, so tone marks and sara am render correctly with an embedded Sarabun webfont, with no workarounds needed — unlike react-pdf/pdfmake's custom text engines.

## Risks

- Browser-print fidelity depends on user dialog settings (scale, margins, background graphics, headers/footers); a user who changes Scale from 100% silently distorts the form — mitigated by a one-time setup instruction and the PDF fallback, but never fully eliminated.
- If any customer PC uses a non-Chromium browser (old Firefox/Safari or a locked-down IE-mode Edge), print layout may differ; the recommendation assumes Chrome/Edge availability, which is unverified for the actual customer site.
- Physical printers have hardware non-printable margins (~4-6mm) that vary by model; a design tuned at 8mm margins on the dev machine may clip on the customer's specific printer — needs an on-site test print early.
- ~30 columns in 281mm usable width means ~7-9mm numeric columns at 7.5-9pt Sarabun; if the real form's column count or Thai product names are wider than estimated from the scan, legibility or fit may force layout compromises (rotated headers, abbreviations).
- Playwright/Puppeteer fallback on the customer's Windows server requires downloading a Chromium build at install time (can be blocked by corporate proxy/offline LAN) and ~0.5GB disk + 200-400MB RAM per warm browser.
- The pdf4.dev benchmark/comparison sources are published by a commercial PDF-API vendor and may overstate DIY costs; core facts were cross-checked against official Playwright/Puppeteer docs.
- If the customer prints on dot-matrix/carbon-copy printers (common in Thai distribution businesses), small font sizes and fine table rules may print poorly regardless of approach — printer type is unconfirmed.

## Open Questions

- [ ] Which browsers are actually installed on the customer's Windows PCs (Chrome? Edge? version policy), and are they centrally managed so print-dialog defaults could be preconfigured?
- [ ] What printer hardware will be used (laser vs dot-matrix, exact non-printable margin area), and is a test print on the real device possible before layout freeze?
- [ ] Will the Next.js app be hosted on the customer's own Windows machine or on a cloud/VPS? This determines whether the Playwright fallback faces offline-LAN Chromium-download issues.
- [ ] Does the paper form use any shaded/gray cells (affects the background-graphics printing decision), and must the reproduction match shading or only the ruled grid?
- [ ] Exact column count and widest Thai product names on the scanned form — needed to validate the ~9mm-per-column fit math before committing to font size 7.5-9pt.
- [ ] Does the customer require archived/emailed PDF copies of daily sheets in Phase 1 (which would justify building the Playwright fallback immediately rather than later)?
