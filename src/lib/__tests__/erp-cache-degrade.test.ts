import { describe, it, expect, beforeEach, vi } from "vitest";
import { getCached, clearErpCache, ERP_CACHE_TTL_MS } from "../erp/cache";
import { erpDegradeState, ERP_DEGRADE_BANNER_TEXT } from "../erp/degrade";
import { shouldVerifyBootProbe, parseJdbcSqlServerUrl } from "../erp/pool";

// erp-dashboards Phase 1 — gates AC15 (cache/degrade contract) and READONLY-boot-mock (the
// dev-mode gating half of the boot probe). No DB connection is opened in this file.

beforeEach(() => {
  clearErpCache();
  vi.restoreAllMocks();
});

describe("getCached — fresh reads", () => {
  it("returns a freshly fetched value with stale:false", async () => {
    const result = await getCached("k", ERP_CACHE_TTL_MS, async () => ({ n: 1 }));
    expect(result).toEqual({ value: { n: 1 }, stale: false });
  });

  it("serves the cached value without re-calling the fetcher inside the TTL", async () => {
    const fetcher = vi.fn().mockResolvedValue({ n: 1 });
    await getCached("k", ERP_CACHE_TTL_MS, fetcher);
    const second = await getCached("k", ERP_CACHE_TTL_MS, fetcher);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(second).toEqual({ value: { n: 1 }, stale: false });
  });

  it("re-fetches once the TTL has elapsed", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ n: 1 }).mockResolvedValueOnce({ n: 2 });
    await getCached("k", 1000, fetcher);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 5000);
    const second = await getCached("k", 1000, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(second).toEqual({ value: { n: 2 }, stale: false });
  });

  it("keys entries independently", async () => {
    await getCached("a", ERP_CACHE_TTL_MS, async () => "A");
    await getCached("b", ERP_CACHE_TTL_MS, async () => "B");
    expect((await getCached("a", ERP_CACHE_TTL_MS, async () => "changed")).value).toBe("A");
  });
});

describe("getCached — degrade path (last known good)", () => {
  it("returns the last cached value with stale:true when the fetcher throws", async () => {
    await getCached("k", 1000, async () => ({ n: 1 }));
    // Expire the entry, then make the live fetch fail.
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 5000);
    const result = await getCached("k", 1000, async () => {
      throw new Error("ERP unreachable");
    });
    expect(result).toEqual({ value: { n: 1 }, stale: true });
  });

  it("re-throws when the fetcher fails and no prior value exists", async () => {
    await expect(
      getCached("cold", ERP_CACHE_TTL_MS, async () => {
        throw new Error("ERP unreachable");
      }),
    ).rejects.toThrow("ERP unreachable");
  });

  it("keeps serving the stale value across repeated failures", async () => {
    await getCached("k", 1000, async () => "good");
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 5000);
    const fail = async () => {
      throw new Error("still down");
    };
    expect(await getCached("k", 1000, fail)).toEqual({ value: "good", stale: true });
    expect(await getCached("k", 1000, fail)).toEqual({ value: "good", stale: true });
  });

  it("clearErpCache empties the cache, so the next failure re-throws", async () => {
    await getCached("k", 1000, async () => "good");
    clearErpCache();
    await expect(
      getCached("k", 1000, async () => {
        throw new Error("down");
      }),
    ).rejects.toThrow("down");
  });
});

describe("erpDegradeState — banner mapping", () => {
  it("shows the banner with the exact Thai text when stale", () => {
    expect(erpDegradeState({ stale: true })).toEqual({
      showBanner: true,
      bannerText: "ข้อมูลอาจไม่ล่าสุด",
    });
  });

  it("hides the banner when fresh", () => {
    expect(erpDegradeState({ stale: false })).toEqual({
      showBanner: false,
      bannerText: "ข้อมูลอาจไม่ล่าสุด",
    });
  });

  it("exports the banner text as a shared constant", () => {
    expect(ERP_DEGRADE_BANNER_TEXT).toBe("ข้อมูลอาจไม่ล่าสุด");
  });

  it("composes directly with a getCached result", async () => {
    await getCached("k", 1000, async () => "good");
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 5000);
    const result = await getCached("k", 1000, async () => {
      throw new Error("down");
    });
    expect(erpDegradeState(result).showBanner).toBe(true);
  });
});

describe("shouldVerifyBootProbe — dev-mode gating of the layer-4 probe", () => {
  it("always runs the probe in production", () => {
    expect(shouldVerifyBootProbe({ NODE_ENV: "production" })).toBe(true);
  });

  it("skips the probe in development so the write-capable sa fixture login does not block dev", () => {
    expect(shouldVerifyBootProbe({ NODE_ENV: "development" })).toBe(false);
  });

  it("skips the probe under test", () => {
    expect(shouldVerifyBootProbe({ NODE_ENV: "test" })).toBe(false);
  });

  it("runs the probe in development when explicitly opted in", () => {
    expect(shouldVerifyBootProbe({ NODE_ENV: "development", ERP_VERIFY_BOOT_PROBE: "1" })).toBe(
      true,
    );
  });

  it("cannot be disabled in production by the opt-in flag", () => {
    expect(shouldVerifyBootProbe({ NODE_ENV: "production", ERP_VERIFY_BOOT_PROBE: "0" })).toBe(
      true,
    );
  });
});

describe("parseJdbcSqlServerUrl — JDBC string to mssql config", () => {
  it("parses host, port, database, user, and password", () => {
    const cfg = parseJdbcSqlServerUrl(
      "sqlserver://localhost:1433;database=erp_fixture;user=reader;password=fake$pw;encrypt=true;trustServerCertificate=true",
    );
    expect(cfg.server).toBe("localhost");
    expect(cfg.port).toBe(1433);
    expect(cfg.database).toBe("erp_fixture");
    expect(cfg.user).toBe("reader");
    expect(cfg.password).toBe("fake$pw");
    expect(cfg.options?.encrypt).toBe(true);
    expect(cfg.options?.trustServerCertificate).toBe(true);
  });

  it("always sets readOnlyIntent (ApplicationIntent=ReadOnly, defense layer 5)", () => {
    const cfg = parseJdbcSqlServerUrl("sqlserver://localhost:1433;database=erp_fixture");
    expect(cfg.options?.readOnlyIntent).toBe(true);
  });

  it("defaults the port to 1433 when omitted", () => {
    const cfg = parseJdbcSqlServerUrl("sqlserver://dbhost;database=erp_fixture");
    expect(cfg.server).toBe("dbhost");
    expect(cfg.port).toBe(1433);
  });

  it("keeps a named-instance host intact", () => {
    const cfg = parseJdbcSqlServerUrl("sqlserver://host\\SQLEXPRESS:1433;database=erp_fixture");
    expect(cfg.server).toBe("host\\SQLEXPRESS");
  });

  it("does not mangle a password containing = or $", () => {
    const cfg = parseJdbcSqlServerUrl(
      "sqlserver://localhost:1433;database=erp_fixture;password=a=b$c",
    );
    expect(cfg.password).toBe("a=b$c");
  });

  it("throws when the database property is missing", () => {
    expect(() => parseJdbcSqlServerUrl("sqlserver://localhost:1433")).toThrow(/database=/);
  });

  it("throws when no host is present", () => {
    expect(() => parseJdbcSqlServerUrl("sqlserver://;database=erp_fixture")).toThrow(
      /server host/,
    );
  });
});
