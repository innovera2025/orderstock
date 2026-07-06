import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Route Handlers are static by default; this must hit the DB on every request.
export const dynamic = "force-dynamic";

/**
 * DB connectivity health check. Returns { ok: true } when a trivial `SELECT 1`
 * against the sandbox SQL Server succeeds, otherwise { ok: false, error } with 500.
 *
 * SECURITY: the error path returns a SANITIZED, fixed message only — it never echoes
 * the raw connection string, SA password, or a full stack trace to the client. The
 * detailed error is logged server-side for the operator.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Log the real error server-side only (never returned to the client).
    console.error("[health] database connectivity check failed:", error);
    return NextResponse.json(
      { ok: false, error: "Database connection failed" },
      { status: 500 },
    );
  }
}
