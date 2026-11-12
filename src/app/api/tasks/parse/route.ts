import { NextResponse, type NextRequest } from "next/server";
import { badRequest, currentUserId, unauthorized } from "@/lib/api";
import { sql } from "@/lib/db";
import { DAILY_REQUESTS, DraftError, draftsConfigured, draftTasks, shiftDay, TEXT_MAX } from "@/lib/drafts";
import { isDate } from "@/lib/validate";

// Claude usually answers in a second or two; the function may wait out one retry.
export const maxDuration = 60;

const failure = (code: string, status: number) => NextResponse.json({ error: code }, { status });

/**
 * Text (what was said, or typed) → task drafts: `{ text, today, weekStart? }` → `{ tasks: [{ title, description, date }] }`.
 * Nothing is saved: the client shows the drafts and creates the ones the person keeps with POST /api/tasks.
 * Errors carry a code the clients word themselves: `not_configured` (503), `limit` (429), `refused` (422),
 * `busy` (503), `failed` (502).
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

  // Counted before the call, so the allowance holds even when requests arrive side by side.
  const [usage] = await sql<{ requests: number }[]>`
    insert into ai_usage (user_id, day, requests, chars) values (${userId}, current_date, 1, ${text.length})
    on conflict (user_id, day) do update set requests = ai_usage.requests + 1, chars = ai_usage.chars + excluded.chars
    returning requests`;
  if (usage.requests > DAILY_REQUESTS) return failure("limit", 429);

  try {
    return NextResponse.json({ tasks: await draftTasks(text, today, weekStart) });
  } catch (e) {
    if (!(e instanceof DraftError)) throw e;
    return failure(e.kind, e.kind === "refused" ? 422 : e.kind === "failed" ? 502 : 503);
  }
}
