import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ConnectionPool } from "mssql";
import { ErpWritePermissionError } from "../erp/erp-adapter";
import {
  allowsWriteCapableLogin,
  buildWriteCapableLoginWarning,
  erpReadOnlyLoginState,
  resetErpReadOnlyLoginState,
  runBootProbeWithOptIn,
  shouldVerifyBootProbe,
} from "../erp/pool";

// erp-dashboards Phase 1 supplement (2026-09-22) — the ERP_ALLOW_WRITE_CAPABLE_LOGIN opt-in.
//
// Proves the recorded charter exception is EXPLICIT and OFF BY DEFAULT: only the exact string
// "1" relaxes the boot refusal, the probe still runs and still reports what it found, exactly one
// credential-free warning is logged per pool creation, and the health state flips to
// `readOnlyLogin: false`. No real SQL Server connection is opened here; db_TCL is never contacted.

/** A pool stand-in — never touched, the probe itself is injected. */
const fakePool = {} as unknown as ConnectionPool;

const WRITE_CAPABLE = ["INSERT", "UPDATE", "DELETE", "ALTER", "CREATE TABLE"];

function verifyRejectsWriteCapable(granted: readonly string[] = WRITE_CAPABLE) {
  return vi.fn().mockRejectedValue(new ErpWritePermissionError(granted));
}

beforeEach(() => {
  resetErpReadOnlyLoginState();
});

describe("allowsWriteCapableLogin — only the exact string \"1\"", () => {
  it("is false when the switch is absent", () => {
    expect(allowsWriteCapableLogin({})).toBe(false);
  });

  for (const value of ["0", "true", "TRUE", "yes", "", " 1", "1 ", "01"]) {
    it(`is false for ${JSON.stringify(value)}`, () => {
      expect(allowsWriteCapableLogin({ ERP_ALLOW_WRITE_CAPABLE_LOGIN: value })).toBe(false);
    });
  }

  it('is true only for "1"', () => {
    expect(allowsWriteCapableLogin({ ERP_ALLOW_WRITE_CAPABLE_LOGIN: "1" })).toBe(true);
  });
});

