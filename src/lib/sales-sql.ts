// erp-dashboards Phase 2 — the Sales SQL, embedded as string constants.
//
// SOURCE OF TRUTH: the versioned, reviewable files in `db/erp-queries/sales/`. Each constant below
// is a byte-identical copy of its named file, and
// `src/lib/__tests__/sales-basis-reconciliation.test.ts` asserts that identity on every run. To
// change a query: edit the `.sql` file, then paste the new text into the matching constant here.
// An out-of-sync copy FAILS the unit suite, so the two can never silently diverge.
//
// WHY EMBED AT ALL: `next.config.ts` sets `output: "standalone"`, and the standalone bundle (plus
// the production Dockerfile's COPY list) does not include `db/`. Reading these files at runtime via
// `process.cwd()` would work in dev and `pnpm start` and then fail ONLY in the production container
// — a break no gate in this repo would catch. Embedding keeps the files authoritative and
// reviewable while making the runtime path environment-independent.
//
// GENERATED — do not hand-edit the template literals below.

/** Verbatim copy of `db/erp-queries/sales/do-headers.sql`. */
export const DO_HEADERS_SQL = `-- erp-dashboards Phase 2 — Sales: filtered delivery-order (DO) headers.
--
-- READ-ONLY: a single SELECT/WITH statement, executed ONLY through \`guardedQuery()\`.
-- PARAMETERIZED ONLY: every filter below is a named parameter compared inside static SQL — no
-- value is ever concatenated into this text (execute-agent instruction E2). Optional filters use
-- the \`(@p IS NULL OR col = @p)\` form so ONE static statement serves every filter combination.
--
-- Params:
--   @from, @to        date range over tbl_DOhdr.Dodate (required)
--   @doNo             single DO drilldown (NULL = no restriction)
--   @customer         CustCode — NEVER CustName (codes are the stable identity)
--   @product          ItemCode; a header matches when ANY of its lines carries it
--   @status           derived delivery-status key (see the CASE below)
--   @cat              InventoryItem.ItemGRP category key ('-' = no group)
--   @skipStatus       1 = ignore @status (the status donut must keep showing every status)
--   @skipCat          1 = ignore @cat (the category pie must keep showing every category)
--
-- STATUS is derived from the REAL flags (IsClosed/IsApproved/IsCheck) and labelled
-- "สถานะการส่งมอบ" in the UI — never "SO status": the SalesOrder module is unused in this ERP.
--
-- THERE IS NO 'cancelled' STATUS, on purpose (schema-conformance fix 23-09-26). An earlier draft
-- branched on \`h.IsCancel\`, but that column DOES NOT EXIST on the live \`dbo.tbl_DOhdr\` — the whole
-- query failed at runtime, which is why every dashboard page rendered the ERP-unavailable message.
-- The real flag set is IsApproved / IsClosed / IsComplete / IsCheck / IsAcc / Revised (each Is* with
-- a paired *By/*Date). NONE of them carries "cancelled" meaning: \`Revised\` means revised, and it is
-- 0 on all 83 live headers, so it was NOT repurposed as a stand-in. The branch is therefore DROPPED
-- rather than re-pointed at an invented substitute, and the UI's ยกเลิก legend entry is removed with it.
-- Live evidence (metadata + aggregate only, 23-09-26): 83 headers; IsApproved=1 on 73, IsCheck=1 on 2,
-- IsClosed/IsComplete/IsAcc/Revised = 1 on 0; no column is NULL. If the customer later confirms a
-- cancellation convention, re-add the branch against the column they name — not by guessing.
WITH CanonicalItem AS (
    -- InventoryItem's real PK is composite (Roworder, ItemCode); ItemCode alone is NOT unique
    -- (~85 duplicated codes live). Highest-Roworder-wins is the agreed tie-break (registry
    -- Cross-Phase Precondition) — resolve to exactly ONE row per ItemCode before joining.
    SELECT ItemCode, ItemGRP,
           ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC) AS RowRank
    FROM dbo.InventoryItem
),
Item AS (
    SELECT ItemCode, ItemGRP FROM CanonicalItem WHERE RowRank = 1
),
Hdr AS (
    SELECT h.TransactionNo, h.DoNo, h.Dodate, h.CustCode, h.CustName,
           CASE
               WHEN h.IsClosed = 1 THEN 'closed'
               WHEN h.IsApproved = 1 AND h.IsCheck = 1 THEN 'checked'
               WHEN h.IsApproved = 1 THEN 'approved'
               ELSE 'pending'
           END AS StatusKey
    FROM dbo.tbl_DOhdr h
)
SELECT
    hh.TransactionNo,
    hh.DoNo,
    hh.Dodate,
    hh.CustCode,
    hh.CustName,
    hh.StatusKey,
    (SELECT COUNT(*) FROM dbo.tbl_Dodtl d WHERE d.TransactionNo = hh.TransactionNo) AS LineCount,
    (SELECT COUNT(*) FROM dbo.tbl_Dodtl d
      WHERE d.TransactionNo = hh.TransactionNo AND d.Saleprice <> 0) AS PricedLineCount,
    (SELECT COALESCE(SUM(d.Amount), 0) FROM dbo.tbl_Dodtl d
      WHERE d.TransactionNo = hh.TransactionNo) AS Amount
FROM Hdr hh
WHERE hh.Dodate >= @from
  AND hh.Dodate <= @to
  AND (@doNo IS NULL OR hh.DoNo = @doNo)
  AND (@customer IS NULL OR hh.CustCode = @customer)
  AND (@status IS NULL OR @skipStatus = 1 OR hh.StatusKey = @status)
  AND (@product IS NULL OR EXISTS (
        SELECT 1 FROM dbo.tbl_Dodtl d
        WHERE d.TransactionNo = hh.TransactionNo AND d.ItemCode = @product))
  AND (@cat IS NULL OR @skipCat = 1 OR EXISTS (
        SELECT 1 FROM dbo.tbl_Dodtl d
        JOIN Item i ON i.ItemCode = d.ItemCode
        WHERE d.TransactionNo = hh.TransactionNo
          AND COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') = @cat))
ORDER BY hh.Dodate DESC, hh.DoNo DESC;
`;

