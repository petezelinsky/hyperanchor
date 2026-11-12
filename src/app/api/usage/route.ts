import { NextResponse } from "next/server";
import { currentUserId, unauthorized } from "@/lib/api";
import { sql } from "@/lib/db";
import { DAILY_REQUESTS } from "@/lib/drafts";
import type { Usage } from "@/lib/types";

/**
 * What speaking tasks has cost the signed-in account: how many sortings and how many tokens (input and output
 * together), today (UTC, the day the allowance is counted on), this month and since the beginning.
 */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const [row] = await sql<Record<string, string | number | null>[]>`
    select
      coalesce(sum(requests) filter (where day = current_date), 0) as today_requests,
      coalesce(sum(input_tokens + output_tokens) filter (where day = current_date), 0) as today_tokens,
      coalesce(sum(requests) filter (where day >= date_trunc('month', current_date)), 0) as month_requests,
      coalesce(sum(input_tokens + output_tokens) filter (where day >= date_trunc('month', current_date)), 0) as month_tokens,
      coalesce(sum(requests), 0) as total_requests,
      coalesce(sum(input_tokens + output_tokens), 0) as total_tokens
    from ai_usage where user_id = ${userId}`;
  const n = (key: string) => Number(row?.[key] ?? 0);
  const usage: Usage = {
    today: { requests: n("today_requests"), tokens: n("today_tokens"), limit: DAILY_REQUESTS },
    month: { requests: n("month_requests"), tokens: n("month_tokens") },
    total: { requests: n("total_requests"), tokens: n("total_tokens") },
  };
  return NextResponse.json(usage, { headers: { "Cache-Control": "no-store" } });
}
