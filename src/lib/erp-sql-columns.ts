// Pure, DB-free static analysis of the dashboard ERP SQL: which `dbo.<Table>.<Column>` pairs does
// each query actually reference?
//
// WHY THIS EXISTS (production defect, 23-09-26): every dashboard page rendered
// "ไม่สามารถเชื่อมต่อระบบ ERP ได้ในขณะนี้" against the live `db_TCL`, while the whole local suite was
// green. The cause was not a bug in any query's logic — it was that the queries named columns that
// DO NOT EXIST on the live tables (`tbl_DOhdr.IsCancel`, `InventoryFlowDtl.Qty`,
// `InventoryFlowHdr.TransactionDate`). They passed locally because the `erp_fixture` sandbox had
// been hand-built from a PROSE data dictionary rather than from the live column list, so the
// fixture had exactly the same invented columns. Fixture and query agreed with each other and both
// disagreed with production.
//
// The fix for the FIXTURE half is `erp-fixture-schema-conformance.test.ts` (fixture DDL diffed
// against `db/erp-schema/live-manifest_*.json`). This module is the QUERY half: it extracts the
// column references out of the SQL text so they can be checked against that same live manifest.
//
// It is deliberately a small, strict analyser rather than a general SQL parser. Anything it cannot
// confidently resolve is reported as an explicit problem for the caller to fail on — it never
// silently drops a reference it did not understand. A gate that skips what it cannot parse is a
// gate that passes vacuously, which is the exact failure mode that caused this defect.

/** A resolved `dbo.<table>.<column>` reference, with the source text that produced it. */
export type ColumnRef = {
  table: string;
  column: string;
  /** How it appeared in the SQL, e.g. `h.IsCancel` or a bare `Roworder`. */
  raw: string;
};

/** Something the analyser refuses to guess about. Every problem must fail the gate. */
export type SqlProblem = { kind: string; detail: string };

export type SqlAnalysis = {
  /** Every `dbo.<Table>` named in a FROM/JOIN at any nesting level. */
  tables: Set<string>;
  /** Alias -> `dbo.<Table>`, for aliases bound to a real base table. */
  aliasToTable: Map<string, string>;
  /** CTE names and derived-table aliases: real SQL names, but NOT base tables. */
  virtualSources: Set<string>;
  /** Resolved qualified references (`alias.Column`). */
  refs: ColumnRef[];
  /** Bare identifiers that are neither keyword, alias, CTE, nor locally-defined alias. */
  bareIdentifiers: Set<string>;
  /**
   * EVERY identifier-shaped word in the code, including ones excluded above. Used to prove a
   * declared column is genuinely mentioned by the file rather than filler added to satisfy a check.
   */
  allIdentifiers: Set<string>;
  problems: SqlProblem[];
};

/**
 * Remove `--` comments, `/* *\/` comments, and string literals, replacing each with a space.
 *
 * Comment stripping is not cosmetic — it is load-bearing. Several of these queries DOCUMENT the
 * removed bad columns in their headers ("an earlier draft branched on `h.IsCancel`"), so a text
 * scan that skipped this step would flag the explanatory comment as a live defect forever.
 */
export function stripSqlNoise(sql: string): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const two = sql.slice(i, i + 2);
    if (two === "--") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end;
      out += " ";
      continue;
    }
    if (two === "/*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      out += " ";
      continue;
    }
    // `N'...'` (unicode literal) must consume the N too, or a stray `N` is left behind as a
    // phantom bare identifier.
    const isUnicodeLiteral = (sql[i] === "N" || sql[i] === "n") && sql[i + 1] === "'";
    if (sql[i] === "'" || isUnicodeLiteral) {
      i += isUnicodeLiteral ? 2 : 1;
      while (i < sql.length) {
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            i += 2; // escaped quote inside the literal
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      out += " ";
      continue;
    }
    out += sql[i];
    i += 1;
  }
  return out;
}

/**
 * SQL keywords, built-in functions, and data types that appear as bare words in these queries.
 *
 * Kept explicit rather than inferred: an unknown bare word FAILS the gate, so the worst a missing
 * entry can do is force a human to look at it. The opposite trade (guessing that unknown words are
 * harmless) is what lets a typo'd column name through.
 */