/** Verbatim copy of `db/erp-queries/sales/do-lines.sql`. */
export const DO_LINES_SQL = `-- erp-dashboards Phase 2 — Sales: filtered DO line items, joined to the canonical item master.
--
-- READ-ONLY single statement, run ONLY through \`guardedQuery()\`; every filter is a named
-- parameter (E2) — nothing is concatenated into this text.
--
-- Semantics mirror the approved mockup exactly: a HEADER qualifies on the date/customer/status
-- filters (and on "has at least one line matching the product/category filter"); the returned
-- LINES are then narrowed to the lines that themselves match the product/category filter.
--
-- Params: identical to do-headers.sql.
--
-- CATEGORY LABELS COME FROM THE ERP ITSELF (defect fix, 23-09-26): \`CategoryKey\` is still the raw
-- \`InventoryItem.ItemGRP\` CODE — the stable identity that every filter and URL uses — but the
-- human-readable \`CategoryLabel\` is now LEFT JOINed from \`dbo.tbl_ItemGroup\` (ICCode -> Description,
-- 23 rows live) instead of being hardcoded in the app. The app only ever knew F/R/P, so the live
-- code \`W\` rendered as the raw fallback "หมวด W" on the category pie, and \`P\` was not even a real
-- code (the live "งานระหว่างผลิต"-ish group is \`W\` = สินค้าระหว่างผลิต). The label stays NULLable: a
-- code with no matching group row falls back to "หมวด {code}" in the app, never to nothing.
--
-- MainUnits comes from InventoryItem (the line table carries no unit of its own). Quantities are
-- returned PER LINE with their unit attached and are NEVER pre-summed here — cross-unit summing
-- is forbidden (umbrella charter hard safety constraint); aggregation happens per-unit in
-- \`sumQuantityByUnit()\`.
WITH CanonicalItem AS (
    -- Highest-Roworder-wins tie-break: ItemCode is NOT unique in InventoryItem (composite PK).
    SELECT ItemCode, Description, MainUnits, ItemGRP,
           ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC) AS RowRank
    FROM dbo.InventoryItem
),
Item AS (
    SELECT ItemCode, Description, MainUnits, ItemGRP FROM CanonicalItem WHERE RowRank = 1
),
ItemGroup AS (
    -- The ERP's own category master. ICCode is unique across the 23 live rows today, but this
    -- collapses by code anyway so a future duplicate can never fan a line out into two rows and
    -- inflate the pie's line counts.
    SELECT LTRIM(RTRIM(ICCode)) AS GroupCode, MAX(LTRIM(RTRIM(Description))) AS GroupName
    FROM dbo.tbl_ItemGroup
    WHERE NULLIF(LTRIM(RTRIM(ICCode)), '') IS NOT NULL
    GROUP BY LTRIM(RTRIM(ICCode))
),
Hdr AS (
    SELECT h.TransactionNo, h.DoNo, h.Dodate, h.CustCode, h.CustName,
           CASE
               WHEN h.IsClosed = 1 THEN 'closed'
               WHEN h.IsApproved = 1 AND h.IsCheck = 1 THEN 'checked'
               WHEN h.IsApproved = 1 THEN 'approved'
               ELSE 'pending'
           END AS StatusKey
    FROM dbo.tbl_DOhdr h
),
Qualified AS (
    SELECT hh.TransactionNo, hh.DoNo, hh.Dodate, hh.CustCode, hh.CustName, hh.StatusKey
    FROM Hdr hh
    WHERE hh.Dodate >= @from
      AND hh.Dodate <= @to
      AND (@doNo IS NULL OR hh.DoNo = @doNo)
      AND (@customer IS NULL OR hh.CustCode = @customer)
      AND (@status IS NULL OR @skipStatus = 1 OR hh.StatusKey = @status)
      AND (@product IS NULL OR EXISTS (
            SELECT 1 FROM dbo.tbl_Dodtl d
            WHERE d.TransactionNo = hh.TransactionNo AND d.ItemCode = @product))
      AND (@cat IS NULL OR @skipCat = 1 OR EXISTS (
            SELECT 1 FROM dbo.tbl_Dodtl d
            JOIN Item i ON i.ItemCode = d.ItemCode
            WHERE d.TransactionNo = hh.TransactionNo
              AND COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') = @cat))
)
SELECT
    q.DoNo,
    q.Dodate,
    q.CustCode,
    q.CustName,
    q.StatusKey,
    d.Roworder,
    d.ItemCode,
    COALESCE(i.Description, d.ItemCode) AS ItemName,
    COALESCE(NULLIF(LTRIM(RTRIM(i.MainUnits)), ''), '-') AS Unit,
    COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') AS CategoryKey,
    g.GroupName AS CategoryLabel,
    COALESCE(d.Qty, 0) AS Qty,
    COALESCE(d.Saleprice, 0) AS Saleprice,
    COALESCE(d.Amount, 0) AS Amount
FROM Qualified q
JOIN dbo.tbl_Dodtl d ON d.TransactionNo = q.TransactionNo
LEFT JOIN Item i ON i.ItemCode = d.ItemCode
LEFT JOIN ItemGroup g ON g.GroupCode = LTRIM(RTRIM(i.ItemGRP))
WHERE (@product IS NULL OR d.ItemCode = @product)
  AND (@cat IS NULL OR @skipCat = 1
       OR COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') = @cat)
ORDER BY q.Dodate DESC, q.DoNo DESC, d.Roworder ASC;
`;

