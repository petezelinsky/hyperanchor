/**
 * Listening: the browser's own speech recognition (Web Speech API) turns what is said into text. Where the browser has
 * none (Firefox), the voice screen offers typing instead.
 *
 * Browsers differ, so this keeps to what they share: recognition is restarted when the browser ends it by itself (it
 * does after a pause, and on phones after every phrase), the text of earlier stretches is kept, and words still
 * unconfirmed when listening stops are kept too (Safari confirms late).
 */

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

const recognitionClass = (): (new () => Recognition) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const canListen = () => !!recognitionClass();

/** Why listening ended: the person stopped it, a long silence, or something in the way. */
export type StopReason = "stopped" | "silence" | "denied" | "no-microphone" | "network" | "error";

type Handlers = {
  /** What has been heard in this stretch of listening: confirmed words, and the ones still being worked out. */
  onText: (said: string, saying: string) => void;
  /** Words are arriving (true) or there's a pause (false): what the sphere moves to. */
  onSpeaking: (speaking: boolean) => void;
  /** Listening is over, with everything that was heard. */
  onStop: (reason: StopReason, text: string) => void;
};

/** A pause this long after something was said ends the listening by itself. */
const SILENCE_AFTER_WORDS = 4500;
/** Nothing said at all for this long: there's no point in listening on. */
const SILENCE_AT_START = 12_000;
const SPEAKING_HOLD = 700;

const join = (...parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join(" ");

export class Dictation {
  private rec: Recognition | null = null;
  /** Text from stretches the browser has already closed. */
  private kept = "";
  private said = "";
  private saying = "";
  private wanted = false;
  private ended: StopReason | null = null;
  private restarts = 0;
  private silence: ReturnType<typeof setTimeout> | undefined;
  private hold: ReturnType<typeof setTimeout> | undefined;
  private giveUp: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly lang: string,
    private readonly on: Handlers,
  ) {}

  start() {
    const Rec = recognitionClass();
    if (!Rec) return this.finish("error");
    this.wanted = true;
    this.open(Rec);
    this.waitForSilence();
  }

  /** The person is done: the last words are still collected, then `onStop` is called. */
  stop() {
    if (!this.wanted) return;
    this.wanted = false;
    this.ended = "stopped";
    clearTimeout(this.silence);
    try {
      this.rec?.stop();
    } catch {}
    // Some browsers never say they have ended.
    this.giveUp = setTimeout(() => this.finish("stopped"), 1500);
  }

  /** Stops at once and reports nothing (the screen is closing). */
  cancel() {
    this.wanted = false;
    this.ended = null;
    this.clearTimers();
    const rec = this.rec;
    this.rec = null;
    if (rec) {
      rec.onresult = rec.onerror = rec.onend = null;
      try {
        rec.abort();
      } catch {}
    }
  }

  private open(Rec: new () => Recognition) {
    const rec = new Rec();
    // Android's Chrome repeats earlier words when asked to keep listening, so there it hears one phrase at a time.
    const android = /Android/i.test(navigator.userAgent);
    rec.lang = this.lang;
    rec.continuous = !android;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let said = "";
      let saying = "";
      if (android) {
        const last = e.results[e.results.length - 1];
        if (last?.isFinal) said = last[0].transcript;
        else saying = last?.[0].transcript ?? "";
      } else {
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) said = join(said, r[0].transcript);
          else saying = join(saying, r[0].transcript);
        }
      }
      this.said = said;
      this.saying = saying;
      this.restarts = 0;
      this.on.onText(join(this.kept, said), saying);
      this.on.onSpeaking(true);
      clearTimeout(this.hold);
      this.hold = setTimeout(() => this.on.onSpeaking(false), SPEAKING_HOLD);
      this.waitForSilence();
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") this.ended = "denied";
      else if (e.error === "audio-capture") this.ended = "no-microphone";
      else if (e.error === "network") this.ended = "network";
      // "no-speech" and "aborted" are a pause or our own doing: the end handler decides what's next.
    };
    rec.onend = () => {
      if (this.rec !== rec) return;
      // This stretch is over: what it heard is kept, confirmed or not.
      this.kept = join(this.kept, this.said, this.saying);
      this.said = this.saying = "";
      if (this.ended) return this.finish(this.ended);
      if (!this.wanted) return this.finish("stopped");
      // The browser stopped by itself (a pause, its own time limit): listen on. A browser that keeps refusing is left alone.
      if (++this.restarts > 6) return this.finish("error");
      this.on.onText(this.kept, "");
      setTimeout(() => this.wanted && this.rec === rec && this.open(Rec), 120);
    };
    this.rec = rec;
    try {
      rec.start();
    } catch {
      this.finish("error");
    }
  }

  private waitForSilence() {
    clearTimeout(this.silence);
    if (!this.wanted) return;
    const heard = !!join(this.kept, this.said, this.saying);
    this.silence = setTimeout(
      () => {
        if (!this.wanted) return;
        this.wanted = false;
        this.ended = "silence";
        try {
          this.rec?.stop();
        } catch {}
        this.giveUp = setTimeout(() => this.finish("silence"), 1500);
      },
      heard ? SILENCE_AFTER_WORDS : SILENCE_AT_START,
    );
  }

  private clearTimers() {
    clearTimeout(this.silence);
    clearTimeout(this.hold);
    clearTimeout(this.giveUp);
  }

  private finish(reason: StopReason) {
    if (!this.rec && reason !== "error") return;
    const text = join(this.kept, this.said, this.saying);
    const rec = this.rec;
    this.rec = null;
    this.wanted = false;
    this.clearTimers();
    if (rec) {
      rec.onresult = rec.onerror = rec.onend = null;
      try {
        rec.abort();
      } catch {}
    }
    this.on.onSpeaking(false);
    this.on.onStop(reason, text);
  }
}

// Widely spoken languages offered after the browser's own, for people who speak one their browser isn't set to.
const MORE_LANGUAGES = ["en-US", "es-ES", "pt-BR", "fr-FR", "de-DE", "it-IT", "ru-RU", "uk-UA", "pl-PL", "tr-TR", "nl-NL", "ar-SA", "hi-IN", "zh-CN", "ja-JP", "ko-KR"];

/**
 * The languages the person can speak in: the ones their browser lists first (`own`), then other widely spoken ones.
 * One entry per language.
 */
export function spokenLanguages(): { tag: string; name: string; own: boolean }[] {
  if (typeof navigator === "undefined") return [];
  const names = new Intl.DisplayNames(["en"], { type: "language" });
  const seen = new Set<string>();
  const list: { tag: string; name: string; own: boolean }[] = [];
  const add = (tag: string, own: boolean) => {
    const base = tag.split("-")[0].toLowerCase();
    if (seen.has(base)) return;
    seen.add(base);
    list.push({ tag, name: names.of(base) ?? tag, own });
  };
  for (const tag of navigator.languages?.length ? navigator.languages : [navigator.language || "en-US"]) add(tag, true);
  for (const tag of MORE_LANGUAGES) add(tag, false);
  return list;
}

const LANG_KEY = "hyperanchor:voice-language";

export function readSpokenLanguage(): string {
  const list = spokenLanguages();
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && list.some((l) => l.tag === saved)) return saved;
  } catch {}
  return list[0]?.tag ?? "en-US";
}

export function saveSpokenLanguage(tag: string) {
  try {
    localStorage.setItem(LANG_KEY, tag);
  } catch {}
}
