import { sql } from "./db";

/**
 * Each person's AI allowance for a day (UTC), in tokens: hearing what was said (OpenAI), sorting it into tasks and
 * writing the summary in Analytics (Anthropic) all draw on the same 10,000. Counted in `ai_usage`, one line per person
 * and day; the words themselves are never stored. The allowance is the same for every account, with no exceptions and
 * no setting that changes it.
 */
export const DAILY_TOKENS = 10_000;

/** What a call cost: tokens read (cached ones included) and tokens written. */
export type Spend = { input: number; output: number };

/** A call's place on today's line: what it set aside, and how much the day had left before it. */
export type Hold = { userId: string; day: string; estimate: number; left: number };

/**
 * Sets `estimate` tokens aside on today's line before a call, so calls side by side can't overdraw the day. Null when
 * the day hasn't that much left: nothing is set aside then. The last call of a day may cost a little more than its
 * estimate; the day simply has nothing left after it.
 */
export async function reserve(userId: string, estimate: number, chars = 0): Promise<Hold | null> {
  const [row] = await sql<{ used: string; day: string }[]>`
    insert into ai_usage (user_id, day, requests, chars, input_tokens) values (${userId}, current_date, 1, ${chars}, ${estimate})
    on conflict (user_id, day) do update set
      requests = ai_usage.requests + 1,
      chars = ai_usage.chars + excluded.chars,
      input_tokens = ai_usage.input_tokens + excluded.input_tokens
    returning (input_tokens + output_tokens)::text as used, day::text as day`;
  const left = DAILY_TOKENS - (Number(row.used) - estimate);
  if (left < estimate) {
    await sql`
      update ai_usage set requests = greatest(0, requests - 1), chars = greatest(0, chars - ${chars}), input_tokens = greatest(0, input_tokens - ${estimate})
      where user_id = ${userId} and day = ${row.day}`;
    return null;
  }
  return { userId, day: row.day, estimate, left };
}

/** Puts what the call really cost in place of what was set aside (nothing, when the call never reached a model). */
export async function settle(hold: Hold, spend: Spend | null) {
  try {
    await sql`
      update ai_usage set
        input_tokens = greatest(0, input_tokens - ${hold.estimate} + ${spend?.input ?? 0}),
        output_tokens = output_tokens + ${spend?.output ?? 0}
      where user_id = ${hold.userId} and day = ${hold.day}`;
  } catch (e) {
    // Counting never stands in the way of the answer.
    console.error("Couldn't record the usage", e);
  }
}

/** Today's allowance: used, left (never below zero) and the whole of it. */
export async function today(userId: string) {
  const [row] = await sql<{ used: string | null }[]>`
    select (select (input_tokens + output_tokens)::text from ai_usage where user_id = ${userId} and day = current_date) as used`;
  const used = Number(row?.used ?? 0);
  return { used, left: Math.max(0, DAILY_TOKENS - used), limit: DAILY_TOKENS };
}

/** A day of the allowance, as the Usage window draws it. */
export type UsageDay = { day: string; tokens: number; requests: number };

/** The last `days` days (UTC, oldest first, today last), every day present: what was used on each. */
export async function history(userId: string, days = 14): Promise<UsageDay[]> {
  const n = Math.max(1, Math.min(60, Math.round(days)));
  const rows = await sql<{ day: string; tokens: string; requests: number }[]>`
    select d::date::text as day, coalesce(u.input_tokens + u.output_tokens, 0)::text as tokens, coalesce(u.requests, 0) as requests
    from generate_series(current_date - ${n - 1}::int, current_date, interval '1 day') d
    left join ai_usage u on u.user_id = ${userId} and u.day = d::date
    order by d`;
  return rows.map((r) => ({ day: r.day, tokens: Number(r.tokens), requests: r.requests }));
}