const SQL_WORDS = new Set(
  [
    // statement / clause keywords
    "with", "as", "select", "distinct", "top", "from", "where", "join", "inner", "left", "right",
    "full", "outer", "cross", "apply", "on", "group", "by", "order", "having", "union", "all",
    "except", "intersect", "and", "or", "not", "in", "exists", "between", "like", "is", "null",
    "case", "when", "then", "else", "end", "asc", "desc", "over", "partition", "rows", "range",
    "offset", "fetch", "next", "first", "only", "then", "set", "values", "into", "for", "option",
    // functions
    "count", "sum", "min", "max", "avg", "coalesce", "nullif", "isnull", "cast", "convert", "try_cast",
    "try_convert", "ltrim", "rtrim", "trim", "len", "left", "right", "substring", "replace", "upper",
    "lower", "abs", "round", "floor", "ceiling", "row_number", "rank", "dense_rank", "getdate",
    "dateadd", "datediff", "datepart", "year", "month", "day", "eomonth", "iif", "concat", "sign",
    // types used in CAST/CONVERT
    "int", "bigint", "smallint", "tinyint", "bit", "decimal", "numeric", "float", "real", "money",
    "date", "datetime", "datetime2", "time", "char", "varchar", "nchar", "nvarchar", "max",
    // schema prefix
    "dbo",
  ].map((w) => w.toLowerCase()),
);

const IDENTIFIER = "[A-Za-z_][A-Za-z0-9_]*";

/** `FROM dbo.X alias` / `JOIN dbo.X AS alias` — base-table bindings. */
const BASE_SOURCE_RE = new RegExp(
  `\\b(?:FROM|JOIN)\\s+dbo\\.(${IDENTIFIER})(?:\\s+(?:AS\\s+)?(${IDENTIFIER}))?`,
  "gi",
);

/** `FROM SomeCte alias` / `JOIN SomeCte AS alias` — non-`dbo.` sources. */
const VIRTUAL_SOURCE_RE = new RegExp(
  `\\b(?:FROM|JOIN)\\s+(?!dbo\\.)(${IDENTIFIER})(?:\\s+(?:AS\\s+)?(${IDENTIFIER}))?`,
  "gi",
);

/** `WITH Name AS (` and `, Name AS (` — common table expressions. */
const CTE_RE = new RegExp(`(?:\\bWITH\\b|,)\\s*(${IDENTIFIER})\\s+AS\\s*\\(`, "gi");

/**
 * `) alias ON ...` / `) alias WHERE ...` — a derived table given an alias.
 *
 * The lookahead is deliberately narrow (clause keywords only). A looser one that also accepted
 * `)`, `,` or end-of-input swallowed ordinary select-list aliases — `MAX(q.CustName) AS CustName,`
 * and `ORDER BY SUM(h.TotalAmount) DESC` — into the set of names the analyser treats as "a source I
 * need not check". Anything in that set is EXEMPT from the manifest, so over-matching here quietly
 * widens the blind spot this whole module exists to close.
 */
const DERIVED_ALIAS_RE = new RegExp(
  `\\)\\s*(?:AS\\s+)?(${IDENTIFIER})\\b(?=\\s*(?:ON|WHERE|GROUP\\s+BY|ORDER\\s+BY|JOIN|LEFT|RIGHT|INNER|CROSS))`,
  "gi",
);

/** `... AS ColumnAlias` in a select list — a NAME THIS QUERY DEFINES, not one it reads. */
const COLUMN_ALIAS_RE = new RegExp(`\\bAS\\s+(${IDENTIFIER})`, "gi");

const QUALIFIED_REF_RE = new RegExp(`(?<![@\\w.])(${IDENTIFIER})\\.(${IDENTIFIER})`, "g");

/** Words in a keyword position that must never be mistaken for a source name. */
const NOT_A_SOURCE = new Set(["select", "dbo"]);

