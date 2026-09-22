import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { assertReadOnlySql, FORBIDDEN_KEYWORDS, normalizeSqlForGuard } from "../erp/erp-adapter";
import { csvField, csvFilename, renderCsv, UTF8_BOM, CSV_ROW_CAP } from "../erp/csv-export";
import {
  buildExportHref,
  deriveExportTarget,
  exportSlug,
  parseExportTarget,
} from "../erp/dashboard-export-target";
import { resolveErpDatabaseUrl } from "../erp/resolve-erp-database-url";
import { clearErpCache } from "../erp/cache";

// erp-dashboards Phase 5 — THE cross-dashboard money-visibility audit (AC9 + AC14).
//
// This is the one gate no single-dashboard phase could run: it asserts the server-side money gate
// holds across ALL THREE dashboards at once, on BOTH surfaces (the rendered screen and the
// exported file), in ONE file — which is what "cross-dashboard" in the SPEC actually means.
//
// It has three parts, split by what each can honestly prove:
//
//   C1a — Export routes (role-testable). The Phase-5 export route OWNS the role parameter, so this
//         block calls the REAL route handler with a STAFF auth context and with an ADMIN one and
//         compares the produced CSV bytes. Hybrid: needs `erp_fixture`, self-skips without it.
//   C1b/C2 — Existing dashboard pages (static source coverage). RESEARCH confirmed the page-level
//         data-fetch functions take NO role parameter — they always return full money data, and
//         the real gate is `const canSeeMoney = user.role === "ADMIN"` in each page, threaded down
//         as DATA SHAPE. There is therefore nothing to "call as STAFF" at that layer; the honest
//         proving mechanism is a mechanical source sweep, the same shape as the existing
//         `auth-guard-coverage.test.ts` ELEV-guard.
//   Pure   — the CSV serializer's own contract (BOM, quoting, cap, ASCII filename).
//
// LOCAL SANDBOX ONLY. Nothing here can reach db_TCL.

const ROOT = resolve(__dirname, "../../..");

// ---------------------------------------------------------------------------------------------
// Pure — the serializer and the export-target derivation (no DB, no role, no ERP).
// ---------------------------------------------------------------------------------------------

