import { NextResponse, type NextRequest } from "next/server";
import { badRequest, currentUserId, unauthorized } from "@/lib/api";
import { reserve, settle, type Spend } from "@/lib/budget";
import { AUDIO_MAX_BYTES, AUDIO_MAX_SECONDS, AUDIO_TYPES, hearingEstimate, transcribe, transcribeConfigured, TranscribeError } from "@/lib/transcribe";

// Writing down a few minutes of speech takes some seconds.
export const maxDuration = 60;

const failure = (code: string, status: number) => NextResponse.json({ error: code }, { status });

/**
 * A recording → what was said in it: the body is the audio itself (`Content-Type: audio/webm`, `audio/mp4`, …), with
 * `?seconds=` (its length, for the allowance) and `?lang=ru` when the person picked a language. Answers
 * `{ text, left }` (`left`: tokens left today). Nothing is stored. Errors: `not_configured` (503), `limit` (429),
 * `too_long` (413), `busy` (503), `failed` (502).
 */
export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  if (!transcribeConfigured()) return failure("not_configured", 503);

  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = AUDIO_TYPES[type];
  if (!ext) return badRequest("Unsupported audio");
  if (Number(req.headers.get("content-length") ?? 0) > AUDIO_MAX_BYTES) return failure("too_long", 413);
  const audio = await req.blob();
  if (!audio.size) return badRequest("Audio is required");
  if (audio.size > AUDIO_MAX_BYTES) return failure("too_long", 413);

  const q = req.nextUrl.searchParams;
  const seconds = Math.min(AUDIO_MAX_SECONDS, Math.max(1, Number(q.get("seconds")) || audio.size / 6000));
  const lang = q.get("lang");
  const language = lang && /^[a-z]{2,3}$/.test(lang) ? lang : null;

  // Set aside before the call, so the day's allowance holds even when requests arrive side by side.
  const hold = await reserve(userId, hearingEstimate(seconds));
  if (!hold) return failure("limit", 429);
  const cost: { spend: Spend | null } = { spend: null };
  try {
    const text = await transcribe(new Blob([audio], { type }), `speech.${ext}`, language, seconds, (spend) => {
      cost.spend = spend;
    });
    const spent = cost.spend ? cost.spend.input + cost.spend.output : hold.estimate;
    return NextResponse.json({ text, left: Math.max(0, hold.left - spent) });
  } catch (e) {
    if (!(e instanceof TranscribeError)) throw e;
    return failure(e.kind, e.kind === "failed" ? 502 : 503);
  } finally {
    await settle(hold, cost.spend);
  }
}
