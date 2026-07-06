# ใบออเดอร์สินค้า — Canonical Structural Transcription Reference (merged A+B, scan-verified)

**Source:** `/Users/innovera/Documents/orderstock/Scan2026-07-04_170934.pdf` (1 page). The physical form is **A4 landscape** scanned in portrait; rotate the scan **90° clockwise** to view upright. All descriptions below are in corrected landscape orientation. (Transcribers analyzed renders of ~4400–6000 px width; conflict points below were re-verified against a 4000 px render.)

**Nature of the document:** NOT handwritten. It is a **computer-printed spreadsheet** (Excel-style: dotted gridlines, cell shading, Thai looped-serif typeface — TH Sarabun/Angsana/Cordia-like — with bold printed numerals). Hand-applied marks are limited to: a pen oval around the title, stray pencil streaks, and possibly a faint "=" mark (see §8). Notably, the faint "446", the yellow "24", and the very faint yellow "21" all show **typeset glyph shapes** at high zoom and are most likely printed spreadsheet values (gray/yellow font color), not handwriting — both original transcriptions assumed handwriting for some of these; the scan contradicts that. **Phase-1 implication:** the app's print output should replicate a typeset spreadsheet sheet, not handwriting.

---

## 1. Header (above the table)

| Element | Content | Position |
|---|---|---|
| Logo | Red double-ring circular logo containing **two green palm trees** over a small green mound; tiny text around the ring illegible at scan resolution (possibly Latin script) | Top-left, above the ร้านค้า column area; diameter ≈4% page width |
| Title | **ใบออเดอร์สินค้า** — large bold print, with a **hand-drawn pen oval** around it | Top-center(-left), ≈40% page width |
| วันที่ (Date) | printed label `วันที่` + printed value **13/3/69** (Thai Buddhist Era d/m/yy ⇒ 13 March 2569 BE = 13 March 2026 CE) | Top-right (label ≈78% width, value ≈86%) |
| สถานที่ (Place) | printed label `สถานที่` + printed value **ยิ่งเจริญ** (route/market name; possibly ตลาดยิ่งเจริญ — inference) | Directly below วันที่, same alignment |

Both header field values are typeset, not handwritten.

---

## 2. Overall layout geometry (scan-verified, ±1%)

- **Table bounding box** (% of landscape page): left ≈5.4%, right ≈90%, top ≈7.8%, bottom ≈97%. **Blank margin ≈10% to the right of the table** (verified).
- **Header band:** 3 tiers (group row / product name / package-size or variant sub-label), total ≈6% of page height.
- **Body:** 29 numbered rows, uniform height ≈2.4% of page height each.
- **Totals row:** 1 row, same height, pale salmon fill, directly under row 29.
- **Footer block:** ≈13% of page height (≈6 text lines), containing the หมายเหตุ tally lists and weight totals (§7).
- **Column widths (approx % of page width):** ลำดับ ≈2.4%; ร้านค้า ≈9.7%; สินค้า-group data columns ≈3.3% each (1 กก. sub-columns slightly wider than 1/2 กก.); the 4 เครื่องปรุง columns noticeably **narrower**, ≈2.3% each; หมายเหตุ ≈11% total (text part ≈8% + qty strip ≈3%).
- **Alignment:** numbers roughly right-aligned in cells; shop names left-aligned; header labels centered.

### Borders
- Thick (~2pt) solid black outer border around the whole table.
- Solid dark (~1.5pt) line under the header band and above/below the totals band.
- **Solid heavy vertical rule at the สินค้า / เครื่องปรุง group boundary** (between เลอรส-ไก่ and น้ำปลา).
- All interior row/column separators are **fine dotted lines** (~0.5pt, classic spreadsheet print style).
- A continuous dark-brown vertical streak near the left edge runs the full page height (beyond the table borders) — a **fold/scan crease, not a printed rule**.

