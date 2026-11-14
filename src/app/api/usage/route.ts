import { NextResponse, type NextRequest } from "next/server";
import { currentUserId, unauthorized } from "@/lib/api";
import { history, today } from "@/lib/budget";
import { draftsConfigured } from "@/lib/drafts";
import { summaryConfigured } from "@/lib/summary";
import { transcribeConfigured } from "@/lib/transcribe";
import type { Usage } from "@/lib/types";

/**
 * The signed-in account's AI allowance for today (UTC): tokens used, tokens left and the whole of it. Hearing speech,
 * sorting it into tasks and the summary in Analytics all draw on it. `features` tells the iOS app which of them this
 * server offers. With `?history=14` it adds what was used on each of the last days (UTC, oldest first, today last): the
 * Usage window draws them.
 */
export async function GET(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const voice = draftsConfigured();
  const days = Number(req.nextUrl.searchParams.get("history"));
  const usage: Usage = {
    today: await today(userId),
    features: { voice, transcribe: voice && transcribeConfigured(), summary: summaryConfigured() },
    ...(days > 0 ? { history: await history(userId, days) } : {}),
  };
  return NextResponse.json(usage, { headers: { "Cache-Control": "no-store" } });
}