describe("runBootProbeWithOptIn — behaviour matrix", () => {
  // Row 1 — switch off + write-capable login → still refuses (production behaviour unchanged).
  it("still throws when the switch is absent, even with NODE_ENV=production", async () => {
    const warn = vi.fn();
    const verify = verifyRejectsWriteCapable();

    await expect(
      runBootProbeWithOptIn(fakePool, { verify, env: {}, warn }),
    ).rejects.toThrow(ErpWritePermissionError);

    expect(warn).not.toHaveBeenCalled();
    expect(erpReadOnlyLoginState()).toEqual({ readOnlyLogin: true });
    // The probe still runs in production regardless of the new switch.
    expect(shouldVerifyBootProbe({ NODE_ENV: "production" })).toBe(true);
  });

  for (const value of ["0", "true", ""]) {
    it(`still throws when the switch is ${JSON.stringify(value)}`, async () => {
      const warn = vi.fn();
      await expect(
        runBootProbeWithOptIn(fakePool, {
          verify: verifyRejectsWriteCapable(),
          env: { ERP_ALLOW_WRITE_CAPABLE_LOGIN: value },
          warn,
        }),
      ).rejects.toThrow(ErpWritePermissionError);
      expect(warn).not.toHaveBeenCalled();
    });
  }

  // Row 2 — switch on + write-capable login → resolves, warns exactly once, flag false.
  it('resolves and warns exactly once when the switch is "1" and the login can write', async () => {
    const warn = vi.fn();
    const verify = verifyRejectsWriteCapable();

    await expect(
      runBootProbeWithOptIn(fakePool, {
        verify,
        env: { ERP_ALLOW_WRITE_CAPABLE_LOGIN: "1" },
        warn,
      }),
    ).resolves.toBeUndefined();

    // The probe STILL RAN — it only stopped throwing.
    expect(verify).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);

    const message = warn.mock.calls[0][0] as string;
    for (const permission of WRITE_CAPABLE) {
      expect(message).toContain(permission);
    }
    expect(message).toContain("db/create-erp-readonly-login.sql");
    expect(message).toContain("ERP_ALLOW_WRITE_CAPABLE_LOGIN");
    // Thai one-liner for the operator.
    expect(message).toContain("คำเตือน");

    const state = erpReadOnlyLoginState();
    expect(state.readOnlyLogin).toBe(false);
    expect(state.warning).toBe(message);
    expect(state.warning).not.toHaveLength(0);
  });

  it("names only the permissions actually granted", async () => {
    const warn = vi.fn();
    await runBootProbeWithOptIn(fakePool, {
      verify: verifyRejectsWriteCapable(["UPDATE"]),
      env: { ERP_ALLOW_WRITE_CAPABLE_LOGIN: "1" },
      warn,
    });
    const message = warn.mock.calls[0][0] as string;
    expect(message).toContain("UPDATE");
    expect(message).not.toContain("CREATE TABLE");
  });

  it("logs once per pool creation, not per call site re-read of the state", async () => {
    const warn = vi.fn();
    await runBootProbeWithOptIn(fakePool, {
      verify: verifyRejectsWriteCapable(),
      env: { ERP_ALLOW_WRITE_CAPABLE_LOGIN: "1" },
      warn,
    });
    erpReadOnlyLoginState();
    erpReadOnlyLoginState();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  // Row 3 — switch on + read-only login → resolves silently, flag true.
  it('resolves with no warning when the switch is "1" but the login is read-only', async () => {
    const warn = vi.fn();
    const verify = vi.fn().mockResolvedValue(undefined);

    await expect(
      runBootProbeWithOptIn(fakePool, {
        verify,
        env: { ERP_ALLOW_WRITE_CAPABLE_LOGIN: "1" },
        warn,
      }),
    ).resolves.toBeUndefined();

    expect(verify).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
    expect(erpReadOnlyLoginState()).toEqual({ readOnlyLogin: true });
    expect(erpReadOnlyLoginState().warning).toBeUndefined();
  });

  it("never covers an inconclusive probe, even with the switch on", async () => {
    const warn = vi.fn();
    await expect(
      runBootProbeWithOptIn(fakePool, {
        verify: vi.fn().mockRejectedValue(new Error("probe returned no rows")),
        env: { ERP_ALLOW_WRITE_CAPABLE_LOGIN: "1" },
        warn,
      }),
    ).rejects.toThrow(/returned no rows/);
    expect(warn).not.toHaveBeenCalled();
    expect(erpReadOnlyLoginState()).toEqual({ readOnlyLogin: true });
  });
});

// Row 4 — the warning never leaks a credential (negative assertion, not an eyeball check).
describe("the write-capable warning is credential-free", () => {
  const FAKE_PASSWORD = "NotARealPassw0rd!Fixture";
  const FAKE_URL = `sqlserver://erp-host:1433;database=db_TCL;user=sa;password=${FAKE_PASSWORD};encrypt=true`;

  it("contains no connection-string, user or password substring", async () => {
    const warn = vi.fn();
    const previous = process.env.ERP_DATABASE_URL;
    process.env.ERP_DATABASE_URL = FAKE_URL;

    try {
      await runBootProbeWithOptIn(fakePool, {
        verify: verifyRejectsWriteCapable(),
        env: { ERP_ALLOW_WRITE_CAPABLE_LOGIN: "1" },
        warn,
      });
    } finally {
      if (previous === undefined) delete process.env.ERP_DATABASE_URL;
      else process.env.ERP_DATABASE_URL = previous;
    }

    const message = warn.mock.calls[0][0] as string;
    for (const forbidden of [
      FAKE_URL,
      FAKE_PASSWORD,
      "sqlserver://",
      "password",
      "pwd=",
      "user=",
      "erp-host",
    ]) {
      expect(message.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
    // The health-surfaced copy is the same string, so it is equally credential-free.
    expect(erpReadOnlyLoginState().warning).toBe(message);
  });

  it("builds the same credential-free text from labels alone", () => {
    const message = buildWriteCapableLoginWarning(["INSERT"]);
    expect(message).toContain("INSERT");
    expect(message.toLowerCase()).not.toContain("password");
    expect(message.toLowerCase()).not.toContain("sqlserver://");
  });
});