/** Verbatim copy of `db/erp-queries/sales/do-by-product.sql`. */
export const DO_BY_PRODUCT_SQL = `-- erp-dashboards Phase 2 — Sales: quantity/amount rolled up PER PRODUCT (ItemCode).
--
-- READ-ONLY single statement through \`guardedQuery()\`; all filters are named parameters (E2).
-- Params identical to do-headers.sql / do-lines.sql.
--
-- HARD REQUIREMENT (registry Cross-Phase Precondition, execute-agent instruction E5): the join to
-- InventoryItem resolves exactly ONE canonical row per ItemCode via highest-Roworder-wins
-- (\`ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC)\` in \`CanonicalItem\` below).
-- ItemCode is NOT unique in InventoryItem (~85 duplicated codes live) — a lower-Roworder row must
-- never silently win the name/unit/category lookup.
--
-- Grouping is per ItemCode, and each product carries its OWN unit — quantities are therefore never
-- summed across different MainUnits values (umbrella charter hard safety constraint).
WITH CanonicalItem AS (
    -- Highest-Roworder-wins tie-break: ItemCode is NOT unique in InventoryItem (composite PK).
    SELECT ItemCode, Description, MainUnits, ItemGRP,
           ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC) AS RowRank
    FROM dbo.InventoryItem
),
Item AS (
    SELECT ItemCode, Description, MainUnits, ItemGRP FROM CanonicalItem WHERE RowRank = 1
),
Hdr AS (
    SELECT h.TransactionNo, h.DoNo, h.Dodate, h.CustCode, h.CustName,
           CASE
               WHEN h.IsClosed = 1 THEN 'closed'
               WHEN h.IsApproved = 1 AND h.IsCheck = 1 THEN 'checked'
               WHEN h.IsApproved = 1 THEN 'approved'
               ELSE 'pending'
           END AS StatusKey
    FROM dbo.tbl_DOhdr h
),
Qualified AS (
    SELECT hh.TransactionNo, hh.DoNo, hh.Dodate, hh.CustCode, hh.CustName, hh.StatusKey
    FROM Hdr hh
    WHERE hh.Dodate >= @from
      AND hh.Dodate <= @to
      AND (@doNo IS NULL OR hh.DoNo = @doNo)
      AND (@customer IS NULL OR hh.CustCode = @customer)
      AND (@status IS NULL OR @skipStatus = 1 OR hh.StatusKey = @status)
      AND (@product IS NULL OR EXISTS (
            SELECT 1 FROM dbo.tbl_Dodtl d
            WHERE d.TransactionNo = hh.TransactionNo AND d.ItemCode = @product))
      AND (@cat IS NULL OR @skipCat = 1 OR EXISTS (
            SELECT 1 FROM dbo.tbl_Dodtl d
            JOIN Item i ON i.ItemCode = d.ItemCode
            WHERE d.TransactionNo = hh.TransactionNo
              AND COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') = @cat))
)
SELECT
    d.ItemCode,
    MAX(COALESCE(i.Description, d.ItemCode)) AS ItemName,
    MAX(COALESCE(NULLIF(LTRIM(RTRIM(i.MainUnits)), ''), '-')) AS Unit,
    MAX(COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-')) AS CategoryKey,
    COUNT(*) AS LineCount,
    SUM(COALESCE(d.Qty, 0)) AS Qty,
    SUM(COALESCE(d.Amount, 0)) AS Amount
FROM Qualified q
JOIN dbo.tbl_Dodtl d ON d.TransactionNo = q.TransactionNo
LEFT JOIN Item i ON i.ItemCode = d.ItemCode
WHERE (@product IS NULL OR d.ItemCode = @product)
  AND (@cat IS NULL OR @skipCat = 1
       OR COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') = @cat)
GROUP BY d.ItemCode
ORDER BY SUM(COALESCE(d.Qty, 0)) DESC, d.ItemCode ASC;
`;