describe("CSV serializer — Excel-safe Thai output", () => {
  it("prepends the UTF-8 BOM so Excel reads Thai correctly", () => {
    const out = renderCsv({ headers: ["ชื่อ"], rows: [["ตีลาน"]] });
    expect(out.body.startsWith(UTF8_BOM)).toBe(true);
    // The BOM must be the very first code unit — not merely present somewhere.
    expect(out.body.charCodeAt(0)).toBe(0xfeff);
  });

  it("uses CRLF line endings and writes the header row first", () => {
    const out = renderCsv({ headers: ["a", "b"], rows: [["1", "2"]] });
    expect(out.body).toBe(`${UTF8_BOM}a,b\r\n1,2\r\n`);
  });

  it("quotes fields containing a comma, quote or newline (RFC 4180)", () => {
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
    expect(csvField("plain")).toBe("plain");
  });

  it("neutralises a leading formula character but keeps real negative numbers intact", () => {
    expect(csvField("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvField("+1234")).toBe("'+1234");
    expect(csvField("@cmd")).toBe("'@cmd");
    // A negative outstanding quantity is real data this program deliberately surfaces.
    expect(csvField("-5")).toBe("-5");
    expect(csvField(-5)).toBe("-5");
  });

  it("renders null/undefined as an empty field, never the string 'null'", () => {
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
  });

  it("caps rows and appends a visible Thai truncation notice", () => {
    const rows = Array.from({ length: 12 }, (_, i) => [i]);
    const out = renderCsv({ headers: ["n"], rows }, 10);
    expect(out.truncated).toBe(true);
    expect(out.rowsWritten).toBe(10);
    expect(out.totalRows).toBe(12);
    expect(out.body).toContain("หมายเหตุ");
    expect(out.body).toContain("12");
  });

  it("does not add a notice when the row count is within the cap", () => {
    const out = renderCsv({ headers: ["n"], rows: [[1]] }, 10);
    expect(out.truncated).toBe(false);
    expect(out.body).not.toContain("หมายเหตุ");
  });

  it("defaults the cap to 5,000 rows", () => {
    expect(CSV_ROW_CAP).toBe(5000);
  });

  it("produces an ASCII-safe filename even from a Thai or punctuated slug", () => {
    expect(csvFilename("sales-list", "2026-09-22")).toBe("sales-list-2026-09-22.csv");
    const thai = csvFilename("ยอดขาย", "2026-09-22");
    expect(/^[\x20-\x7e]+$/.test(thai)).toBe(true);
    expect(csvFilename("purchase-lines-PO/26 08", "bogus")).toBe("purchase-lines-PO-26-08-export.csv");
  });
});

describe("export target derivation — one rule shared by the button and the route", () => {
  it("maps each dashboard base path to its list export", () => {
    expect(deriveExportTarget("/dashboards/sales")).toEqual({ dashboard: "sales", table: "list" });
    expect(deriveExportTarget("/dashboards/purchase")).toEqual({
      dashboard: "purchase",
      table: "list",
    });
    expect(deriveExportTarget("/dashboards/production")).toEqual({
      dashboard: "production",
      table: "list",
    });
  });

  it("switches Sales to the line export when a DO is drilled into via ?doNo=", () => {
    expect(deriveExportTarget("/dashboards/sales", { doNo: "DO-2608-0001" })).toEqual({
      dashboard: "sales",
      table: "lines",
    });
  });

  it("reads the Purchase/Production drilldown key out of the PATH and decodes it", () => {
    expect(deriveExportTarget("/dashboards/purchase/PO-2608-0001")).toEqual({
      dashboard: "purchase",
      table: "lines",
      key: "PO-2608-0001",
    });
    expect(deriveExportTarget("/dashboards/production/MO%2F1")).toEqual({
      dashboard: "production",
      table: "lines",
      key: "MO/1",
    });
  });

  it("returns null for any non-dashboard path, so no export button is rendered there", () => {
    expect(deriveExportTarget("/orders")).toBeNull();
    expect(deriveExportTarget("/dashboards/unknown")).toBeNull();
    expect(deriveExportTarget("/dashboards/purchase/a/b")).toBeNull();
  });

  it("carries every current filter/sort/page param into the export href", () => {
    const href = buildExportHref(
      { dashboard: "sales", table: "list" },
      { from: "2026-08-01", to: "2026-09-30", sort: "-date", page: "2", cat: "A" },
    );
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe("/api/dashboards/export");
    expect(url.searchParams.get("from")).toBe("2026-08-01");
    expect(url.searchParams.get("sort")).toBe("-date");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("cat")).toBe("A");
    expect(url.searchParams.get("dashboard")).toBe("sales");
    expect(url.searchParams.get("table")).toBe("list");
  });

  it("cannot be spoofed by a same-named search param", () => {
    const href = buildExportHref({ dashboard: "production", table: "list" }, { dashboard: "sales" });
    expect(new URL(href, "http://x").searchParams.get("dashboard")).toBe("production");
  });

  it("round-trips through parseExportTarget and rejects nonsense", () => {
    const target = { dashboard: "purchase", table: "lines", key: "PO-1" } as const;
    const parsed = parseExportTarget(new URL(buildExportHref(target), "http://x").searchParams);
    expect(parsed).toEqual(target);
    expect(parseExportTarget(new URLSearchParams("dashboard=hr&table=list"))).toBeNull();
    expect(parseExportTarget(new URLSearchParams("dashboard=sales&table=chart"))).toBeNull();
    // A `lines` export for Purchase/Production without its path key is not resolvable.
    expect(parseExportTarget(new URLSearchParams("dashboard=purchase&table=lines"))).toBeNull();
    expect(exportSlug(target)).toBe("purchase-lines-PO-1");
  });
});

// ---------------------------------------------------------------------------------------------
// C1b / C2 — STATIC SOURCE COVERAGE across all three dashboards.
//
// The mechanical backstop: every money-labeled render site on every dashboard must sit behind the
// server-side gate, and the gate itself must be computed from the session, server-side. This is
// what catches a FUTURE accidentally-unguarded money field — the same rationale as the existing
// ELEV-guard block in auth-guard-coverage.test.ts.
// ---------------------------------------------------------------------------------------------

/** Column labels and view fields that carry money. Anything matching must be behind the gate. */
const MONEY_TOKENS = [
  "ยอดเงิน",
  "จำนวนเงิน",
  "ราคา/หน่วย",
  "ราคาต่อหน่วย",
  "formatMoney",
  "totalAmount",
  "unitPrice",
  "Saleprice",
  "pricedAmount",
];

/** Files that render money on each dashboard, plus the two money-free Production surfaces. */
const MONEY_BEARING_SOURCES = [
  // Sales
  "src/app/(main)/dashboards/sales/page.tsx",
  "src/app/(main)/dashboards/sales/sales-kpi-tiles.tsx",
  "src/app/(main)/dashboards/sales/do-list-table.tsx",
  "src/app/(main)/dashboards/sales/do-lines-table.tsx",
  "src/app/(main)/dashboards/sales/sales-breakdown-tables.tsx",
  "src/app/(main)/dashboards/sales/sales-chart.tsx",
  // Purchase
  "src/app/(main)/dashboards/purchase/page.tsx",
  "src/app/(main)/dashboards/purchase/[poNo]/page.tsx",
  "src/app/(main)/dashboards/purchase/po-list-table.tsx",
  "src/app/(main)/dashboards/purchase/po-lines-table.tsx",
  "src/app/(main)/dashboards/purchase/purchase-view.ts",
  "src/app/(main)/dashboards/purchase/purchase-kpi-tiles.tsx",
  // Export surface (Phase 5's own)
  "src/app/api/dashboards/export/route.ts",
  "src/app/api/dashboards/export/export-datasets.ts",
];

/** Production is money-free BY DESIGN (SPEC AC7/AC8) — asserted, not assumed. */
const PRODUCTION_SOURCES = [
  "src/app/(main)/dashboards/production/page.tsx",
  "src/app/(main)/dashboards/production/[moNumber]/page.tsx",
  "src/app/(main)/dashboards/production/mo-list-table.tsx",
  "src/app/(main)/dashboards/production/production-kpi-tiles.tsx",
  "src/lib/production-data.ts",
];

function readSource(file: string): string {
  return readFileSync(resolve(ROOT, file), "utf8");
}

/** Strip comments — these modules DOCUMENT the money rules in prose. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/[^\n]*$/gm, "");
}

describe("AC9 static coverage — every money site on every dashboard is gated server-side", () => {
  for (const file of MONEY_BEARING_SOURCES) {
    it(`${file} carries a canSeeMoney / role==="ADMIN" gate wherever it touches money`, () => {
      const source = stripComments(readSource(file));
      const touchesMoney = MONEY_TOKENS.some((token) => source.includes(token));
      if (!touchesMoney) return; // nothing to gate in this file
      expect(
        /canSeeMoney/.test(source),
        `${file} renders or serializes money but never references canSeeMoney`,
      ).toBe(true);
    });

    it(`${file} never hides money with CSS instead of omitting it`, () => {
      const source = stripComments(readSource(file));
      expect(
        /canSeeMoney[^\n]*(hidden|invisible|sr-only|display:\s*none)/.test(source),
        `${file} appears to hide money with a class instead of omitting it`,
      ).toBe(false);
    });

    it(`${file} stays a server module (no "use client")`, () => {
      expect(/"use client"/.test(readSource(file))).toBe(false);
    });
  }

  it("each dashboard's entry page computes canSeeMoney from the SERVER session role", () => {
    const entryPages = [
      "src/app/(main)/dashboards/sales/page.tsx",
      "src/app/(main)/dashboards/purchase/page.tsx",
      "src/app/(main)/dashboards/purchase/[poNo]/page.tsx",
    ];
    for (const file of entryPages) {
      const source = readSource(file);
      expect(
        /const\s+canSeeMoney\s*=\s*user\.role\s*===\s*"ADMIN"/.test(source),
        `${file} must derive canSeeMoney from the awaited requireAuth() result`,
      ).toBe(true);
    }
  });

  it("the export route computes its OWN canSeeMoney rather than trusting a request param", () => {
    const source = stripComments(readSource("src/app/api/dashboards/export/route.ts"));
    expect(/const\s+canSeeMoney\s*=\s*user\.role\s*===\s*"ADMIN"/.test(source)).toBe(true);
    // The flag must never be readable off the query string.
    expect(/searchParams\.get\(\s*["']canSeeMoney["']\s*\)/.test(source)).toBe(false);
    expect(/requireAuth\(/.test(source)).toBe(true);
  });

  it("the Production dashboard exposes no money at all (SPEC AC7/AC8)", () => {
    for (const file of PRODUCTION_SOURCES) {
      const source = stripComments(readSource(file));
      for (const token of ["formatMoney", "ยอดเงิน", "จำนวนเงิน", "unitPrice", "totalAmount"]) {
        expect(source.includes(token), `${file} must not carry the money token ${token}`).toBe(
          false,
        );
      }
    }
  });

  it("every dashboard reaches the ERP only via guardedQuery — the export route included", () => {
    const erpModules = [
      "src/lib/sales-queries.ts",
      "src/lib/purchase-data.ts",
      "src/lib/production-data.ts",
      "src/app/api/dashboards/export/route.ts",
      "src/app/api/dashboards/export/export-datasets.ts",
    ];
    for (const file of erpModules) {
      const source = stripComments(readSource(file));
      expect(/\$queryRaw/.test(source), `${file} must not use $queryRaw for ERP reads`).toBe(false);
      expect(
        /prisma\.(?!appSetting)/.test(source),
        `${file} must not read ERP tables through Prisma`,
      ).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// C1a — HYBRID: the REAL export route handler, called once as ADMIN and once as STAFF, against the
// `erp_fixture` sandbox. This is the half that is genuinely role-testable, because Phase 5 owns the
// role parameter at this layer.
//
// Precondition: `orderstock-sql` up, all fixture seeds applied, ERP_DATABASE_URL pointed at
// `erp_fixture`. Self-skips (loudly) otherwise, matching every other Hybrid gate in this repo.
// ---------------------------------------------------------------------------------------------

const erpConfigured = (() => {
  try {
    return typeof resolveErpDatabaseUrl() === "string";
  } catch {
    return false;
  }
})();

if (!erpConfigured) {
  console.warn(
    "[dashboards-money-audit] HYBRID half SKIPPED — ERP_DATABASE_URL is not set. " +
      "Point it at the LOCAL erp_fixture sandbox and re-run to exercise AC9 on the export routes.",
  );
}

// The role the mocked `requireAuth()` hands back. `vi.hoisted` so the (hoisted) mock factory can
// close over it without tripping vitest's "no top-level variables in a mock factory" rule.
const authState = vi.hoisted(() => ({ role: "ADMIN" }));

// Replaced WHOLESALE rather than spread over the real module: importing the real `auth-guard`
// pulls in next-auth, which does not resolve under vitest's node ESM loader. The route only needs
// `requireAuth` + `AuthError`, and substituting the session is exactly the point of this gate —
// the money DECISION under test lives in the route, not in requireAuth.
vi.mock("@/lib/auth-guard", () => {
  class AuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AuthError";
    }
  }
  return {
    AuthError,
    requireAuth: async () => ({ id: 1, username: "audit", role: authState.role }),
    requireAuthState: async () => null,
  };
});

/** The full seeded range, so a narrow default window can never empty the assertion. */
const RANGE = "from=2026-08-01&to=2026-09-30";

/** Money column headers that must be absent from every STAFF file. */
const MONEY_HEADERS = ["ยอดเงิน", "จำนวนเงิน", "ราคา/หน่วย", "ราคาต่อหน่วย"];

async function exportAs(role: "ADMIN" | "STAFF", query: string) {
  authState.role = role;
  clearErpCache();
  const { GET } = await import("@/app/api/dashboards/export/route");
  const response = await GET(new Request(`http://localhost:3000/api/dashboards/export?${query}`));
  // `Response.text()` applies UTF-8 decode WITH BOM removal (WHATWG spec), which would silently
  // hide a missing BOM. Read the raw bytes and decode with `ignoreBOM` so the marker is asserted
  // as it will actually reach Excel.
  const bytes = new Uint8Array(await response.arrayBuffer());
  const body = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
  const [headerLine] = body.replace(UTF8_BOM, "").split("\r\n");
  return {
    response,
    bytes,
    body,
    headers: headerLine.split(",").map((h) => h.replace(/^"|"$/g, "")),
  };
}

describe.skipIf(!erpConfigured)("AC9/AC14 — export money gate across all 3 dashboards (Hybrid)", () => {
  beforeEach(() => {
    authState.role = "ADMIN";
  });

  const MONEY_BEARING_EXPORTS = [
    { name: "sales list", query: `dashboard=sales&table=list&${RANGE}` },
    { name: "sales lines", query: `dashboard=sales&table=lines&doNo=DO-2608-0001&${RANGE}` },
    { name: "purchase list", query: `dashboard=purchase&table=list&${RANGE}` },
  ];

  for (const { name, query } of MONEY_BEARING_EXPORTS) {
    it(`${name}: ADMIN gets money columns, STAFF gets strictly fewer columns and none of them`, async () => {
      const admin = await exportAs("ADMIN", query);
      const staff = await exportAs("STAFF", query);

      expect(admin.response.status).toBe(200);
      expect(staff.response.status).toBe(200);

      // ADMIN must actually HAVE a money column — otherwise the STAFF assertion proves nothing.
      expect(
        admin.headers.some((h) => MONEY_HEADERS.includes(h)),
        `${name}: the ADMIN export must contain at least one money column`,
      ).toBe(true);

      // STAFF: the column is ABSENT, not blank. Header count strictly drops.
      expect(staff.headers.length).toBeLessThan(admin.headers.length);
      for (const money of MONEY_HEADERS) {
        expect(staff.headers, `${name}: STAFF header row must not contain ${money}`).not.toContain(
          money,
        );
        expect(staff.body, `${name}: STAFF body must not contain ${money} anywhere`).not.toContain(
          money,
        );
      }
    });
  }

  it("purchase lines: the ADMIN money columns vanish entirely for STAFF", async () => {
    const listAdmin = await exportAs("ADMIN", `dashboard=purchase&table=list&${RANGE}`);
    // Take a real PO number out of the list export so the drilldown key is never invented.
    const firstDataRow = listAdmin.body.replace(UTF8_BOM, "").split("\r\n")[1] ?? "";
    const poNumber = firstDataRow.split(",")[0].replace(/^"|"$/g, "");
    expect(poNumber.length).toBeGreaterThan(0);

    const query = `dashboard=purchase&table=lines&key=${encodeURIComponent(poNumber)}&${RANGE}`;
    const admin = await exportAs("ADMIN", query);
    const staff = await exportAs("STAFF", query);

    expect(admin.headers).toContain("ราคาต่อหน่วย");
    expect(admin.headers).toContain("จำนวนเงิน");
    expect(staff.headers).not.toContain("ราคาต่อหน่วย");
    expect(staff.headers).not.toContain("จำนวนเงิน");
    expect(staff.headers.length).toBe(admin.headers.length - 2);
  });

  it("production exports are byte-identical for both roles (no money exists to gate)", async () => {
    const query = `dashboard=production&table=list&${RANGE}`;
    const admin = await exportAs("ADMIN", query);
    const staff = await exportAs("STAFF", query);
    expect(staff.body).toBe(admin.body);
    for (const money of MONEY_HEADERS) {
      expect(admin.body).not.toContain(money);
    }
    // AC7: the plan-only column ships empty-by-text in the file too.
    expect(admin.body).toContain("ยังไม่มีข้อมูลผลิตจริง");
  });

  it("every export is UTF-8-BOM'd, attachment-dispositioned and ASCII-named", async () => {
    const { response, body, bytes } = await exportAs("ADMIN", `dashboard=sales&table=list&${RANGE}`);
    // The literal EF BB BF byte sequence — what Excel actually looks for.
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
    expect(body.charCodeAt(0)).toBe(0xfeff);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-type")).toContain("charset=utf-8");
    const disposition = response.headers.get("content-disposition") ?? "";
    expect(disposition).toContain("attachment;");
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "";
    expect(/^[\x20-\x7e]+$/.test(filename), `filename ${filename} must be ASCII`).toBe(true);
    expect(filename.endsWith(".csv")).toBe(true);
  });

  it("dates in the body are Buddhist Era, never a raw CE/ISO date", async () => {
    const { body } = await exportAs("ADMIN", `dashboard=sales&table=list&${RANGE}`);
    // The fixture range is CE 2026 => BE 2569; d/m/yy renders the year as `69`.
    expect(body).toMatch(/\d{1,2}\/\d{1,2}\/69/);
    expect(body).not.toMatch(/2026-0[89]-\d{2}/);
  });

  it("honours the current filter and sort from the URL", async () => {
    const all = await exportAs("ADMIN", `dashboard=sales&table=list&${RANGE}`);
    const september = await exportAs("ADMIN", "dashboard=sales&table=list&from=2026-09-01&to=2026-09-30");
    const allRows = all.body.trim().split("\r\n").length;
    const septRows = september.body.trim().split("\r\n").length;
    expect(septRows).toBeLessThan(allRows);

    // Sorting ascending vs descending by DO number must reverse the first data row.
    const asc = await exportAs("ADMIN", `dashboard=sales&table=list&sort=doNo&${RANGE}`);
    const desc = await exportAs("ADMIN", `dashboard=sales&table=list&sort=-doNo&${RANGE}`);
    expect(asc.body.split("\r\n")[1]).not.toBe(desc.body.split("\r\n")[1]);
  });

  it("rejects an unknown dashboard/table pair with 400 and no file", async () => {
    authState.role = "ADMIN";
    const { GET } = await import("@/app/api/dashboards/export/route");
    const response = await GET(
      new Request("http://localhost:3000/api/dashboards/export?dashboard=hr&table=list"),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
  });
});

// ---------------------------------------------------------------------------------------------
// Step E2 / AC17-grep — mechanical sanity sweep over EVERY shipped ERP query file.
//
// Belt-and-suspenders on top of the runtime guard, not a replacement for it: `assertReadOnlySql`
// already rejects a forbidden statement at call time, but that only protects statements that are
// actually executed. This sweep proves no write/DDL keyword was ever committed into
// `db/erp-queries/**` at all — across every file P1-P5 accumulated.
//
// If this ever fails it is a PROGRAM-LEVEL HARD STOP (the umbrella's Hard Safety Constraints),
// never something to patch inline.
// ---------------------------------------------------------------------------------------------

describe("AC17 — no shipped ERP query can write to the ERP", () => {
  const queryFiles = readdirSync(resolve(ROOT, "db/erp-queries"), { recursive: true })
    .map(String)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => `db/erp-queries/${f}`);

  it("finds the accumulated query set (guards against an empty-glob false pass)", () => {
    expect(queryFiles.length).toBeGreaterThanOrEqual(13);
  });

  for (const file of queryFiles) {
    it(`${file} passes the real assertReadOnlySql guard`, () => {
      expect(() => assertReadOnlySql(readSource(file))).not.toThrow();
    });

    it(`${file} contains no write/DDL keyword outside comments and string literals`, () => {
      // Normalise exactly the way the guard does: comments stripped, literals and quoted
      // identifiers masked — so prose describing the ban, or a Thai literal, cannot false-positive.
      const normalized = normalizeSqlForGuard(readSource(file));
      for (const rule of FORBIDDEN_KEYWORDS) {
        expect(
          rule.pattern.test(normalized),
          `${file} must not contain the forbidden keyword ${rule.label}`,
        ).toBe(false);
      }
    });
  }
});
