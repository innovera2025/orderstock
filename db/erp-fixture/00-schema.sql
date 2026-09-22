-- ============================================================================================
-- ERP-SHAPED FIXTURE DATABASE — LOCAL SANDBOX ONLY
-- erp-dashboards Phase 1 (ERP read foundation), base/shared DDL.
--
-- *** NEVER RUN THIS AGAINST db_TCL OR ANY CUSTOMER SERVER. ***
-- This script CREATEs a database and a table. It is a disposable local dev/test fixture, run
-- ONLY against the local `orderstock-sql` Docker container (localhost:1433). The customer's ERP
-- database db_TCL is strictly read-only to this project; no DDL, no writes, ever.
--
-- It is also deliberately NOT part of prisma/migrations: `erp_fixture` is a SEPARATE database
-- from the Prisma-managed `orderstock` sandbox database, and no ERP table ever enters
-- prisma/schema.prisma.
--
-- Apply (from the repo root, with the sandbox container running):
--   docker exec -i orderstock-sql /opt/mssql-tools18/bin/sqlcmd \
--     -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -i /dev/stdin < db/erp-fixture/00-schema.sql
--
-- Drop and recreate freely: DROP DATABASE erp_fixture;  (local sandbox only)
-- Idempotent: safe to re-run.
-- ============================================================================================

IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = 'erp_fixture')
BEGIN
    CREATE DATABASE erp_fixture;
END
GO

USE erp_fixture;
GO

-- dbo.InventoryItem — the universal item master every ERP dashboard domain joins against
-- (Sales, Purchase, Production). Phase 1 seeds only the subset of real columns its own guard /
-- health / cache / data-table proof needs. Phase 2/3/4 add their own DOMAIN fixture tables in
-- their own seed files; they never edit this base file.
--
-- NOTE for later phases: in the REAL ERP, InventoryItem's primary key is composite
-- (Roworder, ItemCode) — ItemCode alone is NOT unique. This fixture keeps Roworder so the
-- composite shape and the Roworder tie-break rule are representable.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'InventoryItem'
)
BEGIN
    CREATE TABLE dbo.InventoryItem (
        Roworder    INT            NOT NULL,
        ItemCode    NVARCHAR(50)   NOT NULL,
        Description NVARCHAR(200)  NULL,
        MainUnits   NVARCHAR(20)   NULL,
        ItemGRP     CHAR(1)        NULL,
        CONSTRAINT PK_InventoryItem PRIMARY KEY (Roworder, ItemCode)
    );
END
GO
