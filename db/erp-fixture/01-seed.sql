-- ============================================================================================
-- ERP-SHAPED FIXTURE SEED — LOCAL SANDBOX ONLY
-- erp-dashboards Phase 1, base/shared rows for dbo.InventoryItem.
--
-- *** NEVER RUN THIS AGAINST db_TCL OR ANY CUSTOMER SERVER. ***
-- This script WRITES rows. It is a disposable local dev/test fixture for the `erp_fixture`
-- database inside the local `orderstock-sql` container only. Because it writes, it is by design
-- NOT executed through the application's read-only guard (`guardedQuery`) — it is a human/CI
-- setup step run directly against the sandbox with sqlcmd, never through app code.
--
-- Apply (after 00-schema.sql, sandbox container running):
--   docker exec -i orderstock-sql /opt/mssql-tools18/bin/sqlcmd \
--     -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -i /dev/stdin < db/erp-fixture/01-seed.sql
--
-- Idempotent: rows are inserted only when the (Roworder, ItemCode) key is absent, so re-running
-- neither duplicates nor overwrites.
-- ============================================================================================

USE erp_fixture;
GO

-- 10 rows: a mix of ItemGRP='F' (finished goods) and non-'F' (raw material), several distinct
-- MainUnits values, and one row with a NULL MainUnits. The NULL row exists on purpose: real ERP
-- data has ~35 distinct units and quantities must never be summed across units, so every fixture
-- set should keep a null-unit row present to force null-safe handling in later phases.
;WITH SeedRows AS (
    SELECT * FROM (VALUES
        (1,  N'FG-1001', N'ตีนิ่ม A 1 กก.',        N'KG',   'F'),
        (2,  N'FG-1002', N'ตีนิ่ม 1 กก.',          N'KG',   'F'),
        (3,  N'FG-1003', N'ตีดาว 1/2 กก.',         N'KG',   'F'),
        (4,  N'FG-1004', N'กรวด 1 กก.',            N'KG',   'F'),
        (5,  N'FG-1005', N'รอง 1 กก.',             N'BAG',  'F'),
        (6,  N'FG-1006', N'ตีลานนิ่ม 1 กก.',       NULL,    'F'),
        (7,  N'RM-2001', N'น้ำปลา',                 N'LITRE','R'),
        (8,  N'RM-2002', N'น้ำตาล',                 N'KG',   'R'),
        (9,  N'RM-2003', N'น้ำมัน',                 N'LITRE','R'),
        (10, N'PK-3001', N'ปี๊บเปล่า',              N'PCS',  'P')
    ) AS v (Roworder, ItemCode, Description, MainUnits, ItemGRP)
)
INSERT INTO dbo.InventoryItem (Roworder, ItemCode, Description, MainUnits, ItemGRP)
SELECT s.Roworder, s.ItemCode, s.Description, s.MainUnits, s.ItemGRP
FROM SeedRows AS s
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.InventoryItem AS t
    WHERE t.Roworder = s.Roworder AND t.ItemCode = s.ItemCode
);
GO

SELECT COUNT(*) AS InventoryItemRowCount FROM dbo.InventoryItem;
GO
