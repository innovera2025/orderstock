/**
 * erp-dashboards Phase 5, Step G — the MANUAL, HUMAN-RUN live reconcile check.
 *
 * ============================================================================================
 *  READ THIS BEFORE RUNNING. THIS IS THE ONLY PART OF THIS PROGRAM THAT TOUCHES db_TCL.
 * ============================================================================================
 *
 * WHAT IT DOES: connects to an ERP database READ-ONLY, runs the exact same SELECT statements the
 * dashboards run, and prints a side-by-side table of each headline figure next to the value a
 * human read off KRS's own report (`sp_PurchaseInvoiceMonth`, `sp_Popending`, and the production
 * MO listing), with the difference. It then exits. It is a printed comparison report and nothing
 * else.
 *
 * WHAT IT CANNOT DO — by construction, not by convention:
 *   - It cannot write. Every statement goes through `guardedQuery()`, Phase 1's single choke
 *     point: a statement must be ONE SELECT/WITH and must contain none of the 19 forbidden
 *     keywords, checked BEFORE the connection is touched. There is no second query path here.
 *   - It cannot call a stored procedure. `EXEC`/`EXECUTE` is on the denylist, so this script can
 *     never invoke `sp_PurchaseInvoiceMonth` or `sp_Popending` itself. It reproduces their rule
 *     in SELECT form (the same SQL the dashboards ship) and compares against the number a human
 *     read off the ERP's own printed report — which is the point of the exercise.
 *   - It cannot read `.env`. The connection string must be supplied explicitly in the
 *     environment; there is no file fallback, deliberately, so nobody can run this against a
 *     database they did not consciously name on the command line.
 *   - It cannot run by accident. `ERP_RECONCILE_CONFIRM=1` is required and has no default.
 *
 * ---------------------------------------------------------------------------------------------
 * HOW TO RUN (a human does this; never an agent, never CI)
 * ---------------------------------------------------------------------------------------------
 *
 *   ERP_RECONCILE_CONFIRM=1 \
 *   ERP_DATABASE_URL='sqlserver://HOST:1433;database=db_TCL;user=USER;password=PASS;encrypt=true;trustServerCertificate=true' \
 *   pnpm tsx src/lib/erp/live-reconcile-script.ts --from 2026-08-01 --to 2026-09-30
 *
 * Optional: supply the figures read off KRS's own reports to get a computed difference column.
 *
 *   --expect-purchase-invoice 461140      (from sp_PurchaseInvoiceMonth for the same range)
 *   --expect-purchase-po      727920      (from the PO listing for the same range)
 *   --expect-sales-do-count   14          (from the delivery-order listing)
 *   --expect-mo-count         11          (from the MO listing)
 *
 * Use a shell that does not persist history (or a leading space) so the connection string is not
 * written to your shell history file. Nothing in this script logs the connection string.
 *
 * ---------------------------------------------------------------------------------------------
 * A NOTE ON WHAT A DIFFERENCE MEANS
 * ---------------------------------------------------------------------------------------------
 * A non-zero difference is NOT automatically a bug in this application. The Sales dashboard
 * deliberately excludes the wider `SalesInvoiceHdr` pool (and discloses it in a footnote), and the
 * purchase invoice basis deliberately reproduces `sp_PurchaseInvoiceMonth`'s own filter including
 * the rows it drops. Read the difference alongside the dashboard's own disclosure notes before
 * concluding anything.
 */

import { ConnectionPool } from "mssql";
import { guardedQuery, type ErpQueryParams } from "./erp-adapter";
import { parseJdbcSqlServerUrl } from "./pool";
import { DO_HEADERS_SQL, DO_LINES_SQL, SALES_INVOICE_EXCLUDED_TOTAL_SQL } from "../sales-sql";
import { PO_RECEIVED_SQL, TOTAL_INVOICE_BASIS_SQL, TOTAL_PO_COMMITTED_BASIS_SQL } from "../purchase-sql";
import { MO_LIST_SQL } from "../production-sql";

interface Options {
  from: string;
  to: string;
  expect: Record<string, number | undefined>;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseArgs(argv: readonly string[]): Options {
  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  const num = (flag: string): number | undefined => {
    const raw = get(flag);
    if (raw === undefined) return undefined;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new Error(`${flag} must be a number, received "${raw}"`);
    }
    return value;
  };

  const from = get("--from");
  const to = get("--to");
  if (!from || !ISO_DATE.test(from) || !to || !ISO_DATE.test(to)) {
    throw new Error("--from and --to are required and must be CE dates in yyyy-mm-dd form.");
  }

  return {
    from,
    to,
    expect: {
      purchaseInvoice: num("--expect-purchase-invoice"),
      purchasePo: num("--expect-purchase-po"),
      salesDoCount: num("--expect-sales-do-count"),
      moCount: num("--expect-mo-count"),
    },
  };
}

/** Fail loudly and early rather than connecting to something nobody meant to connect to. */
function requireExplicitConsent(): string {
  if (process.env.ERP_RECONCILE_CONFIRM !== "1") {
    throw new Error(
      "Refusing to run. This script connects to a LIVE ERP database. Set ERP_RECONCILE_CONFIRM=1 " +
        "to confirm you intend that, and supply ERP_DATABASE_URL in the same command.",
    );
  }
  // Deliberately NOT `resolveErpDatabaseUrl()`: that helper falls back to reading the `.env` file,
  // and this script must connect only to a database named explicitly at invocation time.
  const url = process.env.ERP_DATABASE_URL;
  if (!url || url.length === 0) {
    throw new Error(
      "ERP_DATABASE_URL must be set in the environment for this run. This script never reads .env.",
    );
  }
  return url;
}