/** Verbatim copy of `db/erp-queries/sales/do-by-customer.sql`. */
export const DO_BY_CUSTOMER_SQL = `-- erp-dashboards Phase 2 — Sales: quantity/amount rolled up PER CUSTOMER, PER UNIT.
--
-- READ-ONLY single statement through \`guardedQuery()\`; all filters are named parameters (E2).
-- Params identical to do-headers.sql / do-lines.sql.
--
-- GROUPED BY CustCode (the stable identity), never CustName — the data dictionary's explicit
-- drilldown caution. CustName is carried along for display only.
--
-- The \`Unit\` column is part of the GROUP BY on purpose: quantities must never be summed across
-- different MainUnits values (umbrella charter hard safety constraint), so one customer yields one
-- row per unit rather than a single collapsed cross-unit total.
WITH CanonicalItem AS (
    -- Highest-Roworder-wins tie-break: ItemCode is NOT unique in InventoryItem (composite PK).
    SELECT ItemCode, Description, MainUnits, ItemGRP,
           ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC) AS RowRank
    FROM dbo.InventoryItem
),
Item AS (
    SELECT ItemCode, Description, MainUnits, ItemGRP FROM CanonicalItem WHERE RowRank = 1
),
Hdr AS (
    SELECT h.TransactionNo, h.DoNo, h.Dodate, h.CustCode, h.CustName,
           CASE
               WHEN h.IsClosed = 1 THEN 'closed'
               WHEN h.IsApproved = 1 AND h.IsCheck = 1 THEN 'checked'
               WHEN h.IsApproved = 1 THEN 'approved'
               ELSE 'pending'
           END AS StatusKey
    FROM dbo.tbl_DOhdr h
),
Qualified AS (
    SELECT hh.TransactionNo, hh.DoNo, hh.Dodate, hh.CustCode, hh.CustName, hh.StatusKey
    FROM Hdr hh
    WHERE hh.Dodate >= @from
      AND hh.Dodate <= @to
      AND (@doNo IS NULL OR hh.DoNo = @doNo)
      AND (@customer IS NULL OR hh.CustCode = @customer)
      AND (@status IS NULL OR @skipStatus = 1 OR hh.StatusKey = @status)
      AND (@product IS NULL OR EXISTS (
            SELECT 1 FROM dbo.tbl_Dodtl d
            WHERE d.TransactionNo = hh.TransactionNo AND d.ItemCode = @product))
      AND (@cat IS NULL OR @skipCat = 1 OR EXISTS (
            SELECT 1 FROM dbo.tbl_Dodtl d
            JOIN Item i ON i.ItemCode = d.ItemCode
            WHERE d.TransactionNo = hh.TransactionNo
              AND COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') = @cat))
)
SELECT
    q.CustCode,
    MAX(q.CustName) AS CustName,
    COALESCE(NULLIF(LTRIM(RTRIM(i.MainUnits)), ''), '-') AS Unit,
    COUNT(*) AS LineCount,
    COUNT(DISTINCT q.DoNo) AS DoCount,
    SUM(COALESCE(d.Qty, 0)) AS Qty,
    SUM(COALESCE(d.Amount, 0)) AS Amount
FROM Qualified q
JOIN dbo.tbl_Dodtl d ON d.TransactionNo = q.TransactionNo
LEFT JOIN Item i ON i.ItemCode = d.ItemCode
WHERE (@product IS NULL OR d.ItemCode = @product)
  AND (@cat IS NULL OR @skipCat = 1
       OR COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') = @cat)
GROUP BY q.CustCode, COALESCE(NULLIF(LTRIM(RTRIM(i.MainUnits)), ''), '-')
ORDER BY q.CustCode ASC, Unit ASC;
`;

/** Verbatim copy of `db/erp-queries/sales/sales-invoice-excluded-total.sql`. */
export const SALES_INVOICE_EXCLUDED_TOTAL_SQL = `-- erp-dashboards Phase 2 — Sales: the UNFILTERED sales-invoice pool total.
--
-- FILENAME IS HISTORICAL. It was \`sales-invoice-excluded-total.sql\` when this pool was genuinely
-- outside the dashboard's money figure, and the name is kept because renaming a versioned query
-- file churns its TS mirror, its column contract and every importer for zero behavioural gain.
-- Read the name as "the whole-pool total", not as a claim that anything is left out.
--
-- READ-ONLY single statement through \`guardedQuery()\`. Takes no filter parameters on purpose.
--
-- WHAT CHANGED (sales-invoice-basis, 23-09-26): this money is no longer held back from anything.
-- The customer's own ERP team named \`sp_SalesInvoice\` as the source of truth for sales, so the
-- SalesInvoiceHdr pool IS the dashboard's primary figure now, and the delivery-order figures moved
-- to the secondary "การส่งมอบ" section. Deliveries carry the goods; invoices carry the money.
--
-- WHY THIS QUERY STILL EXISTS ALONGSIDE \`invoice-headers.sql\`: this one is UNCONDITIONAL — the
-- whole pool, every date — while \`invoice-headers.sql\` is bounded by the page's selected date
-- range. Two genuinely different shapes for two different callers: the manual live-reconcile
-- script needs the whole pool to check against the ERP's own reports, the dashboard needs the
-- filtered slice the user is looking at. Both scope on \`DocuType = 'SI'\`, so the filtered figure
-- is always a subset of this one and the two can never describe different document sets.
SELECT
    COUNT(*) AS InvoiceCount,
    COALESCE(SUM(h.TotalAmount), 0) AS ExcludedTotal
FROM dbo.SalesInvoiceHdr h
WHERE h.DocuType = 'SI';
`;

