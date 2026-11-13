import { NextResponse, type NextRequest } from "next/server";
import { badRequest, currentUserId, unauthorized } from "@/lib/api";
import { reserve, settle, type Spend } from "@/lib/budget";
import { shiftDay } from "@/lib/drafts";
import { cleanInput, SUMMARY_ESTIMATE, SummaryError, summaryConfigured, writeSummary } from "@/lib/summary";

// A summary takes some seconds; the function may wait out one retry.
export const maxDuration = 60;

const failure = (code: string, status: number) => NextResponse.json({ error: code }, { status });

/**
 * The page's numbers (Progress: a week, a month or a year) → a short summary written by Claude:
 * `{ summary: { headline, points, next }, tokens, left }` (`tokens`: what it cost; `left`: tokens left today). Nothing
 * is stored. Errors: `not_configured` (503), `limit` (429), `refused` (422), `busy` (503), `failed` (502).
 */
export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  if (Number(req.headers.get("content-length") ?? 0) > 64_000) return badRequest("Too much data");
  const input = cleanInput(await req.json().catch(() => null));
  if (!input) return badRequest("Invalid data");
  // The person's own date (the server can't know their time zone): never more than a day from the server's.
  const utc = new Date().toISOString().slice(0, 10);
  if (input.today < shiftDay(utc, -1) || input.today > shiftDay(utc, 1)) return badRequest("Invalid date");
  if (!summaryConfigured()) return failure("not_configured", 503);

  const hold = await reserve(userId, SUMMARY_ESTIMATE);
  if (!hold) return failure("limit", 429);
  const cost: { spend: Spend | null } = { spend: null };
  try {
    const summary = await writeSummary(input, (spend) => {
      cost.spend = spend;
    });
    const tokens = cost.spend ? cost.spend.input + cost.spend.output : hold.estimate;
    return NextResponse.json({ summary, tokens, left: Math.max(0, hold.left - tokens) });
  } catch (e) {
    if (!(e instanceof SummaryError)) throw e;
    return failure(e.kind, e.kind === "refused" ? 422 : e.kind === "failed" ? 502 : 503);
  } finally {
    await settle(hold, cost.spend);
  }
}