### Shading / highlights (scan-verified)
- Header band: uniform cream/tan fill (~#EADFC9).
- Totals row: pale salmon/pink fill (~#F4DFD3) across full table width.
- Footer หมายเหตุ label block: pale green tint (~#E7EEDD).
- **กรวด column: khaki/olive-yellow fill (~#DEDDA8) over rows 1–17 only** — it stops after row 17 and does NOT extend into rows 18–29 or the totals band (verified; could be a highlighter stroke or spreadsheet conditional fill).
- **ปูนแดง (กป) column, row 1: a single pale-pink cell** (~#F2D8D4) (verified).
- Irregular pale blue-gray fills scattered across many data cells: cell-aligned rectangles, most consistent with **source-spreadsheet fill formatting**; in any case **not data-bearing** (not aligned with which cells contain values).
- Physical stains: tan blob straddling the หมายเหตุ header cell / header underline; blue water-blot over rows 1–2 of the หมายเหตุ column (smudges row 1's note); pale green smear near bottom-left; light pencil streaks in the footer and near rows 22–24 / row 29's หมายเหตุ area.

---

## 3. Column structure (left → right)

Header is 3 stacked tiers. ลำดับ, ร้านค้า, and หมายเหตุ span all tiers; single products merge tiers 2+3.

**Tier 1 (groups):** `สินค้า` spans C3–C18 (16 columns); `เครื่องปรุง` spans C19–C22 (4 columns).

Ruled columns: **22** (ลำดับ + ร้านค้า + 20 data columns + หมายเหตุ). The หมายเหตุ column is internally split by a **dotted divider** into a wide free-text part and a **narrow quantity strip at its right edge** — 23 or 24 "physical" columns depending on whether that strip is counted separately.

| # | Tier 2 (product) | Tier 3 (sub-label) | Group | Meaning / notes |
|---|---|---|---|---|
| C1 | ลำดับ | — | — | Row number, printed 1–29 |
| C2 | ร้านค้า | — | — | Shop / customer name |
| C3 | ดีนิ่ม A | — (merged) | สินค้า | product "Dee Nim A" |
| C4 | ดีลานนิ่ม | 1 กก. | สินค้า | "Dee Lan Nim", 1 kg pack |
| C5 | ดีลานนิ่ม | 1/2 กก. | สินค้า | same, ½ kg pack |
| C6 | ดีลาน | 1 กก. | สินค้า | "Dee Lan", 1 kg pack |
| C7 | ดีลาน | 1/2 กก. | สินค้า | same, ½ kg pack |
| C8 | กรวด | — (merged) | สินค้า | "Gruad" — khaki highlight rows 1–17 |
| C9 | กรวด / เหลือง | (two-line label = กรวดเหลือง) | สินค้า | yellow variant |
| C10 | รอง | 1 กก. | สินค้า | "Rong", 1 kg pack |
| C11 | รอง | 1/2 กก. | สินค้า | same, ½ kg pack |
| C12 | แบะแซ | 1 กก. | สินค้า | maltose/glucose syrup, 1 kg |
| C13 | แบะแซ | 1/2 กก. | สินค้า | same, ½ kg |
| C14 | สารส้ม | — (merged) | สินค้า | alum |
| C15 | ปูนแดง | — (merged) | สินค้า | red lime paste |
| C16 | ปูนแดง / (กป) | (two-line label) | สินค้า | "(กป)" variant — possibly กระปุก = jar (unconfirmed); row-1 cell tinted pink |
| C17 | เลอรส | หมู | สินค้า | "Ler-Rot" (brand?), pork flavor |
| C18 | เลอรส | ไก่ | สินค้า | same, chicken flavor |
| C19 | น้ำปลา | น้ำเงิน | เครื่องปรุง | fish sauce, blue label |
| C20 | น้ำตาล | แดง | เครื่องปรุง | sugar, red label |
| C21 | ส้มแว่น | เขียว | เครื่องปรุง | tamarind slices, green label |
| C22 | ส้มบด | ส้ม | เครื่องปรุง | tamarind paste, orange label |
| C23 | หมายเหตุ (text part) | — | — | Free-text remarks: off-list products + pack size |
| C23b | หมายเหตุ qty strip | — | — | Narrow sub-column right of the dotted divider; holds a quantity for the remark item |

So: **20 numeric data columns** (product-variants in fixed print order) + notes column with its own qty strip + ลำดับ + ร้านค้า.

---

## 4. Rows (ร้านค้า), all 29 in order

| # | Shop name (as printed) | Reading notes |
|---|---|---|
| 1 | เจ้เปียก | เจ้ = เจ๊ honorific printed without ๊ |
| 2 | เจ้เกียง | same |
| 3 | ตาใสของชำ | possibly "ตาใส ของชำ" (spacing unclear) |
| 4 | *(empty row)* | |
| 5 | เฮียเล็ก | clear |
| 6 | *(empty row)* | |
| 7 | สุนทร | clear |
| 8 | สิริพร ของชำ | clear — no data this day |
| 9 | ป้าอ้อย ของชำ | clear |
| 10 | ประทุมนิเยาะห์ [?] | unusual name; segmentation/spelling uncertain |
| 11 | แหม่มหมายเส้น [?] | letters read แ-ห-ม่-ม-ห-ม-า-ย-เ-ส้-น; segmentation/meaning uncertain |
| 12 | เฮียโอภาส | clear |
| 13 | พูลทรัพย์ | clear — no data this day |
| 14 | แหนมป้าพยอม | likely "แหนม ป้าพยอม" |
| 15 | เจ้เอ็ง | เจ๊ printed without ๊ |
| 16 | กิงแก้ว | printed without ่; almost certainly intended กิ่งแก้ว |
| 17 | แก้วข้าวสาร | clear |
| 18 | กรรณิกา คลอง 2 | clear (possibly กรรณิการ์ truncated) |
| 19 | ร้านชำตลาดนานาเจริญ | clear |
| 20 | *(no shop name)* | but its หมายเหตุ cell contains "ดีขาว 1 กก." (orphan remark) |
| 21 | สมชาย คำภา | surname could be คำภา or คัมภา |
| 22 | พร นานาเจริญ | clear |
| 23 | ธนกฤต บรรจุภัณฑ์ | final ฑ์ glyph slightly distorted but consistent |
| 24 | สมยศ นานาเจริญ | clear |
| 25 | กรีนเฟรชฟู้ดส์ | "Green Fresh Foods" |
| 26 | อาร์เอ็นเค ฟู้ดส์ | "RNK Foods" — no data this day |
| 27 | บิกแบงค์ | printed without ๊; likely intended บิ๊กแบงค์ |
| 28 | เลอรส | same word as product columns C17/C18 |
| 29 | *(empty row)* | |

Rows 4, 6, 29 fully empty; rows 8, 13, 26 named but no data; row 20 has a note but no name. The form keeps a fixed roster of 29 slots per day.

---

## 5. Full data matrix (all non-empty cells — both transcriptions agree exactly; verified against scan)

Column key: `ดA`=ดีนิ่ม A · `ดลน1`/`ดลน½`=ดีลานนิ่ม 1/½ กก. · `ดล1`/`ดล½`=ดีลาน · `กรวด` · `กรวดล`=กรวดเหลือง · `รอง1`/`รอง½` · `บซ1`/`บซ½`=แบะแซ · `สส`=สารส้ม · `ปด`=ปูนแดง · `ปดกป`=ปูนแดง(กป) · `หมู`/`ไก่`=เลอรส · `นป`=น้ำปลา · `นต`=น้ำตาล · `สว`=ส้มแว่น · `สบ`=ส้มบด · `Note`=หมายเหตุ text · `Q`=notes qty strip

| # | ดA | ดลน1 | ดลน½ | ดล1 | ดล½ | กรวด | กรวดล | รอง1 | รอง½ | บซ1 | บซ½ | สส | ปด | ปดกป | หมู | ไก่ | นป | นต | สว | สบ | Note | Q |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | 15 | 5 | | | | | | | | | | | | | | | | ดีขาว 1/2 กก *(กก smudged by stain)* | |
| 2 | | | | 2 | | 5 | | 8 | | | | | | | | | | | | | ดีนิม (A) 1/2กก | |
| 3 | | | | | | | | 2 | 2 | | | | | | | | | | | | | |
| 4 | | | | | | | | | | | | | | | | | | | | | | |
| 5 | | | | 5 | 2 | 10 | | | | | | | | | | | 16 | | | | พริกแดง 10 กก | |
| 6 | | | | | | | | | | | | | | | | | | | | | | |
| 7 | | | | | | | | 2 | | | | | | | | | | | | | | |
| 8 | | | | | | | | | | | | | | | | | | | | | | |
| 9 | | | | 20 | | | | | | | | | | | | | | | | | ดีขาว 1/2 กก | 1 |
| 10 | | | | | | 4 | 2 | | | | | | | | | | | | | | | |
| 11 | | | | | 12 | 2 | | | | | | | | | | | 10 | 10 | | | | |
| 12 | | | | | 1 | 1 | | | | | | | | | | | | | | | ดีขาว 1/2 กก | |
| 13 | | | | | | | | | | | | | | | | | | | | | | |
| 14 | | 10 | 2 | 5 | 1 | 3 | | | | | | | | | | | | | | | | |
| 15 | | | | | | 10 | | | | | | | | | | | | | | | | |
| 16 | | | | 5 | | | | 10 | | | | | | | | | 8 | | | | ลานนิม (ใส) 1 กก. | 20 |
| 17 | | 5 | 2 | | | 2 | 2 | | | | | | | | | | | | | | | |
| 18 | | 2 | | 30 | | | | | | | | | | | | | | | | | | |
| 19 | | | | | | | | | | | | | | | | | 4 | | | | แดง | |
| 20 | | | | | | | | | | | | | | | | | | | | | ดีขาว 1 กก. | |
| 21 | | 10 | 10 | | | | | | | | | | | | | | | | | | | |
| 22 | | 1 | | | | | | 5 | | | | | | | | | | | | | ดีขาว 1 กก. | |
| 23 | | | | | | | | | | | | | | | | | | | | | ดีนิม (A) 1/2กก | |
| 24 | | 5 | | 5 | | 2 | | 5 | | | | | | | | | | | | | ดีขาว 1 กก. | |
| 25 | | 16 | | | | | | | | | | | | | | | | | | | | |
| 26 | | | | | | | | | | | | | | | | | | | | | | |
| 27 | | 30 | | 30 | | | | 50 | | | | | | | | | | | | | รอง 5 กก. | |
| 28 | | 20 | | 20 | | | | | | | | | | | | | | | | | ดีนิม (A) 1/2กก | |
| 29 | | | | | | | | | | | | | | | | | | | | | | |
| **รวม** | **0** | **99** | **14** | **137** | **21** | **39** | **4** | **82** | **2** | **0** | **0** | **0** | **0** | **0** | **0** | **0** | **38** | **10** | **0** | **0** | *(446, faint gray print)* | |

Note-cell spelling: the per-row remark cells print `ดีนิม` / `ลานนิม` with **no visible tone mark ่** ; the footer legend prints `ดีนิ่ม` / `ลานนิ่ม`. Intended products are ดีนิ่ม / ลานนิ่ม.

**Arithmetic verification (all pass, both transcribers + re-check):**
ดลน1: 10+5+2+10+1+5+16+30+20 = 99 ✓ · ดลน½: 2+2+10 = 14 ✓ · ดล1: 15+2+5+20+5+5+30+5+30+20 = 137 ✓ · ดล½: 5+2+12+1+1 = 21 ✓ · กรวด: 5+10+4+2+1+3+10+2+2 = 39 ✓ · กรวดล: 2+2 = 4 ✓ · รอง1: 8+2+2+10+5+5+50 = 82 ✓ · รอง½: 2 ✓ · นป: 16+10+8+4 = 38 ✓ · นต: 10 ✓ · Grand total **446 = 99+14+137+21+39+4+82+2+38+10** ✓

---

## 6. Totals row

Directly below body row 29: a full-width band with **pale salmon/pink fill**, bold printed totals for every data column (values in matrix above), including explicit `0` for columns with no orders. No label — the ลำดับ+ร้านค้า cells are empty salmon cells.

The หมายเหตุ cell of this band contains **"446" in very faint pale gray-blue TYPESET digits** (scan-verified at high zoom: glyph shapes match the printed serif numerals — this is printed with a light font color, not handwritten pen). It equals the sum of all 20 column totals (grand piece count).

---

## 7. Footer block (below totals row, ≈6 text lines tall)

**Left label:** `หมายเหตุ` — printed in a pale-green shaded block occupying the ลำดับ+ร้านค้า width, vertically centered.

**Tally list 1** (labels under the ดีลานนิ่ม/ดีลาน columns; values, where present, under the ดีลาน ½/กรวด area):

| Item | Qty |
|---|---|
| รอง(ปี๊บ) | *(blank)* |
| กรวด(กระสอบ) | *(blank)* |
| ดีนิ่ม A เข้ม | *(blank)* |
| แดง | 0 |
| รอง 5 กก. | 0 |
| รองดำใส 1/2 กก. | *(blank)* |

**Tally list 2** (labels under the รอง columns; values under the แบะแซ 1 กก. area) — aggregates the per-row หมายเหตุ qty strip by item:

| Item | Qty | Matching rows |
|---|---|---|
| ลานนิ่ม (ใส) 1 กก. | 20 | row 16 (qty 20) ✓ |
| ดีนิ่ม (A) 1/2กก | 0 | rows 2, 23, 28 (no qty written) |
| ดีขาว 1 กก. | 0 | rows 20, 22, 24 (no qty) |
| ดีขาว 1/2 กก | 1 | rows 1, 9 (qty 1), 12 |
| พริกแดง 10 กก | 0 | row 5 (no qty) |

**Semantics:** this block tallies the *off-list products written in the per-row หมายเหตุ column*. Cross-checks pass (row 16 → 20; row 9 → 1). Note-entries without a qty tally 0/blank — apparently standing product reminders rather than quantified orders. The list-1 items also reveal extra units of measure: **ปี๊บ** (tin) for รอง, **กระสอบ** (sack) for กรวด.

**Right side:**
- First footer line: `รวมน้ำหนัก` … **4,670 กก.** (total weight; comma thousands separator).
- Two lines below, right-aligned to the same position: **163.00 ปี๊บ** (tins; printed without the full tone/vowel marks, glyphs read "ปีป"). A tiny faint gray `=`-like mark sits mid-line to its left (printed vs pencil undetermined).
- The conversion 446 pieces → 4,670 kg → 163.00 ปี๊บ is NOT shown on the form; it implies per-product weight/packing factors inside the source spreadsheet.

**Yellow figures in the footer (scan-verified):**
- **"24"** in yellow — on the รวมน้ำหนัก line, roughly under the เลอรส หมู/ไก่ columns. Glyphs look **typeset**; likely a spreadsheet cell printed with yellow font color rather than handwriting. Meaning unknown (possibly count of ordering shops or a route/check figure).
- **"21"[?]** — a second, extremely faint yellow 2-digit figure at the bottom of the footer, in tally list 2's qty column just left of a dotted grid line (confirmed present on the scan; digits and meaning uncertain).

---

## 8. Non-typeset / anomalous marks inventory

1. Pen oval drawn around the printed title ใบออเดอร์สินค้า.
2. Tan blob straddling the หมายเหตุ header cell and header underline — reads as a physical stain (possibly old highlighter/adhesive), not a clean highlighter stroke.
3. Blue water-blot over rows 1–2 of the หมายเหตุ column (smudges row 1's note).
4. Khaki tint down the กรวด column, rows 1–17 only — highlighter stroke or printed conditional fill (undetermined).
5. Single pale-pink cell at ปูนแดง (กป) row 1 — highlighter or fill (undetermined).
6. Faint gray `=`-like mark left of "163.00 ปี๊บ" — printed or pencil (undetermined).
7. Stray pencil streaks in the footer region, near rows 22–24 right margin, and in row 29's หมายเหตุ area.
8. Pale green smear near bottom-left.
9. The faint "446", yellow "24", and faint yellow "21" appear **typeset** (see §6/§7), i.e. probably NOT handwriting.
10. Dark-brown vertical crease near the left page edge (scan/fold artifact).

---

## 9. Styling tokens (for pixel-faithful print reproduction)

- **Typeface:** Thai looped serif (TH Sarabun / Angsana / Cordia-like) throughout; title larger + bold; header labels regular; all numerals bold; footer weight figures bold. Thousands separator comma ("4,670"); two-decimal format ("163.00").
- **Fills:** header band cream/tan ~#EADFC9; totals row pale salmon ~#F4DFD3; footer หมายเหตุ label block pale green ~#E7EEDD; กรวด column khaki ~#DEDDA8 (rows 1–17); one pink cell ~#F2D8D4 at C16 row 1; scattered non-data-bearing pale blue-gray cell fills.
- **Rules:** outer border ~2pt black; header underline + totals band borders solid ~1.5pt; solid group divider before น้ำปลา; all other interior separators fine dotted ~0.5pt; dotted internal divider inside หมายเหตุ for the qty strip.
- **Cell geometry:** 29 uniform body rows ≈2.4% page height each; สินค้า columns ≈3.3% page width vs เครื่องปรุง ≈2.3%; ลำดับ ≈2.4%; ร้านค้า ≈9.7%; หมายเหตุ ≈11% incl. ≈3% qty strip; table spans ≈5.4%–90% of page width (blank right margin ≈10%).

---

## 10. Data-model observations (for schema design)

- Products fall into two printed groups: **สินค้า** (16 columns) and **เครื่องปรุง** (4 columns). Several products have **package-size variants** (1 กก. / 1/2 กก.) or **flavor/label-color variants** (หมู/ไก่; น้ำเงิน/แดง/เขียว/ส้ม). The logical entity is **product-variant (product × pack size/variant)** — 20 variants in fixed print order.
- Order lines are **positive integer piece counts** per (shop × product-variant); blank = no order; no decimals observed.
- **หมายเหตุ** doubles as an overflow order line: free text naming an off-list product + pack size ("ดีขาว 1/2 กก", "พริกแดง 10 กก", "ลานนิ่ม (ใส) 1 กก.", "แดง", "รอง 5 กก.") plus an optional quantity in the dedicated strip; the footer legend aggregates these. Known off-list items: ดีขาว 1 กก., ดีขาว 1/2 กก., ลานนิ่ม (ใส) 1 กก., ดีนิ่ม (A) 1/2กก., พริกแดง 10 กก., รอง 5 กก., ดีนิ่ม A เข้ม, รองดำใส 1/2 กก., แดง, รอง(ปี๊บ), กรวด(กระสอบ). Consider modeling these as real products rather than free text.
- Footer aggregates: per-column totals row, grand piece count (446), total weight **รวมน้ำหนัก (กก.)** and tin count (**ปี๊บ**) — the last two imply per-product **weight/packaging conversion factors** exist in the business but are not on the form.
- Fixed roster of 29 customer slots per sheet; blank rows preserved; a row can carry a remark with no shop (row 20); shops can appear with zero orders (rows 8, 13, 26).
- Date in Thai Buddhist Era short format (13/3/69); สถานที่ is a route/market name (ยิ่งเจริญ).

---

## Transcription Conflicts (A vs B) and Resolutions

- **Nature of the '446' in the totals-row หมายเหตุ cell**
  - A: Faint light-gray PRINTED digits (possibly deliberately grayed out)
  - B: HANDWRITTEN '446' in blue/gray pen
  - Resolution: A is correct — verified against the scan at high zoom: the digits are uniform pale gray-blue typeset glyphs whose shapes match the printed bold serif numerals elsewhere (e.g. '4,670'). It is printed with a light font color, not pen. Value 446 itself is agreed and arithmetically confirmed.
- **Extent of the khaki highlight on the กรวด column (C8)**
  - A: Entire column highlighted pale yellow-green top to bottom, header through totals
  - B: Khaki/olive-yellow highlight over rows ~1–17 only; stops after row 17
  - Resolution: B is correct — verified against the scan: the khaki fill is present behind rows up to 17 (e.g. behind the '2' in row 17) and absent from row 18 downward; the totals band under กรวด is salmon like the rest of the totals row.
- **Very faint yellow '21' near the bottom of the footer**
  - A: Not mentioned (absent)
  - B: A very faint 2-digit yellow mark, possibly '21', under the แบะแซ area left of a dotted grid line
  - Resolution: B is correct — verified: a very faint yellow 2-digit figure exists at the bottom of footer tally-list 2's qty column, just left of the dotted rule and above the bottom border. Digits read like '21' but are borderline legible; like the '24', the glyphs look typeset (yellow font) rather than handwritten.
- **Position and nature of the yellow '24'**
  - A: Handwritten yellow '24' just below the totals row, roughly under ปูนแดง(กป)/เลอรส-หมู
  - B: Handwritten yellow '24' on the รวมน้ำหนัก line, roughly under เลอรส หมู/ไก่
  - Resolution: Positions are compatible (the รวมน้ำหนัก line IS the first line below the totals row); canonicalized as 'on the รวมน้ำหนัก footer line, under the เลอรส area'. However BOTH transcriptions' 'handwritten' claim is doubtful: at high zoom the '24' shows uniform typeset serif digit shapes, so it is likely a spreadsheet cell printed with yellow font color. Meaning still unknown.
- **Physical column count**
  - A: 23 physical columns (หมายเหตุ counted as one column containing an unlabeled qty sub-strip)
  - B: 24 physical columns (หมายเหตุ text part and qty strip counted separately)
  - Resolution: Counting convention, not a data disagreement — both describe identical structure. Canonicalized as: 22 ruled columns (ลำดับ + ร้านค้า + 20 data + หมายเหตุ), with หมายเหตุ internally split by a dotted divider into a text part and a narrow qty strip (⇒ 23 or 24 depending on convention).
- **Origin of scattered pale blue-gray cell shading in the data grid**
  - A: Artifact of the source spreadsheet's fill formatting
  - B: Scan artifact / show-through, not data-bearing
  - Resolution: Leaning A: in the scan the patches are rectangular and align exactly to cell boundaries, which is characteristic of spreadsheet cell fills rather than show-through. Both agree it is not data-bearing, which is the operative fact; origin noted as probable spreadsheet formatting.
- **Mark over the หมายเหตุ header (top-right of header band)**
  - A: Yellow highlighter streak across the top-right corner of the header band, over the หมายเหตุ header
  - B: Tan blob physical stain in the หมายเหตุ header cell
  - Resolution: B more plausible — at zoom it is an amorphous tan blob straddling the header cell and the header underline, not a straight highlighter stroke. Canonicalized as a physical stain (possibly degraded highlighter/adhesive); flagged for owner confirmation since it carries no data either way.
- **The small '='-like mark left of '163.00 ปี๊บ'**
  - A: Tiny PRINTED '='-like mark
  - B: Faint PENCIL '=' mark
  - Resolution: Undetermined — the mark is too small/faint in the scan to classify. Canonical doc records it as 'faint gray =-like mark, printed vs pencil undetermined'. No data impact.
- **Heavy vertical line near the ร้านค้า column**
  - A: Heavy printed vertical rule around the ร้านค้า column (part of border scheme)
  - B: Continuous dark-brown vertical streak between ลำดับ and ร้านค้า — likely a fold/scan crease, not a printed rule
  - Resolution: B is correct about the dark streak — in the scan it runs the full page height including beyond the table's outer borders, so it is a crease/scan artifact. The table's own column separators around ร้านค้า are ordinary rules. Canonical doc records the streak as a physical artifact near the left edge.
- **Single pink cell at ปูนแดง (กป), row 1**
  - A: Not mentioned
  - B: Row-1 cell of C16 tinted pale pink (highlighter or scan artifact)
  - Resolution: B is correct — verified: there is a single pale pink/tan tinted cell directly under the (กป) header at row 1. Whether it is highlighter, spreadsheet fill, or artifact is undetermined; included in canonical doc with that caveat.
- **Tone-mark spelling of remark-cell product names (ดีนิ่ม vs ดีนิม; ลานนิ่ม vs ลานนิม)**
  - A: Remarks transcribed WITH tone mark: 'ดีนิ่ม (A) 1/2กก', 'ลานนิ่ม (ใส) 1 กก.'
  - B: Remarks transcribed WITHOUT visible tone mark: 'ดีนิม (A) 1/2กก', 'ลานนิม (ใส) 1 กก.' — noting the footer legend does print ดีนิ่ม/ลานนิ่ม
  - Resolution: B adopted for the as-printed body cells (the scan shows no clearly visible ่ in the remark cells, while the footer legend prints the tone marks); canonical doc records as-printed forms in the matrix and notes the intended products are ดีนิ่ม / ลานนิ่ม. Same product either way.
- **Column-width and margin geometry**
  - A: ร้านค้า ≈12–13%; data columns ≈3.5–4% (1 กก. sub-columns slightly wider); table occupies nearly full page width
  - B: ร้านค้า ≈9.7% of page width; สินค้า columns ≈3.3%, เครื่องปรุง columns narrower ≈2.3%; table right edge ≈90% with ~10% blank right margin
  - Resolution: B adopted — verified by measuring the scan: the table's right border sits at ≈90% of page width with a blank margin beyond, and the เครื่องปรุง columns are visibly narrower than the สินค้า columns. A's larger percentages appear to be expressed relative to table width rather than page width; A's finer observation that 1 กก. sub-columns are slightly wider than 1/2 กก. ones is retained as compatible.
- **Printed form of the tin unit near '163.00'**
  - A: Printed as 'ปีป' (without ไม้ตรี), interpreted as ปี๊บ
  - B: Read as 'ปี๊บ', glyph could also be 'ปี๊ป'
  - Resolution: Merged: the printed glyphs lack clear tone/final-consonant detail (looks like 'ปีป'); both agree the intended word is ปี๊บ (tin/canister). Canonical doc records intended ปี๊บ with the as-printed caveat.

## Items To Confirm With The Business Owner

- [ ] Product name initial letter ด vs ต in ดีนิ่ม A / ดีลานนิ่ม / ดีลาน (ด verified at high zoom but ด/ต near-identical in this font) — confirm official product names with owner
- [ ] แบะแซ (C12–C13) spelling — could be แป๊ะแซ/เบะแซ on the original; confirm canonical product name
- [ ] เลอรส (C17–C18 product and row-28 shop) — brand-name reading; last character not fully crisp (เลอรส vs เลอรถ); confirm spelling and whether shop 28 is the same entity as the product brand
- [ ] Meaning of '(กป)' in ปูนแดง (กป) — inferred as กระปุก (jar); could be another abbreviation; confirm variant meaning
- [ ] Row 1 note 'ดีขาว 1/2 กก' — final word smudged by a water stain; 'กก' inferred from identical notes on rows 9 and 12; confirm
- [ ] Row 10 shop name ประทุมนิเยาะห์ — unusual name, spelling/segmentation uncertain (ประทุมนีเยาะห์ / ประทุม นิเยาะห์?); confirm customer name
- [ ] Row 11 shop name แหม่มหมายเส้น — characters confident but segmentation/meaning unclear (แหม่ม + หมายเส้น?); confirm customer name
- [ ] Rows 1/2/15 honorific printed เจ้ (no ๊) — presumably เจ๊เปียก/เจ๊เกียง/เจ๊เอ็ง; confirm canonical customer names
- [ ] Row 16 shop printed กิงแก้ว — presumably intended กิ่งแก้ว; confirm
- [ ] Row 27 shop printed บิกแบงค์ — presumably intended บิ๊กแบงค์ (Big Bang); confirm
- [ ] Row 3 ตาใสของชำ — segmentation (ตาใส ของชำ?) unclear; confirm
- [ ] Row 21 สมชาย คำภา — surname could be คำภา or คัมภา; confirm
- [ ] Row 23 ธนกฤต บรรจุภัณฑ์ — final ฑ์ glyph slightly distorted; confirm
- [ ] Row 18 กรรณิกา คลอง 2 — possibly กรรณิการ์ truncated; confirm
- [ ] Row 20 has a หมายเหตุ note (ดีขาว 1 กก.) but NO shop name — is it a continuation of row 19's order, a separate walk-in, or a data-entry artifact? Confirm whose order it is
- [ ] Yellow '24' (รวมน้ำหนัก line): meaning unknown (count of ordering shops? route/driver check figure?) AND production method uncertain — glyphs look typeset (yellow font) though both transcribers assumed handwriting; confirm what it represents and whether the spreadsheet prints it
- [ ] Very faint yellow '21'(?) at the bottom of footer tally-list 2's qty column — presence confirmed on scan but digits ('21' vs '24' vs smudge) and meaning unknown; confirm
- [ ] Faint gray '446' in the totals-row หมายเหตุ cell — confirmed printed and arithmetically correct (sum of all column totals), but confirm whether the light-gray styling is deliberate (e.g. a hidden check cell)
- [ ] '163.00 ปี๊บ' — unit glyphs print like 'ปีป'; interpreted ปี๊บ (tin); the small '='-like mark to its left is unclassified (printed vs pencil); confirm unit and formula
- [ ] Conversion factors: 446 pieces → รวมน้ำหนัก 4,670 กก. → 163.00 ปี๊บ are computed off-form; obtain the per-product weight and per-ปี๊บ packing factors from the source spreadsheet
- [ ] Footer item 'ดีนิ่ม A เข้ม' — เข้ม legible but low resolution (could be เต้ม); confirm product name
- [ ] Footer item 'รองดำใส 1/2 กก.' — ดำใส reading moderately confident (could be รองดำ ใส / รองดีใส); confirm product name
- [ ] Footer/row-19 item 'แดง' — meaning ambiguous (shorthand for a red-label product? which one?); confirm
- [ ] Footer tally-list-1 items with blank values (รอง(ปี๊บ), กรวด(กระสอบ), ดีนิ่ม A เข้ม, รองดำใส 1/2 กก.) — are these standing reminder lines or real zero-qty items? Also confirm the extra units ปี๊บ (tin) and กระสอบ (sack)
- [ ] Remark-cell spellings print ดีนิม/ลานนิม without visible tone marks while the footer prints ดีนิ่ม/ลานนิ่ม — confirm canonical product spellings
- [ ] กรวด column khaki tint (rows 1–17 verified): highlighter stroke vs printed conditional fill, exact intent, and why it stops at row 17 — confirm with owner
- [ ] Single pale-pink cell at ปูนแดง (กป) row 1 — highlighter, spreadsheet fill, or scan artifact? Confirm whether it carries meaning
- [ ] Tan blob over the หมายเหตุ header — stain vs deliberate highlight; confirm it carries no meaning
- [ ] Scattered pale blue-gray cell fills — probably source-spreadsheet formatting (cell-aligned), confirmed not aligned with data; confirm they carry no meaning before reproducing them in print output
- [ ] Logo ring text illegible at scan resolution (possibly Latin script, maybe containing 'Palm') — obtain the actual logo asset/text from owner
- [ ] สถานที่ value ยิ่งเจริญ — confirm whether it refers to ตลาดยิ่งเจริญ (Ying Charoen market) and whether สถานที่ is a route identifier
- [ ] Date 13/3/69 interpreted as 13 March 2569 BE = 13 March 2026 CE — confirm BE d/m/yy convention is universal on these forms
- [ ] Geometry percentages (column widths, table bounds, row heights) measured from the scan are approximate (±1%) — obtain the source spreadsheet file if pixel-faithful print reproduction is required