/** Constant name → source file, used by the sync gate. */
/** Verbatim copy of `db/erp-queries/sales/do-date-range.sql`. */
export const DO_DATE_RANGE_SQL = `-- ช่วงข้อมูล — Sales: what the ERP ACTUALLY holds, regardless of the page's date filter.
--
-- READ-ONLY: a single SELECT statement, executed ONLY through \`guardedQuery()\`.
--
-- TAKES NO PARAMETERS ON PURPOSE. This feeds the data-range notice at the top of the dashboard,
-- which answers "how much delivery-order history does the ERP have?" — NOT "what did my current
-- filter select?". Binding the page's @from/@to here would make the notice merely restate the
-- filter the user just set, which is the useless behaviour it replaces. Same reasoning, and the
-- same deliberate lack of filters, as \`sales-invoice-excluded-total.sql\`.
--
-- COUNTS EVERY HEADER, including ones the current status filter would hide: the notice describes
-- the data that exists, so dropping rows here would understate the real range.
--
-- MIN/MAX over a date column ignore NULLs and return NULL for an empty table; the app renders that
-- as "range not known" rather than inventing a date.
SELECT
    COUNT(*) AS DocCount,
    MIN(h.Dodate) AS FirstDate,
    MAX(h.Dodate) AS LastDate
FROM dbo.tbl_DOhdr h;
`;

/** Verbatim copy of `db/erp-queries/sales/invoice-headers.sql`. */
export const INVOICE_HEADERS_SQL = `-- erp-dashboards / sales-invoice-basis (23-09-26) — Sales: filtered SALES-INVOICE headers.
--
-- READ-ONLY: a single SELECT/WITH statement, executed ONLY through \`guardedQuery()\`.
-- PARAMETERIZED ONLY: every filter is a named parameter compared inside static SQL — no value is
-- ever concatenated into this text. Optional filters use the \`(@p IS NULL OR col = @p)\` form so ONE
-- static statement serves every filter combination.
--
-- WHY THIS EXISTS: the customer's own ERP team named \`sp_SalesInvoice\` as the source of truth for
-- sales ("PO : sp_Purchase — SO : sp_SalesInvoice — ที่นี่ไม่ทำ SO ไปดึงที่ Invoice"). Delivery orders
-- carry the GOODS; invoices carry the MONEY. This query backs the dashboard's PRIMARY money figure;
-- the delivery-order queries (\`do-*.sql\`) still back the secondary "การส่งมอบ" section, unchanged.
--
-- LIVE COLUMN NAMES — read them off the manifest, not off a data dictionary. The invoice number is
-- \`VoucherNo\`, its date is \`VoucherDate\`, and the customer is \`CustOrSuppCode\`/\`CustOrSuppName\`.
-- There is NO \`InvoiceNo\`, \`InvoiceDate\`, \`InvDate\` or \`CustCode\` column on \`dbo.SalesInvoiceHdr\`;
-- inventing one is the exact defect class that took every dashboard page down on 23-09-26.
--
-- DELIBERATE DIVERGENCE FROM \`sp_SalesInvoice\`: on live data that proc degenerates to every
-- header/line pair WHERE \`IsClosed = 0\`. This query filters on \`DocuType = 'SI'\` instead. Both are
-- no-ops on today's data (all 4 live invoices carry DocuType='SI' AND IsClosed=0), and \`DocuType\`
-- is the better filter for two reasons: it is NOT NULL live, whereas \`IsClosed\` is nullable and
-- \`IsClosed = 0\` would silently drop any future NULL row; and it is the SAME pool
-- \`sales-invoice-excluded-total.sql\` already reports, so that query stays the exact unfiltered
-- variant of this one rather than describing a different set of documents.
--
-- Params:
--   @from, @to        date range over SalesInvoiceHdr.VoucherDate (required)
--   @invoiceNo        single invoice drilldown (NULL = no restriction)
--   @customer         CustOrSuppCode — NEVER a customer NAME (codes are the stable identity)
--   @product          ItemCode; a header matches when ANY of its lines carries it
--   @cat              InventoryItem.ItemGRP category key ('-' = no group)
--   @skipCat          1 = ignore @cat
--
-- NO @status PARAMETER, on purpose: all four live invoices share identical flag values
-- (IsClosed=0, IsApproved=NULL, IVStatus=NULL), so an invoice status filter would have exactly one
-- possible value. The dashboard gives the invoice section no status filter and no status donut.
--
-- \`LineAmount\` is the NULL-SAFE line total (\`SUM(ISNULL(Amount,0))\`) and \`LineCount\` counts EVERY
-- line including the ones whose Amount is NULL: live invoice lines DO exist with a NULL Amount
-- (the partial DO-2608-0007 case), and such a line is still a real line that was shipped.
WITH CanonicalItem AS (
    -- Highest-Roworder-wins tie-break: ItemCode is NOT unique in InventoryItem (composite PK).
    SELECT ItemCode, ItemGRP,
           ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC) AS RowRank
    FROM dbo.InventoryItem
),
Item AS (
    SELECT ItemCode, ItemGRP FROM CanonicalItem WHERE RowRank = 1
),
Qualified AS (
    SELECT h.TransactionNo, h.VoucherNo, h.VoucherDate, h.CustOrSuppCode, h.CustOrSuppName,
           h.TotalAmount
    FROM dbo.SalesInvoiceHdr h
    WHERE h.DocuType = 'SI'
      AND h.VoucherDate >= @from
      AND h.VoucherDate <= @to
      AND (@invoiceNo IS NULL OR h.VoucherNo = @invoiceNo)
      AND (@customer IS NULL OR h.CustOrSuppCode = @customer)
      AND (@product IS NULL OR EXISTS (
            SELECT 1 FROM dbo.SalesInvoiceDtl d
            WHERE d.TransactionNo = h.TransactionNo AND d.ItemCode = @product))
      AND (@cat IS NULL OR @skipCat = 1 OR EXISTS (
            SELECT 1 FROM dbo.SalesInvoiceDtl d
            JOIN Item i ON i.ItemCode = d.ItemCode
            WHERE d.TransactionNo = h.TransactionNo
              AND COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') = @cat))
)
SELECT
    q.TransactionNo,
    q.VoucherNo                       AS InvoiceNo,
    q.VoucherDate                     AS InvDate,
    q.CustOrSuppCode                  AS CustCode,
    q.CustOrSuppName                  AS CustName,
    COALESCE(q.TotalAmount, 0)        AS Amount,
    (SELECT COUNT(*) FROM dbo.SalesInvoiceDtl d
      WHERE d.TransactionNo = q.TransactionNo) AS LineCount,
    (SELECT COALESCE(SUM(COALESCE(d.Amount, 0)), 0) FROM dbo.SalesInvoiceDtl d
      WHERE d.TransactionNo = q.TransactionNo) AS LineAmount
FROM Qualified q
ORDER BY q.VoucherDate DESC, q.VoucherNo DESC;
`;

