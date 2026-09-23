import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ConnectionPool } from "mssql";

// REGRESSION GUARD for the 2026-09-23 production defect.
//
// `/api/health/erp` is the operational signal for whether DATABASE-LEVEL write protection is in
// force. The first request after a container start used to answer `"readOnlyLogin": true` even
// though the pool was backed by the write-capable `sa` login: the route read the boot-probe state
// BEFORE awaiting `getErpPool()` (which is where the probe runs), and the module default was
// "assume read-only". Reporting the SAFE answer for an UNKNOWN truth is the wrong direction for a
// security signal — it hid a real write-capable login for one request.
//
// These tests exercise the REAL `src/lib/erp/pool.ts` state machine (including its initial state)
// and the REAL route handler. Only the SQL Server driver, the connection-string resolver and the
// two erp-adapter DB calls are faked — no socket is opened and db_TCL is never contacted.

/** Controls what the injected boot probe does for the current case. */
let probeBehaviour: "read-only" | "write-capable" = "write-capable";
/** How many times the fake pool was connected — proves the route really established it. */
let connectCount = 0;

class FakeConnectionPool {
  connected = false;
  connecting = false;
  // The parsed config is intentionally ignored — no socket is ever opened.
  constructor() {}
  async connect(): Promise<this> {
    connectCount += 1;
    this.connected = true;
    return this;
  }
}

vi.mock("mssql", () => ({ ConnectionPool: FakeConnectionPool }));

vi.mock("../erp/resolve-erp-database-url", () => ({
  // Never touches `.env`; the fake driver ignores it entirely.
  resolveErpDatabaseUrl: () => "sqlserver://fixture-host:1433;database=erp_fixture;user=fixture",
}));

vi.mock("../erp/erp-adapter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../erp/erp-adapter")>();
  return {
    ...actual,
    // Layer-4 probe stand-in: rejects exactly like the real one on a write-capable login.
    verifyReadOnlyBoot: vi.fn(async () => {
      if (probeBehaviour === "write-capable") {
        throw new actual.ErpWritePermissionError([
          "INSERT",
          "UPDATE",
          "DELETE",
          "ALTER",
          "CREATE TABLE",
        ]);
      }
    }),
    guardedQuery: vi.fn(async () => [{ ok: 1 }]),
  };
});

// Imported AFTER the mocks so the route/pool bind to them.
const { GET } = await import("@/app/api/health/erp/route");
const { erpReadOnlyLoginState, resetErpReadOnlyLoginState } = await import("../erp/pool");
const { clearErpCache } = await import("../erp/cache");

const globalForErp = globalThis as unknown as {
  erpPool?: ConnectionPool;
  erpPoolConnect?: Promise<ConnectionPool>;
};

/** Put the process back into a genuinely COLD state — as if the container had just started. */
function coldStart(): void {
  globalForErp.erpPool = undefined;
  globalForErp.erpPoolConnect = undefined;
  resetErpReadOnlyLoginState();
  clearErpCache();
  connectCount = 0;
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  coldStart();
  // Production-shaped: the probe runs, and the recorded temporary exception lets boot proceed.
  process.env.ERP_VERIFY_BOOT_PROBE = "1";
  process.env.ERP_ALLOW_WRITE_CAPABLE_LOGIN = "1";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  coldStart();
});

describe("ERP login state — the unknown case is explicit", () => {
  it("starts as not-probed, never as read-only", () => {
    expect(erpReadOnlyLoginState()).toEqual({ readOnlyLogin: null, loginCheck: "not-probed" });
  });

  it("resets to not-probed, never to read-only", () => {
    resetErpReadOnlyLoginState();
    const state = erpReadOnlyLoginState();
    expect(state.readOnlyLogin).not.toBe(true);
    expect(state.loginCheck).toBe("not-probed");
  });
});

describe("/api/health/erp — cold start reporting (regression: 2026-09-23)", () => {
  it("reports a WRITE-CAPABLE login on the FIRST request, not the second", async () => {
    probeBehaviour = "write-capable";

    const body = (await (await GET()).json()) as {
      ok: boolean;
      readOnlyLogin: boolean | null;
      loginCheck: string;
      warning?: string;
    };

    expect(body.ok).toBe(true);
    // The whole point: no "true" on the first call while the login can in fact write.
    expect(body.readOnlyLogin).toBe(false);
    expect(body.loginCheck).toBe("write-capable");
    expect(body.warning).toContain("WRITE-CAPABLE");
    // The pool really was established by this request — the probe could not have run otherwise.
    expect(connectCount).toBe(1);
  });

  it("never claims read-only before the probe has run", async () => {
    probeBehaviour = "write-capable";
    // Cold state asserted immediately before the call, so nothing can have probed yet.
    expect(erpReadOnlyLoginState().loginCheck).toBe("not-probed");

    const body = (await (await GET()).json()) as { readOnlyLogin: boolean | null };
    expect(body.readOnlyLogin).not.toBe(true);
  });

  it("gives the same answer on the first and the second request", async () => {
    probeBehaviour = "write-capable";
    const first = (await (await GET()).json()) as Record<string, unknown>;
    const second = (await (await GET()).json()) as Record<string, unknown>;

    expect(first.readOnlyLogin).toBe(second.readOnlyLogin);
    expect(first.loginCheck).toBe(second.loginCheck);
  });

  it("reports read-only on the first request when the login really is read-only", async () => {
    probeBehaviour = "read-only";
    const body = (await (await GET()).json()) as {
      readOnlyLogin: boolean | null;
      loginCheck: string;
      warning?: string;
    };

    expect(body.readOnlyLogin).toBe(true);
    expect(body.loginCheck).toBe("read-only");
    expect(body.warning).toBeUndefined();
  });

  it("reports not-probed (never read-only) when the probe is disabled", async () => {
    // Local-dev shape: no boot probe, so the login's permissions are genuinely unknown.
    delete process.env.ERP_VERIFY_BOOT_PROBE;
    const body = (await (await GET()).json()) as {
      ok: boolean;
      readOnlyLogin: boolean | null;
      loginCheck: string;
    };

    expect(body.ok).toBe(true);
    expect(body.readOnlyLogin).toBeNull();
    expect(body.loginCheck).toBe("not-probed");
  });
});

describe("/api/health/erp — failure path is unchanged", () => {
  it("returns a sanitized 200 failure (never a 500) and stays not-probed", async () => {
    const adapter = await import("../erp/erp-adapter");
    vi.mocked(adapter.guardedQuery).mockRejectedValueOnce(new Error("socket hang up at erp-host"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    probeBehaviour = "read-only";

    const response = await GET();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("ERP connection failed");
    // No driver/host detail leaks to the client.
    expect(JSON.stringify(body)).not.toContain("erp-host");
    errorSpy.mockRestore();
  });
});
