import { NextResponse, type NextRequest } from "next/server";
import { badRequest, currentUserId, unauthorized } from "@/lib/api";
import { sql } from "@/lib/db";
import type { SavedSummary, Summary, SummaryPeriod, SummaryState } from "@/lib/summaries";
import { isDate } from "@/lib/validate";

type Row = {
  id: string;
  period: SummaryPeriod;
  start: string;
  end: string;
  label: string;
  done: number;
  summary: Summary;
  tokens: number;
  createdAt: Date;
};

const saved = (r: Row): SavedSummary => ({ ...r, createdAt: r.createdAt.toISOString() });

const COLUMNS = `id, period, start_date::text as start, end_date::text as end, label, done_count as done, summary, tokens, created_at as "createdAt"`;

const PERIODS = new Set(["day", "week", "month", "year"]);

/**
 * The AI summaries kept for the signed-in person.
 * - `?period=week&start=2026-11-09`: that period's state, `{ current, since, total }` (see SummaryState).
 * - No query: every summary kept, newest first, `{ items }` (the history).
 */
export async function GET(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const q = req.nextUrl.searchParams;
  const period = q.get("period");
  const start = q.get("start");
  const headers = { "Cache-Control": "private, no-store" };

  if (period || start) {
    if (!period || !PERIODS.has(period) || !isDate(start)) return badRequest("Invalid period");
    const [current] = await sql<Row[]>`
      select ${sql.unsafe(COLUMNS)} from ai_summaries
      where user_id = ${userId} and period = ${period} and start_date = ${start} and deleted_at is null
      order by created_at desc limit 1`;
    const [row] = await sql<{ since: number | null; total: string }[]>`
      select
        (select done_count from ai_summaries where user_id = ${userId} and period = ${period} and start_date = ${start}
          order by created_at desc limit 1) as since,
        (select count(*)::text from ai_summaries where user_id = ${userId} and deleted_at is null) as total`;
    const state: SummaryState = { current: current ? saved(current) : null, since: row.since, total: Number(row.total) };
    return NextResponse.json(state, { headers });
  }

  const rows = await sql<Row[]>`
    select ${sql.unsafe(COLUMNS)} from ai_summaries
    where user_id = ${userId} and deleted_at is null
    order by created_at desc limit 300`;
  return NextResponse.json({ items: rows.map(saved) }, { headers });
}