/** Verbatim copy of `db/erp-queries/sales/invoice-lines.sql`. */
export const INVOICE_LINES_SQL = `-- erp-dashboards / sales-invoice-basis (23-09-26) — Sales: SALES-INVOICE lines.
--
-- READ-ONLY single statement through \`guardedQuery()\`; every filter is a named parameter (no value
-- is concatenated into this text). Params identical to \`invoice-headers.sql\`.
--
-- THE UNIT LABEL COMES FROM THE LINE (\`d.MainUnits\`), NEVER FROM THE ITEM MASTER. This is a hard
-- rule of this program, and a mistake already made and fixed once: an invoice line records the unit
-- it was actually sold in, which may differ from \`InventoryItem.MainUnits\`. The item master is
-- joined here ONLY for the category code, never for the unit and never for the quantity.
--
-- \`Amount\` IS NULL ON REAL LIVE LINES (the partial DO-2608-0007 invoice line). It is COALESCEd to 0
-- for display and arithmetic, but the line itself is never filtered out — a priced-zero line is
-- still a line that shipped goods, and dropping it would understate both the quantity and the
-- line count.
--
-- \`OrderNo\` is the delivery order this invoice line came from (live: 100% of invoice lines carry
-- one, prefix \`DO-2\`), which is how the invoice section and the delivery section relate.
WITH CanonicalItem AS (
    -- Highest-Roworder-wins tie-break: ItemCode is NOT unique in InventoryItem (composite PK).
    SELECT ItemCode, ItemGRP,
           ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC) AS RowRank
    FROM dbo.InventoryItem
),
Item AS (
    SELECT ItemCode, ItemGRP FROM CanonicalItem WHERE RowRank = 1
),
ItemGroup AS (
    -- The ERP's own category master; collapsed by code so a duplicate can never fan a line out.
    SELECT LTRIM(RTRIM(ICCode)) AS GroupCode, MAX(LTRIM(RTRIM(Description))) AS GroupName
    FROM dbo.tbl_ItemGroup
    WHERE NULLIF(LTRIM(RTRIM(ICCode)), '') IS NOT NULL
    GROUP BY LTRIM(RTRIM(ICCode))
),
Qualified AS (
    SELECT h.TransactionNo, h.VoucherNo, h.VoucherDate, h.CustOrSuppCode, h.CustOrSuppName
    FROM dbo.SalesInvoiceHdr h
    WHERE h.DocuType = 'SI'
      AND h.VoucherDate >= @from
      AND h.VoucherDate <= @to
      AND (@invoiceNo IS NULL OR h.VoucherNo = @invoiceNo)
      AND (@customer IS NULL OR h.CustOrSuppCode = @customer)
      AND (@product IS NULL OR EXISTS (
            SELECT 1 FROM dbo.SalesInvoiceDtl d
            WHERE d.TransactionNo = h.TransactionNo AND d.ItemCode = @product))
      AND (@cat IS NULL OR @skipCat = 1 OR EXISTS (
            SELECT 1 FROM dbo.SalesInvoiceDtl d
            JOIN Item i ON i.ItemCode = d.ItemCode
            WHERE d.TransactionNo = h.TransactionNo
              AND COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') = @cat))
)
SELECT
    q.VoucherNo                                            AS InvoiceNo,
    q.VoucherDate                                          AS InvDate,
    q.CustOrSuppCode                                       AS CustCode,
    q.CustOrSuppName                                       AS CustName,
    d.RowOrder,
    d.ItemOrder,
    d.ItemCode,
    COALESCE(NULLIF(LTRIM(RTRIM(d.Description)), ''), d.ItemCode) AS ItemName,
    -- THE LINE'S OWN UNIT. Never \`i.MainUnits\`.
    COALESCE(NULLIF(LTRIM(RTRIM(d.MainUnits)), ''), '-')   AS Unit,
    COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-')     AS CategoryKey,
    g.GroupName                                            AS CategoryLabel,
    COALESCE(d.MainQuantity, 0)                            AS Qty,
    COALESCE(d.UnitPrice, 0)                               AS UnitPrice,
    COALESCE(d.Amount, 0)                                  AS Amount,
    d.OrderNo
FROM Qualified q
JOIN dbo.SalesInvoiceDtl d ON d.TransactionNo = q.TransactionNo
LEFT JOIN Item i ON i.ItemCode = d.ItemCode
LEFT JOIN ItemGroup g ON g.GroupCode = LTRIM(RTRIM(i.ItemGRP))
WHERE (@product IS NULL OR d.ItemCode = @product)
  AND (@cat IS NULL OR @skipCat = 1
       OR COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') = @cat)
ORDER BY q.VoucherDate DESC, q.VoucherNo DESC, d.ItemOrder ASC;
`;

