import { describe, it, expect, vi } from "vitest";
import type { ConnectionPool } from "mssql";
import {
  assertReadOnlySql,
  normalizeSqlForGuard,
  guardedQuery,
  verifyReadOnlyBoot,
  FORBIDDEN_KEYWORDS,
  ReadOnlySqlViolationError,
  ErpWritePermissionError,
  PERMISSION_PROBE_SQL,
  type ErpPermissionRow,
} from "../erp/erp-adapter";

// erp-dashboards Phase 1 — gates AC17-denylist, AC17-order, AC18-mock, READONLY-boot-mock.
//
// This suite is the automated proof that a write statement can never reach the customer's ERP.
// It exercises the guard's LOGIC only: no real SQL Server connection is opened anywhere in this
// file, and db_TCL is never contacted.

/** Build a minimal mocked `mssql` pool that records what reached it. */
function mockPool(recordset: unknown[] = []) {
  const input = vi.fn();
  const query = vi.fn().mockResolvedValue({ recordset });
  const request = vi.fn(() => ({ input, query }));
  return { pool: { request } as unknown as ConnectionPool, request, input, query };
}

// ------------------------------------------------------------------------------------------
// Layer 2 — forbidden-keyword denylist (19 rules ported from the sibling implementation)
// ------------------------------------------------------------------------------------------

describe("assertReadOnlySql — forbidden-keyword matrix", () => {
  // One case per keyword rule. Each SQL below starts with SELECT so ONLY the keyword rule can
  // be what rejects it — proving the denylist itself fires, not the start-token rule.
  const keywordCases: { label: string; sql: string }[] = [
    { label: "INSERT", sql: "SELECT 1 WHERE 1=0 INSERT dbo.T VALUES (1)" },
    { label: "UPDATE", sql: "SELECT 1 WHERE 1=0 UPDATE dbo.T SET a=1" },
    { label: "DELETE", sql: "SELECT 1 WHERE 1=0 DELETE FROM dbo.T" },
    { label: "MERGE", sql: "SELECT 1 WHERE 1=0 MERGE dbo.T AS x" },
    { label: "TRUNCATE", sql: "SELECT 1 WHERE 1=0 TRUNCATE TABLE dbo.T" },
    { label: "DROP", sql: "SELECT 1 WHERE 1=0 DROP TABLE dbo.T" },
    { label: "ALTER", sql: "SELECT 1 WHERE 1=0 ALTER TABLE dbo.T" },
    { label: "CREATE", sql: "SELECT 1 WHERE 1=0 CREATE TABLE dbo.T (a INT)" },
    { label: "GRANT", sql: "SELECT 1 WHERE 1=0 GRANT SELECT ON dbo.T" },
    { label: "REVOKE", sql: "SELECT 1 WHERE 1=0 REVOKE SELECT ON dbo.T" },
    { label: "EXEC/EXECUTE", sql: "SELECT 1 WHERE 1=0 EXEC dbo.SomeProc" },
    { label: "sp_executesql", sql: "SELECT 1 WHERE 1=0 sp_executesql N'x'" },
    { label: "xp_cmdshell", sql: "SELECT 1 WHERE 1=0 xp_cmdshell 'dir'" },
    { label: "BULK", sql: "SELECT 1 WHERE 1=0 BULK LOAD dbo.T" },
    { label: "OPENROWSET", sql: "SELECT a FROM OPENROWSET('x','y','z')" },
    { label: "INTO", sql: "SELECT a INTO dbo.NewTable FROM dbo.T" },
    { label: "BACKUP", sql: "SELECT 1 WHERE 1=0 BACKUP DATABASE db_TCL" },
    { label: "RESTORE", sql: "SELECT 1 WHERE 1=0 RESTORE DATABASE db_TCL" },
    { label: "SHUTDOWN", sql: "SELECT 1 WHERE 1=0 SHUTDOWN" },
  ];

  it("covers exactly the 19 ported keyword rules", () => {
    expect(FORBIDDEN_KEYWORDS).toHaveLength(19);
    expect(keywordCases).toHaveLength(19);
    expect(keywordCases.map((c) => c.label)).toEqual(FORBIDDEN_KEYWORDS.map((k) => k.label));
  });

  for (const { label, sql } of keywordCases) {
    it(`rejects ${label}`, () => {
      expect(() => assertReadOnlySql(sql)).toThrow(ReadOnlySqlViolationError);
      try {
        assertReadOnlySql(sql);
      } catch (error) {
        const violation = error as ReadOnlySqlViolationError;
        expect(violation.violation).toBe("FORBIDDEN_KEYWORD");
        expect(violation.keyword).toBe(label);
      }
    });
  }

  it("is case-insensitive (InSeRt is still rejected)", () => {
    expect(() => assertReadOnlySql("SELECT 1 WHERE 1=0 InSeRt dbo.T VALUES (1)")).toThrow(
      ReadOnlySqlViolationError,
    );
  });

  it("also rejects EXECUTE spelled in full", () => {
    expect(() => assertReadOnlySql("SELECT 1 WHERE 1=0 EXECUTE dbo.SomeProc")).toThrow(
      /EXEC\/EXECUTE/,
    );
  });
});

