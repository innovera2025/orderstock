/* ============================================================================
   orderstock — Database, Login & Permissions bootstrap script (Phase 06, C2)
   ----------------------------------------------------------------------------
   Hand-authored companion to `create-orderstock-schema.sql` (Prisma does NOT
   generate database/login/permission DDL).

   RUN ORDER (in SSMS or sqlcmd, as a sysadmin login e.g. `sa`):
     1. THIS script  (create-database-and-login.sql)  ← creates DB + login + user
     2. THEN         (create-orderstock-schema.sql)   ← creates the tables, run
                                                          WITH the [db_TCL] DB
                                                          selected (USE [db_TCL]).
   NOTE: the database is named [db_TCL] (customer production DB); the schema file is still
   named create-orderstock-schema.sql (filename kept to avoid churn — the DB-name/file-name
   mismatch is intentional; see docs/deployment-guide-docker.md).

   SECURITY: the CREATE LOGIN password below is a PLACEHOLDER. Replace it with a
   strong password BEFORE running, and store the real value only in the app's
   `.env` (DATABASE_URL) — never commit it. See docs/deployment-guide.md.

   COMPATIBILITY: this script assumes SQL Server 2017+ (Prisma 7 support floor).
   The customer's exact version is UNCONFIRMED — see the COMPATIBILITY_LEVEL TODO
   below and confirm before finalizing.
   ============================================================================ */

/* ------------------------------------------------------------------ 1. DATABASE */
IF DB_ID(N'db_TCL') IS NULL
BEGIN
    /* COLLATE note: the app stores Thai text (shop/product names). SQL Server
       stores Thai in NVARCHAR regardless of collation, so the DB-level collation
       affects sort/compare order only, not storage correctness. Thai_CI_AS gives
       Thai-aware, case-insensitive, accent-sensitive ordering. If the customer's
       server default already suits them, the COLLATE clause may be omitted. */
    CREATE DATABASE [db_TCL]
        COLLATE Thai_CI_AS;
END
GO

/* TODO — REQUIRED-INPUT (customer SQL Server version UNCONFIRMED): set the
   compatibility level to match the target server. Replace __PLACEHOLDER_COMPAT_LEVEL__
   with one of: 140 = SQL Server 2017, 150 = SQL Server 2019, 160 = SQL Server 2022.
   Prisma 7 requires 2017+ (level >= 140). Uncomment and set the correct value once the
   customer confirms their version (SELECT SERVERPROPERTY('ProductVersion')).

   ALTER DATABASE [db_TCL] SET COMPATIBILITY_LEVEL = __PLACEHOLDER_COMPAT_LEVEL__;
*/
GO

/* ------------------------------------------------------------------ 2. LOGIN */
/* Server-level login. Replace the PLACEHOLDER password before running.
   Password policy: SQL Server enforces Windows complexity by default (8+ chars,
   3 of 4 categories: upper/lower/digit/symbol). */
IF SUSER_ID(N'orderstock_app') IS NULL
BEGIN
    CREATE LOGIN [orderstock_app]
        WITH PASSWORD = N'REPLACE_WITH_A_STRONG_PASSWORD',  -- PLACEHOLDER — do not ship as-is
             DEFAULT_DATABASE = [db_TCL],
             CHECK_POLICY = ON;
END
GO

/* ------------------------------------------------------------------ 3. USER */
USE [db_TCL];
GO
IF USER_ID(N'orderstock_app') IS NULL
BEGIN
    CREATE USER [orderstock_app] FOR LOGIN [orderstock_app];
END
GO

/* ------------------------------------------------------------------ 4. GRANTS */
/* INITIAL SETUP (recommended for the migration/first run): db_owner lets the app
   user create the schema via `create-orderstock-schema.sql`. */
ALTER ROLE [db_owner] ADD MEMBER [orderstock_app];
GO

/* LEAST-PRIVILEGE ALTERNATIVE (optional hardening AFTER the schema exists):
   drop db_owner and grant only CRUD. Uncomment to switch once tables are created.

   ALTER ROLE [db_owner] DROP MEMBER [orderstock_app];
   ALTER ROLE [db_datareader] ADD MEMBER [orderstock_app];
   ALTER ROLE [db_datawriter] ADD MEMBER [orderstock_app];
   -- The app performs no DDL at runtime, so datareader + datawriter is sufficient
   -- for normal operation; re-grant db_owner only when applying a future migration.
*/
GO

PRINT N'db_TCL: database, login, user and grants are ready. Next: run create-orderstock-schema.sql against [db_TCL].';
GO