/** Verbatim copy of `db/erp-queries/sales/invoice-by-product.sql`. */
export const INVOICE_BY_PRODUCT_SQL = `-- erp-dashboards / sales-invoice-basis (23-09-26) — Sales: invoice quantity/amount PER PRODUCT.
--
-- READ-ONLY single statement through \`guardedQuery()\`; all filters are named parameters.
-- Params identical to \`invoice-headers.sql\` / \`invoice-lines.sql\`.
--
-- The canonical-item CTE below is the PROVEN pattern copied from \`do-by-product.sql\`, not
-- re-derived: \`ItemCode\` is NOT unique in \`InventoryItem\` (~85 duplicated codes live), so a
-- highest-\`Roworder\`-wins \`ROW_NUMBER()\` resolves exactly ONE row per code before joining. It is
-- used ONLY for the CATEGORY code.
--
-- GROUPED BY (ItemCode, THE LINE'S OWN UNIT). Two reasons, both hard rules of this program:
--   * the unit label must come from \`SalesInvoiceDtl.MainUnits\`, never the item master;
--   * quantities must NEVER be summed across different units, so the unit is part of the group key
--     rather than an aggregate picked with MAX(). If one product were ever sold in two units, this
--     query returns two rows instead of one arithmetically meaningless total.
--
-- NULL \`Amount\` lines are counted and contribute 0 — never dropped.
WITH CanonicalItem AS (
    SELECT ItemCode, ItemGRP,
           ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC) AS RowRank
    FROM dbo.InventoryItem
),
Item AS (
    SELECT ItemCode, ItemGRP FROM CanonicalItem WHERE RowRank = 1
),
Qualified AS (
    SELECT h.TransactionNo
    FROM dbo.SalesInvoiceHdr h
    WHERE h.DocuType = 'SI'
      AND h.VoucherDate >= @from
      AND h.VoucherDate <= @to
      AND (@invoiceNo IS NULL OR h.VoucherNo = @invoiceNo)
      AND (@customer IS NULL OR h.CustOrSuppCode = @customer)
      AND (@product IS NULL OR EXISTS (
            SELECT 1 FROM dbo.SalesInvoiceDtl d
            WHERE d.TransactionNo = h.TransactionNo AND d.ItemCode = @product))
      AND (@cat IS NULL OR @skipCat = 1 OR EXISTS (
            SELECT 1 FROM dbo.SalesInvoiceDtl d
            JOIN Item i ON i.ItemCode = d.ItemCode
            WHERE d.TransactionNo = h.TransactionNo
              AND COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') = @cat))
)
SELECT
    d.ItemCode,
    MAX(COALESCE(NULLIF(LTRIM(RTRIM(d.Description)), ''), d.ItemCode)) AS ItemName,
    COALESCE(NULLIF(LTRIM(RTRIM(d.MainUnits)), ''), '-') AS Unit,
    MAX(COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-')) AS CategoryKey,
    COUNT(*) AS LineCount,
    SUM(COALESCE(d.MainQuantity, 0)) AS Qty,
    SUM(COALESCE(d.Amount, 0)) AS Amount
FROM Qualified q
JOIN dbo.SalesInvoiceDtl d ON d.TransactionNo = q.TransactionNo
LEFT JOIN Item i ON i.ItemCode = d.ItemCode
WHERE (@product IS NULL OR d.ItemCode = @product)
  AND (@cat IS NULL OR @skipCat = 1
       OR COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') = @cat)
GROUP BY d.ItemCode, COALESCE(NULLIF(LTRIM(RTRIM(d.MainUnits)), ''), '-')
ORDER BY SUM(COALESCE(d.Amount, 0)) DESC, d.ItemCode ASC;
`;