/**
 * Statically analyse one SQL statement.
 *
 * Alias resolution is file-global, not lexically scoped: these queries consistently use one alias
 * per table throughout a file (`h` header, `d` detail, `i` item). That is an assumption, so it is
 * ENFORCED — an alias bound to two different base tables in the same file is reported as a problem
 * instead of being resolved arbitrarily.
 */
export function analyseSql(rawSql: string): SqlAnalysis {
  const code = stripSqlNoise(rawSql);
  const problems: SqlProblem[] = [];

  const tables = new Set<string>();
  const aliasToTable = new Map<string, string>();
  const virtualSources = new Set<string>();

  const cteNames = new Set([...code.matchAll(CTE_RE)].map(([, name]) => name.toLowerCase()));
  for (const cte of cteNames) virtualSources.add(cte);
  for (const [, alias] of code.matchAll(DERIVED_ALIAS_RE)) virtualSources.add(alias.toLowerCase());

  for (const [, table, alias] of code.matchAll(BASE_SOURCE_RE)) {
    const qualified = `dbo.${table}`;
    tables.add(qualified);
    // No alias means the table name itself is the qualifier.
    const key = (alias && !SQL_WORDS.has(alias.toLowerCase()) ? alias : table).toLowerCase();
    const existing = aliasToTable.get(key);
    if (existing && existing !== qualified) {
      problems.push({
        kind: "ambiguous-alias",
        detail: `alias "${key}" is bound to both ${existing} and ${qualified} in one statement; rename one so every reference resolves to exactly one table`,
      });
    }
    aliasToTable.set(key, qualified);
  }

  for (const [, source, alias] of code.matchAll(VIRTUAL_SOURCE_RE)) {
    if (NOT_A_SOURCE.has(source.toLowerCase())) continue;
    virtualSources.add(source.toLowerCase());
    if (alias && !SQL_WORDS.has(alias.toLowerCase())) virtualSources.add(alias.toLowerCase());
  }

  const columnAliases = new Set(
    [...code.matchAll(COLUMN_ALIAS_RE)].map(([, name]) => name.toLowerCase()),
  );

  // Scrub the exempt-source set before it is used. A select-list alias or a stray keyword that
  // slipped through the source regexes would otherwise grant a blanket manifest exemption to any
  // reference qualified with that name.
  for (const name of [...virtualSources]) {
    if (SQL_WORDS.has(name) || aliasToTable.has(name)) virtualSources.delete(name);
  }
  for (const alias of columnAliases) {
    // A CTE and a column alias may legitimately share a name; the CTE declaration wins.
    if (!cteNames.has(alias)) virtualSources.delete(alias);
  }

  const refs: ColumnRef[] = [];
  for (const [raw, qualifier, column] of code.matchAll(QUALIFIED_REF_RE)) {
    const key = qualifier.toLowerCase();
    const table = aliasToTable.get(key);
    if (table) {
      refs.push({ table, column, raw });
      continue;
    }
    if (virtualSources.has(key)) continue; // reads a CTE/derived column, checked at its definition
    if (key === "dbo") continue;
    problems.push({
      kind: "unresolved-qualifier",
      detail: `"${raw}" uses qualifier "${qualifier}", which is not a table alias, CTE, or derived-table alias in this statement`,
    });
  }

  // Bare identifiers: everything left after removing qualified refs, locally-defined column
  // aliases, source names, and the SQL vocabulary. These are the unqualified column reads.
  const allIdentifiers = new Set(
    [...code.matchAll(new RegExp(IDENTIFIER, "g"))].map(([word]) => word),
  );

  const withoutQualified = code.replace(QUALIFIED_REF_RE, " ");
  const bareIdentifiers = new Set<string>();
  for (const [word] of withoutQualified.matchAll(new RegExp(`(?<![@\\w.])${IDENTIFIER}`, "g"))) {
    const key = word.toLowerCase();
    if (SQL_WORDS.has(key)) continue;
    if (columnAliases.has(key)) continue;
    if (aliasToTable.has(key)) continue;
    if (virtualSources.has(key)) continue;
    if (tables.has(`dbo.${word}`)) continue;
    bareIdentifiers.add(word);
  }

  return { tables, aliasToTable, virtualSources, refs, bareIdentifiers, allIdentifiers, problems };
}
