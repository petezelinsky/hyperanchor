import type { Spend } from "./budget";

/**
 * What was said, written down on the server. Browsers' own speech recognition mishears too much (and some have none),
 * so the recording goes to a speech-to-text model instead: OpenAI's gpt-4o-transcribe by default, which hears dozens of
 * languages, mixed ones too, and needs no language picked in advance. Nothing is kept: the audio passes through, and
 * only the text comes back. OPENAI_TRANSCRIBE_MODEL names another model; OPENAI_BASE_URL another OpenAI-compatible
 * service.
 */

const MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe";
const BASE = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");

export const transcribeConfigured = () => !!process.env.OPENAI_API_KEY;

/** Under the 4.5 MB a request may carry on Vercel: about 10 minutes at the bitrate the app records at. */
export const AUDIO_MAX_BYTES = 4 * 1024 * 1024;
/** The longest recording taken at once (the app stops listening before this). */
export const AUDIO_MAX_SECONDS = 300;

/** The kinds of audio browsers record, and the file name the service knows each by. */
export const AUDIO_TYPES: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

/** About what hearing `seconds` of speech costs: a speech model reads about a thousand audio tokens a minute. */
export const hearingEstimate = (seconds: number) => Math.ceil(seconds * 17) + 150;

export type TranscribeFailure = "not_configured" | "busy" | "failed";
export class TranscribeError extends Error {
  constructor(readonly kind: TranscribeFailure) {
    super(kind);
  }
}

/**
 * Writes down what is said in `audio`. `language` (ISO 639-1, "ru") only to fix one; otherwise the model works it out,
 * mixed languages too. `context`: text that came before (the person's latest task titles), so their names and terms,
 * and the way they mix languages, are written the same way. `onUsage` hears what it cost as soon as the service has
 * answered.
 */
export async function transcribe(
  audio: Blob,
  filename: string,
  language: string | null,
  context: string,
  seconds: number,
  onUsage: (spend: Spend) => void,
): Promise<string> {
  if (!transcribeConfigured()) throw new TranscribeError("not_configured");
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", MODEL);
  form.append("response_format", "json");
  if (language) form.append("language", language);
  if (context) form.append("prompt", context);

  let res: Response;
  try {
    res = await fetch(`${BASE}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
      // A minute of speech takes a few seconds; past this something is wrong.
      signal: AbortSignal.timeout(45_000),
    });
  } catch (e) {
    console.error("Speech-to-text is unreachable:", e instanceof Error ? e.message : e);
    throw new TranscribeError("busy");
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    console.error(`Speech-to-text error ${res.status}:`, detail);
    if (res.status === 401 || res.status === 403) throw new TranscribeError("not_configured");
    throw new TranscribeError(res.status === 429 || res.status >= 500 ? "busy" : "failed");
  }
  const body = (await res.json().catch(() => null)) as {
    text?: unknown;
    usage?: { type?: string; input_tokens?: number; output_tokens?: number; seconds?: number };
  } | null;

  // What it cost, for the day's allowance (never the words). Token-billed models say so; others report the length.
  const u = body?.usage;
  const spend: Spend =
    u?.type === "tokens" && typeof u.input_tokens === "number"
      ? { input: u.input_tokens, output: u.output_tokens ?? 0 }
      : { input: hearingEstimate(typeof u?.seconds === "number" ? u.seconds : seconds) - 150, output: 0 };
  console.info(`transcribe: ${spend.input} in, ${spend.output} out, ${Math.round(seconds)} s`);
  onUsage(spend);

  if (typeof body?.text !== "string") throw new TranscribeError("failed");
  return body.text.replace(/\s+/g, " ").trim();
}