/** Verbatim copy of `db/erp-queries/sales/invoice-by-customer.sql`. */
export const INVOICE_BY_CUSTOMER_SQL = `-- erp-dashboards / sales-invoice-basis (23-09-26) — Sales: invoice totals PER CUSTOMER.
--
-- READ-ONLY single statement through \`guardedQuery()\`; all filters are named parameters.
-- Params identical to \`invoice-headers.sql\`.
--
-- THE CUSTOMER COMES FROM THE HEADER (\`SalesInvoiceHdr.CustOrSuppCode\`), NOT FROM THE LINE.
-- \`SalesInvoiceDtl\` does carry its own \`CustOrSuppCode\` column, but an invoice document has exactly
-- ONE customer, recorded on the header — the per-line copy is a derived duplicate with no
-- authority. Grouping by the line column would be reading a shadow of the real value.
--
-- The CODE is the group key and the identity; the NAME is display-only and may be missing, exactly
-- as in \`do-by-customer.sql\`.
--
-- Grouped by (customer, THE LINE'S OWN UNIT) so quantities are never summed across units.
WITH CanonicalItem AS (
    SELECT ItemCode, ItemGRP,
           ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY Roworder DESC) AS RowRank
    FROM dbo.InventoryItem
),
Item AS (
    SELECT ItemCode, ItemGRP FROM CanonicalItem WHERE RowRank = 1
),
Qualified AS (
    SELECT h.TransactionNo, h.CustOrSuppCode, h.CustOrSuppName
    FROM dbo.SalesInvoiceHdr h
    WHERE h.DocuType = 'SI'
      AND h.VoucherDate >= @from
      AND h.VoucherDate <= @to
      AND (@invoiceNo IS NULL OR h.VoucherNo = @invoiceNo)
      AND (@customer IS NULL OR h.CustOrSuppCode = @customer)
      AND (@product IS NULL OR EXISTS (
            SELECT 1 FROM dbo.SalesInvoiceDtl d
            WHERE d.TransactionNo = h.TransactionNo AND d.ItemCode = @product))
      AND (@cat IS NULL OR @skipCat = 1 OR EXISTS (
            SELECT 1 FROM dbo.SalesInvoiceDtl d
            JOIN Item i ON i.ItemCode = d.ItemCode
            WHERE d.TransactionNo = h.TransactionNo
              AND COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') = @cat))
)
SELECT
    q.CustOrSuppCode AS CustCode,
    MAX(q.CustOrSuppName) AS CustName,
    COALESCE(NULLIF(LTRIM(RTRIM(d.MainUnits)), ''), '-') AS Unit,
    COUNT(*) AS LineCount,
    COUNT(DISTINCT q.TransactionNo) AS InvoiceCount,
    SUM(COALESCE(d.MainQuantity, 0)) AS Qty,
    SUM(COALESCE(d.Amount, 0)) AS Amount
FROM Qualified q
JOIN dbo.SalesInvoiceDtl d ON d.TransactionNo = q.TransactionNo
LEFT JOIN Item i ON i.ItemCode = d.ItemCode
WHERE (@product IS NULL OR d.ItemCode = @product)
  AND (@cat IS NULL OR @skipCat = 1
       OR COALESCE(NULLIF(LTRIM(RTRIM(i.ItemGRP)), ''), '-') = @cat)
GROUP BY q.CustOrSuppCode, COALESCE(NULLIF(LTRIM(RTRIM(d.MainUnits)), ''), '-')
ORDER BY q.CustOrSuppCode ASC, Unit ASC;
`;

/** Verbatim copy of `db/erp-queries/sales/invoice-date-range.sql`. */
export const INVOICE_DATE_RANGE_SQL = `-- ช่วงข้อมูล — Sales (invoice basis): what the ERP ACTUALLY holds, regardless of the page's filter.
--
-- READ-ONLY: a single SELECT statement, executed ONLY through \`guardedQuery()\`.
--
-- TAKES NO PARAMETERS ON PURPOSE, exactly like \`do-date-range.sql\`: this feeds the data-range
-- notice, which answers "how much sales-invoice history does the ERP have?" — NOT "what did my
-- current filter select?". Binding the page's @from/@to here would make the notice merely restate
-- the filter the user just set.
--
-- LIVE COLUMN NAMES: the date is \`VoucherDate\` — there is no \`InvDate\`/\`InvoiceDate\` column on
-- \`dbo.SalesInvoiceHdr\`. \`DocuType = 'SI'\` scopes it to the same pool every other invoice query
-- reports, so the notice and the figures can never describe different document sets.
--
-- MIN/MAX over a date column ignore NULLs and return NULL for an empty table; the app renders that
-- as "range not known" rather than inventing a date.
SELECT
    COUNT(*) AS DocCount,
    MIN(h.VoucherDate) AS FirstDate,
    MAX(h.VoucherDate) AS LastDate
FROM dbo.SalesInvoiceHdr h
WHERE h.DocuType = 'SI';
`;

export const SALES_SQL_SOURCES: ReadonlyArray<{ name: string; file: string; sql: string }> = [
  { name: "DO_HEADERS_SQL", file: "db/erp-queries/sales/do-headers.sql", sql: DO_HEADERS_SQL },
  { name: "DO_LINES_SQL", file: "db/erp-queries/sales/do-lines.sql", sql: DO_LINES_SQL },
  { name: "DO_BY_PRODUCT_SQL", file: "db/erp-queries/sales/do-by-product.sql", sql: DO_BY_PRODUCT_SQL },
  { name: "DO_BY_CUSTOMER_SQL", file: "db/erp-queries/sales/do-by-customer.sql", sql: DO_BY_CUSTOMER_SQL },
  { name: "SALES_INVOICE_EXCLUDED_TOTAL_SQL", file: "db/erp-queries/sales/sales-invoice-excluded-total.sql", sql: SALES_INVOICE_EXCLUDED_TOTAL_SQL },
  { name: "DO_DATE_RANGE_SQL", file: "db/erp-queries/sales/do-date-range.sql", sql: DO_DATE_RANGE_SQL },
  { name: "INVOICE_HEADERS_SQL", file: "db/erp-queries/sales/invoice-headers.sql", sql: INVOICE_HEADERS_SQL },
  { name: "INVOICE_LINES_SQL", file: "db/erp-queries/sales/invoice-lines.sql", sql: INVOICE_LINES_SQL },
  { name: "INVOICE_BY_PRODUCT_SQL", file: "db/erp-queries/sales/invoice-by-product.sql", sql: INVOICE_BY_PRODUCT_SQL },
  { name: "INVOICE_BY_CUSTOMER_SQL", file: "db/erp-queries/sales/invoice-by-customer.sql", sql: INVOICE_BY_CUSTOMER_SQL },
  { name: "INVOICE_DATE_RANGE_SQL", file: "db/erp-queries/sales/invoice-date-range.sql", sql: INVOICE_DATE_RANGE_SQL },
];
