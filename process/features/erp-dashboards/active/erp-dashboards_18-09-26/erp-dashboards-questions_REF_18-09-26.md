---
name: plan:erp-dashboards-questions
description: "ERP Dashboards — consolidated KRS/customer question list (SPEC Open Questions + prod-deploy coordination items); none block the program"
date: 18-09-26
metadata:
  node_type: memory
  type: references
  feature: erp-dashboards
---

# ERP Dashboards — คำถามถึงลูกค้า / KRS (Question List)

- Date: 18-09-26
- Source: `erp-dashboards_SPEC_18-09-26.md` §Open Questions + Phase 0 Step A (deploy-backlog coordination)
- Purpose: one reviewable list of every open question for the customer / KRS ERP team.

**Bottom line:** none of these questions block the program. Per the SPEC, "none require an answer
before PLAN begins" — development runs against a local fixture database, and each question has an
interim design that ships regardless. Answers are slotted in later.

## A. คำถามด้านข้อมูลธุรกิจ (SPEC Open Questions)

1. **ฐานการคิดยอดขาย / Sales basis** — Should sales stay based on delivery documents permanently,
   or will the business start recording real sales orders/invoices going forward?
   - Owner: user/customer
   - Blocking? No — the sales basis is switchable by design.

2. **ยอดใบกำกับขายที่ถูกตัดออก / Excluded sales-invoice pool** — Should the larger pool of
   sales-invoice value (not counted in the dashboard) be ignored permanently, or does it represent
   real transactions that need separate handling later?
   - Owner: user/customer
   - Blocking? No — a visible reconciliation footnote discloses it in the meantime.

3. **ยอดซื้อหลักที่แสดง / Purchase headline figure** — Which purchase total should be the main
   figure: invoice-based or purchase-order-based? (The other becomes secondary.)
   - Owner: user/customer
   - Blocking? No — both are shipped; a visual default is picked pending the answer.

4. **ขั้นตอนสถานะใบสั่งซื้อ / PO status workflow** — Is there a documented purchase-order status
   workflow outside the database that should replace the derived status logic?
   - Owner: user/customer
   - Blocking? No — an interim "unvalidated" status badge covers this.

5. **ยอดผลิตจริง / Actual production output** — Is there, or will there ever be, a step that
   records real production output (versus plan) in the ERP system?
   - Owner: user/customer
   - Blocking? No — the dashboard shows plan-only data with an explicit
     "ยังไม่มีข้อมูลผลิตจริง" empty state.

6. **Login อ่านอย่างเดียว / Read-only ERP login timeline** — When will the ERP team provision the
   dedicated read-only login (`orderstock_dash`)? The delivery script is
   `db/create-erp-readonly-login.sql` (Option A `db_datareader` recommended; Option B per-table
   grants available).
   - Owner: user/KRS ERP team
   - Blocking? Not for development. It IS a hard gate before any dashboard is enabled for real
     customer use.

## B. การดีพลอย / Deploy coordination (from Phase 0 Step A)

7. **กำหนดดีพลอยโค้ดค้าง / Host deploy scheduling** — Production (`orderstock.krs.co.th`) is
   15 commits behind `main` (last deployed `fe2df61`; count taken 18-09-26). When can the host deploy
   be scheduled? Plan: `process/general-plans/active/orderstock-deploy_08-07-26/`.
   - Owner: user/customer ops (host deploy is always done by a person, never an agent)
   - Blocking? No — the ERP dashboards program develops against local sandbox/fixture databases only.

8. **DBA รันสคริปต์ / DBA availability for delivery scripts** — When can the customer's DBA run:
   - `db/alter-shop-add-location.sql` (not yet run on `db_TCL`; should run before or together with
     the deploy in item 7), and
   - `db/create-erp-readonly-login.sql` (new; item 6)?
   - Owner: user/customer DBA
   - Blocking? No for development; both are prerequisites for production rollout.
