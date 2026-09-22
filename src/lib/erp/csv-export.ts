// erp-dashboards Phase 5 — the ONE CSV serializer every dashboard export goes through.
//
// DELIBERATELY BUSINESS-LOGIC-FREE. It receives an already-money-filtered, already-BE-formatted
// `{ headers, rows }` shape and turns it into bytes. Which columns exist (the AC9 money gate) and
// how a date is rendered are decided by the caller, never here — so there is exactly one place
// that can leak a money column, and it is the route, not the serializer.
//
// EXCEL-SAFE THAI (AC14): the output starts with a UTF-8 BOM. Without it Excel on Windows opens a
// UTF-8 CSV as cp874/ANSI and every Thai string renders as mojibake. `\r\n` line endings for the
// same reason (RFC 4180 + Excel).
//
// NO NEW DEPENDENCY: hand-rolled, per the SPEC note that .xlsx (and therefore any spreadsheet
// library) is out of scope for this program.

/** Byte-order mark. Written as the escape so the source file itself stays plain ASCII. */
export const UTF8_BOM = "﻿";

/** Maximum data rows in one export file. A spreadsheet-import sanity ceiling, not a DB limit. */
export const CSV_ROW_CAP = 5000;

export type CsvCell = string | number | null | undefined;

export interface CsvTable {
  headers: readonly string[];
  rows: readonly (readonly CsvCell[])[];
}

/**
 * Neutralise a leading formula character so a spreadsheet treats the cell as text.
 *
 * A cell beginning `=`, `+`, `@` or a tab/CR is interpreted as a formula by Excel and Google
 * Sheets. ERP data is user-entered upstream, so an item name starting `=` is possible. A leading
 * `-` is left alone when it introduces a number, because a negative outstanding quantity is real
 * data this program deliberately surfaces.
 */
function neutralizeFormula(text: string): string {
  if (text.length === 0) return text;
  const first = text[0];
  if (first === "=" || first === "+" || first === "@" || first === "\t" || first === "\r") {
    return `'${text}`;
  }
  if (first === "-" && !/^-\d/.test(text)) return `'${text}`;
  return text;
}

/** RFC 4180 field: quote when the value contains a comma, quote or newline; double inner quotes. */
export function csvField(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "number" ? String(value) : neutralizeFormula(String(value));
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export interface CsvRenderResult {
  /** The full file body, BOM included. */
  body: string;
  /** How many data rows were actually written (never more than `cap`). */
  rowsWritten: number;
  /** True when the source had more rows than `cap` and the file carries a truncation notice. */
  truncated: boolean;
  /** The source row count before capping. */
  totalRows: number;
}

/**
 * Serialize a table to a CSV body.
 *
 * TRUNCATION IS VISIBLE, NOT SILENT (AC14): when the source exceeds `cap`, the capped rows are
 * written and a final Thai notice row names both numbers, so a user who opens the file in Excel
 * cannot mistake a partial export for the whole set.
 */
export function renderCsv(table: CsvTable, cap: number = CSV_ROW_CAP): CsvRenderResult {
  const totalRows = table.rows.length;
  const truncated = totalRows > cap;
  const kept = truncated ? table.rows.slice(0, cap) : table.rows;

  const lines: string[] = [table.headers.map(csvField).join(",")];
  for (const row of kept) {
    lines.push(row.map(csvField).join(","));
  }
  if (truncated) {
    lines.push(
      csvField(
        `หมายเหตุ: ไฟล์นี้แสดงเฉพาะ ${cap.toLocaleString("en-US")} แถวแรก ` +
          `จากทั้งหมด ${totalRows.toLocaleString("en-US")} แถว กรุณากรองข้อมูลให้แคบลงแล้วส่งออกอีกครั้ง`,
      ),
    );
  }

  return { body: UTF8_BOM + lines.join("\r\n") + "\r\n", rowsWritten: kept.length, truncated, totalRows };
}

/**
 * Build an ASCII-only download filename.
 *
 * The CONTENT is Thai; the filename is not. Some OS/browser combinations mangle a non-ASCII
 * `Content-Disposition` filename, and a mangled filename is a worse failure than an English one.
 */
export function csvFilename(slug: string, isoDate: string): string {
  const safeSlug = slug.replace(/[^A-Za-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? isoDate : "export";
  return `${safeSlug || "export"}-${safeDate}.csv`;
}

/** The response headers every export shares. */
export function csvHeaders(filename: string, result: CsvRenderResult): Record<string, string> {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
    "X-Export-Rows": String(result.rowsWritten),
    "X-Export-Total-Rows": String(result.totalRows),
    "X-Export-Truncated": result.truncated ? "1" : "0",
  };
}