// ------------------------------------------------------------------------------------------
// Layer 2 — statement-shape rules
// ------------------------------------------------------------------------------------------

describe("assertReadOnlySql — statement shape", () => {
  it("rejects an empty string", () => {
    expect(() => assertReadOnlySql("")).toThrow(/violation=EMPTY_STATEMENT/);
  });

  it("rejects a whitespace-only string", () => {
    expect(() => assertReadOnlySql("   \n\t  ")).toThrow(/violation=EMPTY_STATEMENT/);
  });

  it("rejects a comment-only statement", () => {
    expect(() => assertReadOnlySql("-- just a comment\n/* and a block */")).toThrow(
      /violation=EMPTY_STATEMENT/,
    );
  });

  it("rejects a statement starting with DECLARE", () => {
    expect(() => assertReadOnlySql("DECLARE @x INT; SELECT @x")).toThrow(
      /violation=NOT_SELECT_OR_WITH/,
    );
  });

  it("rejects a statement starting with EXEC", () => {
    expect(() => assertReadOnlySql("EXEC dbo.SomeProc")).toThrow(/violation=NOT_SELECT_OR_WITH/);
  });

  it("rejects a statement starting with SET NOCOUNT ON", () => {
    expect(() => assertReadOnlySql("SET NOCOUNT ON SELECT 1")).toThrow(
      /violation=NOT_SELECT_OR_WITH/,
    );
  });

  it("rejects stacked statements separated by a mid-statement semicolon", () => {
    expect(() => assertReadOnlySql("SELECT 1; SELECT 2")).toThrow(
      /violation=MULTIPLE_STATEMENTS/,
    );
  });

  it("rejects an unterminated string literal", () => {
    expect(() => assertReadOnlySql("SELECT 'abc FROM dbo.T")).toThrow(
      /violation=UNTERMINATED_STRING/,
    );
  });

  it("rejects an unterminated block comment", () => {
    expect(() => assertReadOnlySql("SELECT 1 /* never closed")).toThrow(
      /violation=UNTERMINATED_COMMENT/,
    );
  });

  it("allows a single trailing semicolon", () => {
    expect(() => assertReadOnlySql("SELECT 1 AS ok;")).not.toThrow();
  });

  it("allows a plain SELECT", () => {
    expect(() =>
      assertReadOnlySql("SELECT ItemCode, Description FROM dbo.InventoryItem"),
    ).not.toThrow();
  });

  it("allows a WITH (CTE) statement", () => {
    expect(() =>
      assertReadOnlySql(
        "WITH Recent AS (SELECT TOP (10) ItemCode FROM dbo.InventoryItem ORDER BY Roworder DESC) SELECT * FROM Recent",
      ),
    ).not.toThrow();
  });

  it("allows a parameterized SELECT with a named parameter", () => {
    expect(() =>
      assertReadOnlySql("SELECT ItemCode FROM dbo.InventoryItem WHERE ItemGRP = @grp"),
    ).not.toThrow();
  });

  it("allows leading whitespace/comments before a valid SELECT", () => {
    expect(() =>
      assertReadOnlySql("-- item lookup\n  /* block */ SELECT ItemCode FROM dbo.InventoryItem"),
    ).not.toThrow();
  });
});

// ------------------------------------------------------------------------------------------
// Layer 1 — the normalizer is what stops false positives and literal-smuggling
// ------------------------------------------------------------------------------------------

describe("normalizeSqlForGuard — false-positive and smuggling defense", () => {
  it("does NOT false-positive on a column named update_flag (word boundary)", () => {
    expect(() =>
      assertReadOnlySql("SELECT update_flag, delete_flag FROM dbo.InventoryItem"),
    ).not.toThrow();
  });

  it("does NOT false-positive on a bracketed identifier like [Update Date]", () => {
    expect(() => assertReadOnlySql("SELECT [Update Date] FROM dbo.InventoryItem")).not.toThrow();
  });

  it("does NOT false-positive on a forbidden word inside a string literal", () => {
    expect(() =>
      assertReadOnlySql("SELECT ItemCode FROM dbo.InventoryItem WHERE Description = 'DROP TABLE'"),
    ).not.toThrow();
  });

  it("masks string-literal content so it cannot smuggle a semicolon", () => {
    expect(() =>
      assertReadOnlySql("SELECT ItemCode FROM dbo.InventoryItem WHERE Description = 'a; b'"),
    ).not.toThrow();
  });

  it("strips a leading BOM so a BOM-prefixed SELECT still passes", () => {
    expect(() => assertReadOnlySql("﻿SELECT 1 AS ok")).not.toThrow();
  });

  it("collapses comments and whitespace into a single normalized statement", () => {
    expect(normalizeSqlForGuard("SELECT   1 -- trailing\n  AS ok")).toBe("SELECT 1 AS ok");
  });
});

// ------------------------------------------------------------------------------------------
// Layer 3 — guardedQuery ordering + parameterization (the structural enforcement)
// ------------------------------------------------------------------------------------------

