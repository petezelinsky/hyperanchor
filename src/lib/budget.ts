import { sql } from "./db";

/**
 * Each person's AI allowance for a day (UTC), in tokens: hearing what was said, sorting it into tasks and writing the
 * summary in Progress all draw on it. Counted in `ai_usage`, one line per person and day; the words themselves are
 * never stored. AI_DAILY_TOKENS can set another allowance.
 */
export const DAILY_TOKENS = Math.max(1000, Math.round(Number(process.env.AI_DAILY_TOKENS) || 10_000));

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
    select (input_tokens + output_tokens)::text as used from ai_usage where user_id = ${userId} and day = current_date`;
  const used = Number(row?.used ?? 0);
  return { used, left: Math.max(0, DAILY_TOKENS - used), limit: DAILY_TOKENS };
}