function toNumber(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

interface Row {
  area: string;
  figure: string;
  ours: number;
  reference?: number;
  note: string;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function printTable(rows: readonly Row[]): void {
  const header = ["AREA", "FIGURE", "THIS APP", "ERP REPORT", "DIFF", "NOTE"];
  const body = rows.map((row) => {
    const reference = row.reference;
    return [
      row.area,
      row.figure,
      formatNumber(row.ours),
      reference === undefined ? "(not supplied)" : formatNumber(reference),
      reference === undefined ? "-" : formatNumber(row.ours - reference),
      row.note,
    ];
  });

  const widths = header.map((_, i) =>
    Math.max(header[i].length, ...body.map((cells) => cells[i].length)),
  );
  const line = (cells: readonly string[]) =>
    cells.map((cell, i) => cell.padEnd(widths[i])).join("  ").trimEnd();

  console.log(line(header));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const cells of body) console.log(line(cells));
}

async function main(): Promise<void> {
  const url = requireExplicitConsent();
  const options = parseArgs(process.argv.slice(2));

  const pool = new ConnectionPool(parseJdbcSqlServerUrl(url));
  await pool.connect();

  // Every call below goes through the guard. `params` mirrors what each dashboard binds.
  const range: ErpQueryParams = { from: options.from, to: options.to };

  try {
    const salesParams: ErpQueryParams = {
      ...range,
      doNo: null,
      customer: null,
      product: null,
      status: null,
      cat: null,
      skipStatus: false,
      skipCat: false,
    };

    const [doHeaders, doLines, excluded] = await Promise.all([
      guardedQuery<Record<string, unknown>>(pool, DO_HEADERS_SQL, salesParams),
      guardedQuery<Record<string, unknown>>(pool, DO_LINES_SQL, salesParams),
      guardedQuery<Record<string, unknown>>(pool, SALES_INVOICE_EXCLUDED_TOTAL_SQL, {}),
    ]);

    const purchaseParams: ErpQueryParams = { ...range, supplier: null };
    const [invoices, poTotals, received] = await Promise.all([
      guardedQuery<Record<string, unknown>>(pool, TOTAL_INVOICE_BASIS_SQL, purchaseParams),
      guardedQuery<Record<string, unknown>>(pool, TOTAL_PO_COMMITTED_BASIS_SQL, purchaseParams),
      guardedQuery<Record<string, unknown>>(pool, PO_RECEIVED_SQL, { poNumber: null }),
    ]);

    const mos = await guardedQuery<Record<string, unknown>>(pool, MO_LIST_SQL, {
      ...range,
      status: null,
      skipStatus: true,
    });

    const pricedLines = doLines.filter((line) => toNumber(line.Saleprice) !== 0);
    const pricedAmount = pricedLines.reduce((sum, line) => sum + toNumber(line.Amount), 0);
    const invoiceTotal = invoices.reduce((sum, row) => sum + toNumber(row.TotalAmount), 0);
    const poRow = poTotals[0] ?? {};
    const excludedRow = excluded[0] ?? {};

    console.log("");
    console.log(`ERP DASHBOARD RECONCILE — ${options.from} .. ${options.to} (READ-ONLY)`);
    console.log(`Run at ${new Date().toISOString()}`);
    console.log("");

    printTable([
      {
        area: "Sales",
        figure: "Delivery orders (count)",
        ours: doHeaders.length,
        reference: options.expect.salesDoCount,
        note: "DO basis; compare with the DO listing for the same range",
      },
      {
        area: "Sales",
        figure: "Order lines (count)",
        ours: doLines.length,
        note: "quantities are per-unit and are never summed across units",
      },
      {
        area: "Sales",
        figure: "Priced-line amount (THB)",
        ours: pricedAmount,
        note: `priced lines only: ${pricedLines.length} of ${doLines.length}`,
      },
      {
        area: "Sales",
        figure: "EXCLUDED invoice pool (THB)",
        ours: toNumber(excludedRow.ExcludedTotal),
        note: `${toNumber(excludedRow.InvoiceCount)} invoices this dashboard deliberately excludes`,
      },
      {
        area: "Purchase",
        figure: "Invoice basis total (THB)",
        ours: invoiceTotal,
        reference: options.expect.purchaseInvoice,
        note: "compare with sp_PurchaseInvoiceMonth for the same range",
      },
      {
        area: "Purchase",
        figure: "PO committed total (THB)",
        ours: toNumber(poRow.TotalPoCommitted),
        reference: options.expect.purchasePo,
        note: `${toNumber(poRow.PoCount)} POs / ${toNumber(poRow.SupplierCount)} suppliers, cancelled excluded`,
      },
      {
        area: "Purchase",
        figure: "PO receipt lines (count)",
        ours: received.length,
        note: "sp_Popending's own join; compare with the PO ค้างรับ report",
      },
      {
        area: "Production",
        figure: "Manufacturing orders (count)",
        ours: mos.length,
        reference: options.expect.moCount,
        note: "PLAN ONLY — this program never reports an actual produced quantity",
      },
    ]);

    console.log("");
    console.log("A difference is not automatically a defect — read it against each dashboard's own");
    console.log("disclosure notes (excluded invoice pool, sp_PurchaseInvoiceMonth's own filter,");
    console.log("plan-only production) before drawing a conclusion.");
    console.log("");
    console.log("No data was written. This script cannot write: every statement passed the");
    console.log("read-only guard, and EXEC/stored-procedure calls are rejected outright.");
    console.log("");
  } finally {
    await pool.close();
  }
}

main().catch((error: unknown) => {
  // Never print the connection string or driver config — only the message.
  console.error(`\nRECONCILE FAILED: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