describe("guardedQuery — the single choke point", () => {
  it("calls assertReadOnlySql BEFORE executing against the pool", async () => {
    const { pool, request, query } = mockPool();
    await expect(guardedQuery(pool, "DELETE FROM dbo.InventoryItem")).rejects.toThrow(
      ReadOnlySqlViolationError,
    );
    // The forbidden statement never reached the connection at all.
    expect(request).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("never touches the pool for any forbidden keyword", async () => {
    const { pool, request } = mockPool();
    for (const rule of FORBIDDEN_KEYWORDS) {
      await expect(
        guardedQuery(pool, `SELECT 1 WHERE 1=0 ${rule.label.split("/")[0]} dbo.T`),
      ).rejects.toThrow(ReadOnlySqlViolationError);
    }
    expect(request).not.toHaveBeenCalled();
  });

  it("executes a valid SELECT and returns the recordset", async () => {
    const { pool, query } = mockPool([{ ItemCode: "FG-1001" }]);
    const rows = await guardedQuery<{ ItemCode: string }>(
      pool,
      "SELECT ItemCode FROM dbo.InventoryItem",
    );
    expect(rows).toEqual([{ ItemCode: "FG-1001" }]);
    expect(query).toHaveBeenCalledOnce();
  });

  it("binds every parameter via request.input — never string concatenation", async () => {
    const { pool, input, query } = mockPool([]);
    await guardedQuery(pool, "SELECT ItemCode FROM dbo.InventoryItem WHERE ItemGRP = @grp", {
      grp: "F",
    });
    expect(input).toHaveBeenCalledWith("grp", "F");
    // The SQL text handed to the driver still contains the placeholder, not the value.
    expect(query.mock.calls[0][0]).toContain("@grp");
    expect(query.mock.calls[0][0]).not.toContain("'F'");
  });

  it("returns an empty array when the driver yields no recordset", async () => {
    const query = vi.fn().mockResolvedValue({});
    const pool = { request: () => ({ input: vi.fn(), query }) } as unknown as ConnectionPool;
    await expect(guardedQuery(pool, "SELECT 1 AS ok")).resolves.toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------
// Layer 4 — boot permission probe (MOCK MODE; the live-login run is Phase 5's Agent-Probe)
// ------------------------------------------------------------------------------------------

/** Build a pool whose probe returns the given permission row. */
function probePool(row: Partial<ErpPermissionRow> | undefined) {
  const query = vi.fn().mockResolvedValue({ recordset: row ? [row] : [] });
  return {
    pool: { request: () => ({ query }) } as unknown as ConnectionPool,
    query,
  };
}

const READ_ONLY_ROW: ErpPermissionRow = {
  can_insert: 0,
  can_update: 0,
  can_delete: 0,
  can_alter: 0,
  can_create_table: 0,
  can_select: 1,
};

describe("verifyReadOnlyBoot — refuses a write-capable login", () => {
  it("accepts a login with SELECT only", async () => {
    const { pool, query } = probePool(READ_ONLY_ROW);
    await expect(verifyReadOnlyBoot(pool)).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledWith(PERMISSION_PROBE_SQL);
  });

  const writeCases: { column: keyof ErpPermissionRow; label: string }[] = [
    { column: "can_insert", label: "INSERT" },
    { column: "can_update", label: "UPDATE" },
    { column: "can_delete", label: "DELETE" },
    { column: "can_alter", label: "ALTER" },
    { column: "can_create_table", label: "CREATE TABLE" },
  ];

  for (const { column, label } of writeCases) {
    it(`refuses boot when ${label} permission is granted`, async () => {
      const { pool } = probePool({ ...READ_ONLY_ROW, [column]: 1 });
      await expect(verifyReadOnlyBoot(pool)).rejects.toThrow(ErpWritePermissionError);
      await expect(verifyReadOnlyBoot(pool)).rejects.toThrow(new RegExp(label));
    });
  }

  it("names every granted permission when several are held (e.g. a db_owner login)", async () => {
    const { pool } = probePool({
      can_insert: 1,
      can_update: 1,
      can_delete: 1,
      can_alter: 1,
      can_create_table: 1,
      can_select: 1,
    });
    await expect(verifyReadOnlyBoot(pool)).rejects.toThrow(
      /INSERT, UPDATE, DELETE, ALTER, CREATE TABLE/,
    );
  });

  it("refuses (never silently downgrades) when the probe returns no rows", async () => {
    const { pool } = probePool(undefined);
    await expect(verifyReadOnlyBoot(pool)).rejects.toThrow(/returned no rows/);
  });

  it("refuses when the probe itself errors — an inconclusive probe is treated as unsafe", async () => {
    const query = vi.fn().mockRejectedValue(new Error("connection reset"));
    const pool = { request: () => ({ query }) } as unknown as ConnectionPool;
    await expect(verifyReadOnlyBoot(pool)).rejects.toThrow(/could not read the connected login/);
  });

  it("uses a probe statement that is itself SELECT-only", () => {
    expect(PERMISSION_PROBE_SQL.trim().toUpperCase().startsWith("SELECT")).toBe(true);
    expect(() => assertReadOnlySql(PERMISSION_PROBE_SQL)).not.toThrow();
  });
});
