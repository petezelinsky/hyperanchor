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

const saved = ({ id, period, start, end, label, done, summary, tokens, createdAt }: Row): SavedSummary => ({ id, period, start, end, label, done, summary, tokens, createdAt: createdAt.toISOString() });

const COLUMNS = `id, period, start_date::text as start, end_date::text as end, label, done_count as done, summary, tokens, created_at as "createdAt"`;

const PERIODS = new Set(["day", "week", "month", "year"]);

/**
 * The AI summaries kept for the signed-in person.
 * - `?period=week&start=2026-11-09`: that period's state, `{ current, since, total }` (see SummaryState).
 * - `?keys=day:2026-11-14,week:2026-11-09,…` (up to eight): those periods' states at once, `{ states: { [key]: … } }`.
 * - No query: every summary kept, newest first, `{ items }` (the history).
 */
export async function GET(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const q = req.nextUrl.searchParams;
  const period = q.get("period");
  const start = q.get("start");
  const headers = { "Cache-Control": "private, no-store" };

  const keys = q.get("keys");
  if (keys) {
    const wanted = keys
      .split(",")
      .slice(0, 8)
      .map((k) => k.split(":"))
      .filter((k): k is [string, string] => k.length === 2 && PERIODS.has(k[0]) && isDate(k[1]));
    const [{ total }] = await sql<{ total: string }[]>`select count(*)::text as total from ai_summaries where user_id = ${userId} and deleted_at is null`;
    const states: Record<string, SummaryState> = {};
    for (const [p, s] of wanted) {
      // The latest line of the period, deleted or not, says what the next one has to beat; the latest kept one is shown.
      const rows = await sql<(Row & { deleted: boolean })[]>`
        select ${sql.unsafe(COLUMNS)}, deleted_at is not null as deleted from ai_summaries
        where user_id = ${userId} and period = ${p} and start_date = ${s}
        order by created_at desc limit 20`;
      const kept = rows.find((r) => !r.deleted);
      states[`${p}:${s}`] = { current: kept ? saved(kept) : null, since: rows[0]?.done ?? null, total: Number(total) };
    }
    return NextResponse.json({ states }, { headers });
  }

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
