import { NextResponse, type NextRequest } from "next/server";
import { badRequest, currentUserId, unauthorized } from "@/lib/api";
import { reserve, settle, type Spend } from "@/lib/budget";
import { DraftError, draftsConfigured, draftTasks, shiftDay, sortingEstimate, TEXT_MAX } from "@/lib/drafts";
import { isDate } from "@/lib/validate";

// Claude usually answers in a second or two; the function may wait out one retry.
export const maxDuration = 60;

const failure = (code: string, status: number) => NextResponse.json({ error: code }, { status });

/**
 * Text (what was said, or typed) → task drafts: `{ text, today, weekStart? }` → `{ tasks: [{ title, description, date }], left }`
 * (`left`: tokens left today). Nothing is saved: the client shows the drafts and creates the ones the person keeps with
 * POST /api/tasks. Errors carry a code the clients word themselves: `not_configured` (503), `limit` (429: not enough
 * tokens left today), `refused` (422), `busy` (503), `failed` (502).
 */
export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return badRequest("Text is required");
  if (text.length > TEXT_MAX) return badRequest("Text is too long");
  // The person's own date (the server can't know their time zone): never more than a day from the server's.
  const today = body?.today;
  const utc = new Date().toISOString().slice(0, 10);
  if (!isDate(today) || today < shiftDay(utc, -1) || today > shiftDay(utc, 1)) return badRequest("Invalid date");
  const weekStart = body?.weekStart === 0 ? 0 : 1;

  if (!draftsConfigured()) return failure("not_configured", 503);

  // Set aside before the call, so the day's allowance holds even when requests arrive side by side.
  const hold = await reserve(userId, sortingEstimate(text), text.length);
  if (!hold) return failure("limit", 429);
  const cost: { spend: Spend | null } = { spend: null };
  try {
    const tasks = await draftTasks(text, today, weekStart, (spend) => {
      cost.spend = spend;
    });
    const spent = cost.spend ? cost.spend.input + cost.spend.output : hold.estimate;
    return NextResponse.json({ tasks, left: Math.max(0, hold.left - spent) });
  } catch (e) {
    if (!(e instanceof DraftError)) throw e;
    return failure(e.kind, e.kind === "refused" ? 422 : e.kind === "failed" ? 502 : 503);
  } finally {
    await settle(hold, cost.spend);
  }
}
