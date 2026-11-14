import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { badRequest, currentUserId, isJson, unauthorized } from "@/lib/api";
import { reserve, settle, type Spend } from "@/lib/budget";
import { sql } from "@/lib/db";
import { shiftDay } from "@/lib/drafts";
import { cleanInput, SUMMARY_ESTIMATE, SummaryError, summaryConfigured, writeSummary } from "@/lib/summary";
import { toUnlock, UNLOCK, type SavedSummary } from "@/lib/summaries";

// A summary takes some seconds; the function may wait out one retry.
export const maxDuration = 60;

const failure = (code: string, status: number) => NextResponse.json({ error: code }, { status });

/**
 * The page's numbers (Analytics: a day, a week, a month or a year) → a short summary written by Claude:
 * `{ summary: { headline, points, next }, saved, tokens, left }` (`saved`: the summary as kept, see SavedSummary;
 * `tokens`: what it cost; `left`: tokens left today).
 *
 * A summary waits for the period to have something in it: UNLOCK tasks done (counted here, from the period's own tasks),
 * and as many again since the last one of the same period, deleted ones included. Older apps that don't name the
 * period's days get a summary as before, unlocked by the count they send, and it isn't kept.
 *
 * Errors: `locked` (403, with `done` and `need`), `not_configured` (503), `limit` (429), `refused` (422), `busy` (503),
 * `failed` (502).
 */
export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  if (!isJson(req)) return badRequest("JSON only");
  if (Number(req.headers.get("content-length") ?? 0) > 64_000) return badRequest("Too much data");
  const input = cleanInput(await req.json().catch(() => null));
  if (!input) return badRequest("Invalid data");
  // The person's own date (the server can't know their time zone): never more than a day from the server's.
  const utc = new Date().toISOString().slice(0, 10);
  if (input.today < shiftDay(utc, -1) || input.today > shiftDay(utc, 1)) return badRequest("Invalid date");
  if (!summaryConfigured()) return failure("not_configured", 503);

  const { period, start, end } = input;
  if (start && end) {
    const [row] = await sql<{ done: string; since: number | null }[]>`
      select
        (select count(*)::text from tasks where user_id = ${userId} and date between ${start} and ${end} and done) as done,
        (select done_count from ai_summaries where user_id = ${userId} and period = ${period} and start_date = ${start}
          order by created_at desc limit 1) as since`;
    const done = Number(row.done);
    if (toUnlock(period, done, row.since) > 0) return NextResponse.json({ error: "locked", done, need: (row.since ?? 0) + UNLOCK[period] }, { status: 403 });
    input.done = done;
  } else if (input.done < UNLOCK[period]) {
    return NextResponse.json({ error: "locked", done: input.done, need: UNLOCK[period] }, { status: 403 });
  }

  const hold = await reserve(userId, SUMMARY_ESTIMATE);
  if (!hold) return failure("limit", 429);
  const cost: { spend: Spend | null } = { spend: null };
  try {
    const summary = await writeSummary(input, (spend) => {
      cost.spend = spend;
    });
    const tokens = cost.spend ? cost.spend.input + cost.spend.output : hold.estimate;
    let saved: SavedSummary | null = null;
    if (start && end) {
      const id = randomUUID();
      const [row] = await sql<{ createdAt: Date }[]>`
        insert into ai_summaries (id, user_id, period, start_date, end_date, label, done_count, summary, tokens)
        values (${id}, ${userId}, ${period}, ${start}, ${end}, ${input.label}, ${input.done}, ${sql.json(summary)}, ${tokens})
        returning created_at as "createdAt"`;
      saved = { id, period, start, end, label: input.label, done: input.done, summary, tokens, createdAt: row.createdAt.toISOString() };
    }
    return NextResponse.json({ summary, saved, tokens, left: Math.max(0, hold.left - tokens) });
  } catch (e) {
    if (!(e instanceof SummaryError)) throw e;
    return failure(e.kind, e.kind === "refused" ? 422 : e.kind === "failed" ? 502 : 503);
  } finally {
    await settle(hold, cost.spend);
  }
}
