"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addDays, formatMedium, parseYmd, relativeDay, startOfWeek, ymd, type WeekStart } from "@/lib/dates";
import type { TaskDraft, Usage } from "@/lib/types";
import { DRAFT_TEXT_MAX as TEXT_MAX } from "@/lib/validate";
import { m, tr, trn } from "@/lib/i18n";
import { AutoTextarea } from "../AutoTextarea";
import { ChevronDown, XIcon } from "../icons";
import { reducedMotion } from "../motion";
import { MiniMonth } from "../Sidebar";
import { Button, IconButton, Kbd, Menu, Popover, type MenuEntry } from "../ui";
import { canListen, Dictation, spokenLanguage, type StopReason } from "./dictation";
import { canMeter, Meter } from "./meter";
import { Orb } from "./Orb";
import { ParticleRing, type RingMode } from "./ParticleRing";
import { canRecord, Recorder, type Recorded, type RecordStop } from "./recorder";

/** A task understood from what was said; `fresh` until it has come into the sheet once. */
type Draft = TaskDraft & { key: number; fresh?: boolean };
/** Listening; writing down what was said (on the server); waiting for the tasks to come back; or at rest. */
type Phase = "listening" | "hearing" | "sorting" | "idle";
/**
 * Something went wrong, in words. `again`: the text to sort once more, `audio`: the recording to write down once more,
 * when trying again makes sense.
 */
type Problem = { message: string; again?: string; audio?: Recorded } | null;

const LIMIT = m("That’s all of today’s AI tokens. More tomorrow.");
/** About the least a short note costs to hear and sort: with less left today, listening doesn't start. */
const ENOUGH = 2100;
const PROBLEMS: Record<string, string> = {
  limit: LIMIT,
  not_configured: m("Sorting into tasks isn’t set up on this server yet."),
  refused: m("That couldn’t be sorted into tasks. Try saying it another way."),
  busy: m("The sorter is busy right now."),
  failed: m("That couldn’t be sorted into tasks."),
};
const HEARING: Record<string, string> = {
  limit: LIMIT,
  not_configured: m("Listening isn’t set up on this server yet. Type instead."),
  too_long: m("That was too long to write down at once. Say it in two or three parts."),
  busy: m("Couldn’t write that down right now. Try again in a moment."),
  failed: m("That couldn’t be written down. Try again."),
};
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
/** The least time the sphere spends thinking: about one turn of its wave, so the pause reads as thought, not as a stall. */
const THINK_MS = 1900;

/**
 * Speak your tasks: the whole screen, plain. The sphere listens in the middle and moves to every sound. Where the server
 * hears speech itself (`server`), the voice is recorded and written down there once the person stops — in any language,
 * worked out without asking (Settings can name one); elsewhere the browser's own recognition writes the words under the
 * sphere as they come. Once the person stops, the sphere thinks (one smooth wave goes round it, clockwise, and the dots
 * it passes swell) while the words are written down and sorted; then a sheet with the tasks comes up from under the
 * screen and lifts the stage with it: the sphere stays in sight above, smaller, and the sheet never takes more than half
 * the screen (a long list scrolls inside it). Each task can be reworded, moved to another day (any day, from a
 * calendar) or left out. The sheet can be pulled down and brought back. From there it's one step to add them, to speak
 * some more, or to leave.
 * Typing (or pasting) works the same way, and takes over where the browser can't listen.
 */
export function VoiceScreen({
  todayKey,
  weekStart,
  server,
  sample,
  onAdd,
  onClose,
}: {
  todayKey: string;
  weekStart: WeekStart;
  /** The server writes down what is said (a speech model); otherwise the browser's recognition does. */
  server: boolean;
  /** The person's latest task titles: what the spoken language is guessed from. */
  sample: string[];
  onAdd: (drafts: TaskDraft[]) => void;
  onClose: () => void;
}) {
  // Recorded and written down on the server where it can, else heard by the browser itself.
  const record = useMemo(() => server && canRecord(), []);
  const hears = useMemo(() => record || canListen(), []);
  const language = useMemo(() => spokenLanguage(sample), []); // for this opening of the screen
  const [typing, setTyping] = useState(!hears);
  const [phase, setPhase] = useState<Phase>(hears ? "listening" : "idle");
  const [said, setSaid] = useState("");
  const [saying, setSaying] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [problem, setProblem] = useState<Problem>(null);
  // Today's tokens are used up: nothing more can be heard or sorted until tomorrow.
  const [spent, setSpent] = useState(false);
  // The window with the tasks: up from the moment sorting starts.
  const [review, setReview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [dayMenu, setDayMenu] = useState<{ key: number; anchor: DOMRect; trigger: HTMLElement } | null>(null);
  const [calendar, setCalendar] = useState<{ key: number; anchor: DOMRect; trigger: HTMLElement; y: number; m: number } | null>(null);
  // How far the sheet is being pulled down (px), while it's held.
  const [pull, setPull] = useState(0);

  const dialog = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const words = useRef<HTMLParagraphElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const ring = useRef<ParticleRing | null>(null);
  const dictation = useRef<Dictation | null>(null);
  const recorder = useRef<Recorder | null>(null);
  const meter = useRef<Meter | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const alive = useRef(true);
  const nextKey = useRef(1);
  // Latest values for handlers that outlive a render (recognition callbacks, key listeners).
  const latest = useRef({ todayKey, weekStart, drafts, phase, typing, text, problem, review, confirming });
  latest.current = { todayKey, weekStart, drafts, phase, typing, text, problem, review, confirming };

  /** The microphone closes: the recording (if any) is dropped, the meter stops. */
  const hush = useCallback(() => {
    recorder.current?.cancel();
    recorder.current = null;
    meter.current?.stop();
    meter.current = null;
  }, []);

  /**
   * Sends `words` to be sorted; the tasks that come back join the ones already there. Spoken, the sphere thinks for at
   * least a moment, breathes out, and the sheet comes up; typed, the sheet comes up at once with lines filling in.
   */
  const sort = useCallback(async (words: string) => {
    const clean = words.trim();
    if (!clean) return;
    if (clean.length > TEXT_MAX) {
      setPhase("idle");
      setReview(true);
      return setProblem({ message: tr("That’s too much for one go. Sort it in two or three parts.") });
    }
    const spoken = !latest.current.typing && !!canvas.current;
    const began = performance.now();
    setPhase("sorting");
    setProblem(null);
    setConfirming(false);
    if (spoken) setReview(false);
    else setReview(true);
    // Spoken: the sheet waits for the sphere to have thought for a moment, then comes up as it breathes out.
    const settle = async () => {
      if (!spoken) return;
      const wait = THINK_MS - (performance.now() - began);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      if (!alive.current) return;
      ring.current?.pulse();
      setReview(true);
    };
    try {
      const res = await fetch("/api/tasks/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, today: latest.current.todayKey, weekStart: latest.current.weekStart }),
      });
      if (!alive.current) return;
      if (res.status === 401) return window.location.reload(); // the session ran out: back to signing in
      if (!res.ok) {
        const code = ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "failed";
        if (code === "limit") setSpent(true);
        setProblem({ message: tr(PROBLEMS[code] ?? PROBLEMS.failed), again: code === "busy" || code === "failed" ? clean : undefined });
      } else {
        const { tasks } = (await res.json()) as { tasks: TaskDraft[] };
        if (!alive.current) return;
        await settle();
        if (!alive.current) return;
        setSaid("");
        setText("");
        if (tasks.length) setDrafts((list) => [...list, ...tasks.map((t) => ({ ...t, key: nextKey.current++, fresh: true }))]);
        else setProblem({ message: tr("No tasks in that. Say what you need to do, and when.") });
      }
    } catch {
      if (!alive.current) return;
      setProblem({ message: tr("You’re offline. What you said is kept: try again when you’re back."), again: clean });
    }
    if (!alive.current) return;
    // Whatever came of it, the sheet is up now (with the tasks, or with what went wrong).
    setReview(true);
    setPhase("idle");
  }, []);

  const heard = useCallback(
    (reason: StopReason, words: string) => {
      dictation.current = null;
      hush();
      setSaying("");
      setSpeaking(false);
      // Whatever ended the listening, words that were heard are sorted: nothing said is lost to a late hiccup.
      if (words.trim()) {
        setSaid(words);
        return void sort(words);
      }
      setPhase("idle");
      setProblem({
        message:
          reason === "denied"
            ? tr("The microphone is blocked for this site. Allow it in the address bar, or type instead.")
            : reason === "no-microphone"
              ? tr("No microphone was found. Connect one, or type instead.")
              : reason === "network"
                ? tr("Listening needs a connection. Try again, or type instead.")
                : reason === "error"
                  ? tr("Listening didn’t start. Try again, or type instead.")
                  : tr("Nothing was heard. Try again a little closer to the microphone."),
      });
    },
    [sort, hush],
  );

  /** Sends a recording to be written down; the words that come back are sorted into tasks. */
  const hear = useCallback(
    async (audio: Recorded) => {
      setPhase("hearing");
      setProblem(null);
      try {
        const q = new URLSearchParams({ seconds: audio.seconds.toFixed(1) });
        // No language is named: the speech model hears it, and a mix of them (Russian with English words in it) stays a
        // mix. What it gets instead is the person's latest task titles, as the words that came before: their names,
        // their terms, and the way they mix languages, so those come back written the same way.
        // (In a header, not the address: addresses end up in request logs.)
        const context = sample.slice(0, 12).join(". ").slice(0, 400);
        const headers: Record<string, string> = { "Content-Type": audio.blob.type || "audio/webm" };
        if (context) headers["X-Transcribe-Context"] = encodeURIComponent(context);
        const res = await fetch(`/api/voice/transcribe?${q}`, { method: "POST", headers, body: audio.blob });
        if (!alive.current) return;
        if (res.status === 401) return window.location.reload(); // the session ran out: back to signing in
        if (!res.ok) {
          const code = ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "failed";
          if (code === "limit") setSpent(true);
          setPhase("idle");
          return setProblem({ message: tr(HEARING[code] ?? HEARING.failed), audio: code === "busy" || code === "failed" ? audio : undefined });
        }
        const { text } = (await res.json()) as { text: string };
        if (!alive.current) return;
        if (!text.trim()) {
          setPhase("idle");
          return setProblem({ message: tr("Nothing was heard. Try again a little closer to the microphone.") });
        }
        setSaid(text);
        void sort(text);
      } catch {
        if (!alive.current) return;
        setPhase("idle");
        setProblem({ message: tr("You’re offline. What you said is kept: try again when you’re back."), audio });
      }
    },
    [sort, sample],
  );

  const recorded = useCallback(
    (reason: RecordStop, audio: Recorded | null) => {
      recorder.current = null;
      hush();
      setSpeaking(false);
      if (audio) return void hear(audio);
      setPhase("idle");
      setProblem({
        message:
          reason === "denied"
            ? tr("The microphone is blocked for this site. Allow it in the address bar, or type instead.")
            : reason === "no-microphone"
              ? tr("No microphone was found. Connect one, or type instead.")
              : reason === "error"
                ? tr("Listening didn’t start. Try again, or type instead.")
                : tr("Nothing was heard. Try again a little closer to the microphone."),
      });
    },
    [hear, hush],
  );

  /** Starts listening. `keepSheet`: the sheet is on its way down by itself (it leaves when its slide is over). */
  const listen = useCallback((keepSheet = false) => {
    dictation.current?.cancel();
    hush();
    setProblem(null);
    if (!keepSheet) setReview(false);
    setConfirming(false);
    setSaid("");
    setSaying("");
    setPhase("listening");
    if (record) {
      const r = new Recorder({ onSpeaking: setSpeaking, onStop: recorded });
      recorder.current = r;
      meter.current = r.meter;
      setElapsed(0);
      void r.start();
      return;
    }
    const d = new Dictation(language, {
      onText: (a, b) => {
        setSaid(a);
        setSaying(b);
      },
      onSpeaking: setSpeaking,
      onStop: heard,
    });
    dictation.current = d;
    d.start();
    // Computers: the microphone's level moves the sphere (the same permission the recognition has just asked for).
    if (canMeter()) {
      const m = new Meter();
      meter.current = m;
      void m.start().then((ok) => {
        if (!ok && meter.current === m) meter.current = null;
      });
    }
  }, [heard, recorded, hush, language, record]);

  const stop = useCallback(() => (recorder.current ? recorder.current.stop() : dictation.current?.stop()), []);

  // The time spoken so far, while recording.
  useEffect(() => {
    if (phase !== "listening" || !record) return;
    const id = setInterval(() => setElapsed(recorder.current?.elapsed ?? 0), 250);
    return () => clearInterval(id);
  }, [phase, record]);

  const close = useCallback(() => {
    dictation.current?.cancel();
    dictation.current = null;
    hush();
    onClose();
  }, [onClose, hush]);

  /** Leaving the stage: with tasks waiting, they're shown first, so nothing said is lost to a slip of the hand. */
  const leave = useCallback(() => {
    if (!latest.current.drafts.length) return close();
    dictation.current?.cancel();
    dictation.current = null;
    hush();
    setSaying("");
    setSpeaking(false);
    if (latest.current.phase === "listening") setPhase("idle");
    setReview(true);
  }, [close, hush]);

  /** Closing the window: with tasks in it, only after a second, deliberate step. */
  const discard = useCallback(() => {
    const { drafts, confirming, phase } = latest.current;
    if (drafts.length && !confirming && phase !== "sorting") return setConfirming(true);
    close();
  }, [close]);

  const add = useCallback(() => {
    const { drafts, phase } = latest.current;
    const ready = drafts.map(({ title, description, date }) => ({ title: title.replace(/\s+/g, " ").trim(), description, date })).filter((d) => d.title);
    if (!ready.length || phase === "sorting") return;
    dictation.current?.cancel();
    dictation.current = null;
    hush();
    onAdd(ready);
    onClose();
  }, [onAdd, onClose, hush]);

  // Opens listening (the press that opened this screen is the gesture browsers ask for). Meanwhile it asks what's left of
  // today's tokens: with too little for even a short note, listening stops at once and says so, before anything is said.
  useEffect(() => {
    alive.current = true;
    dialog.current?.focus();
    if (hears) listen();
    fetch("/api/usage")
      .then((r) => (r.ok ? (r.json() as Promise<Usage>) : null))
      .then((u) => {
        if (!alive.current || !u || u.today.left >= ENOUGH) return;
        dictation.current?.cancel();
        dictation.current = null;
        recorder.current?.cancel();
        recorder.current = null;
        meter.current?.stop();
        meter.current = null;
        setSpeaking(false);
        setSaying("");
        setSpent(true);
        setPhase("idle");
        setProblem({ message: tr(LIMIT) });
      })
      .catch(() => {});
    return () => {
      alive.current = false;
      dictation.current?.cancel();
      dictation.current = null;
      recorder.current?.cancel();
      recorder.current = null;
      meter.current?.stop();
      meter.current = null;
    };
    // Once, on opening.
  }, []);

  // The page behind holds still.
  useEffect(() => {
    const root = document.documentElement;
    const s = root.style;
    const { overflow, scrollbarGutter } = s;
    const scrolls = root.scrollHeight > root.clientHeight;
    s.overflow = "hidden";
    if (scrolls) s.scrollbarGutter = "stable";
    return () => {
      s.overflow = overflow;
      s.scrollbarGutter = scrollbarGutter;
    };
  }, []);

  // The sphere: built for the size it is shown at, so the dots keep their size on any screen.
  const showRing = !typing;
  useLayoutEffect(() => {
    const el = canvas.current;
    if (!el || !showRing) return;
    const size = el.clientWidth || 280;
    const r = new ParticleRing(el, { count: Math.round((5200 * size) / 280), dotSize: 706 / size, reduced: reducedMotion(), color: getComputedStyle(el).color });
    // What the microphone hears, when there is a meter: the sphere moves to that.
    r.listen = () => {
      const m = meter.current;
      return m && m.read() ? m : null;
    };
    ring.current = r;
    r.start();
    const resized = new ResizeObserver(() => r.resize());
    resized.observe(el);
    const visible = () => (document.hidden ? r.stop() : r.start());
    document.addEventListener("visibilitychange", visible);
    return () => {
      document.removeEventListener("visibilitychange", visible);
      resized.disconnect();
      r.stop();
      ring.current = null;
    };
  }, [showRing]);
  const mode: RingMode = phase === "listening" ? "speech" : phase === "sorting" || phase === "hearing" ? "think" : "silent";
  useEffect(() => {
    const r = ring.current;
    if (!r) return;
    r.o.mode = mode;
    r.o.intensity = mode === "think" ? 0.8 : 1;
    r.gate = mode === "speech" ? (speaking ? 1 : 0) : null;
    r.o.color = getComputedStyle(r.canvas).color;
  }, [mode, speaking, showRing]);

  // Esc steps back (the day menu, the question, the window, the screen); Enter is the next step: done speaking, or add.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const l = latest.current;
      if (e.key === "Escape") {
        // An open menu or calendar takes its own Escape.
        if (document.querySelector('[role="menu"], [aria-label="Pick a date"]')) return;
        e.preventDefault();
        if (l.confirming) return setConfirming(false);
        return l.review ? discard() : leave();
      }
      if (e.key !== "Enter" || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target instanceof HTMLTextAreaElement) {
        // In the box for typing, Enter is a new line and ⌘/Ctrl Enter sorts; in a task's title it finishes the edit.
        if (target === field.current) {
          if (!(e.metaKey || e.ctrlKey)) return;
          e.preventDefault();
          return void sort(l.text);
        }
        e.preventDefault();
        return target.blur();
      }
      // A focused button answers Enter by itself.
      if (target instanceof HTMLButtonElement) return;
      e.preventDefault();
      if (l.review) add();
      else if (l.phase === "listening") stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [add, discard, leave, sort, stop]);

  const type = (on: boolean) => {
    dictation.current?.cancel();
    dictation.current = null;
    hush();
    setSpeaking(false);
    setSaying("");
    setSaid("");
    setProblem(null);
    setTyping(on);
    if (on) {
      setPhase("idle");
      requestAnimationFrame(() => field.current?.focus());
    } else listen();
  };

  /** From the sheet back to the stage, for more: listening again (at once, as the sheet slides down), or the box to type in. */
  const more = () => {
    if (typing) {
      setProblem(null);
      lower(() => field.current?.focus());
    } else {
      listen(true);
      lower();
    }
  };

  const today = parseYmd(todayKey);
  const dayLabel = (key: string) => relativeDay(key, todayKey) ?? formatMedium(parseYmd(key));
  const dayEntries = (draft: Draft): MenuEntry[] => {
    const days = Array.from({ length: 7 }, (_, i) => ymd(addDays(today, i)));
    const nextWeek = ymd(addDays(startOfWeek(today), 7));
    if (!days.includes(nextWeek)) days.push(nextWeek);
    if (!days.includes(draft.date)) days.push(draft.date);
    const pick = (date: string) => () => setDrafts((list) => list.map((d) => (d.key === draft.key ? { ...d, date } : d)));
    return [
      ...days.sort().map((date) => ({ label: date === nextWeek && !relativeDay(date, todayKey) ? `${formatMedium(parseYmd(date))} · ${tr("next week")}` : dayLabel(date), onSelect: pick(date), checked: date === draft.date })),
      { separator: true },
      {
        label: tr("Pick a date…"),
        onSelect: () => {
          if (!dayMenu) return;
          const d = parseYmd(draft.date);
          setCalendar({ key: draft.key, anchor: dayMenu.anchor, trigger: dayMenu.trigger, y: d.getFullYear(), m: d.getMonth() });
        },
      },
    ];
  };
  const calendarDraft = calendar && drafts.find((d) => d.key === calendar.key);

  /** The sheet goes back down (the tasks stay; a button on the stage brings it back). */
  const lower = (then?: () => void) => {
    setPull(0);
    setReview(false);
    then?.();
  };

  /** Holding the sheet's handle: it follows the finger down, and let go far (or fast) enough it goes down for good. */
  const hold = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button > 0) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const y0 = e.clientY;
    const t0 = performance.now();
    let dy = 0;
    const move = (ev: PointerEvent) => {
      const raw = ev.clientY - y0;
      dy = raw > 0 ? raw : raw / 4;
      setPull(dy);
    };
    const up = (ev: PointerEvent) => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      const fast = dy / Math.max(1, performance.now() - t0) > 0.6;
      if (ev.type === "pointerup" && (dy > 120 || (fast && dy > 30))) lower();
      else setPull(0);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
  const openDayMenu = dayMenu && drafts.find((d) => d.key === dayMenu.key);

  const n = drafts.filter((d) => d.title.trim()).length;
  const busy = phase === "sorting";
  const hearing = phase === "hearing";

  const caption =
    phase === "listening" ? (record ? `${tr("Listening")} · ${clock(elapsed)}` : tr("Listening")) : hearing ? tr("Writing it down…") : busy ? tr("Sorting into tasks…") : "";
  // What to say: a quiet line under the sphere, and an example under it, smaller still.
  const hint: [string, string] | null =
    phase === "listening"
      ? [tr("Say what you’re going to do, and when."), tr("“Call the bank tomorrow morning, book the dentist on Friday.”")]
      : typing || hearing || busy
        ? null
        : n
          ? [tr("Anything else? Speak again, or add what you have."), ""]
          : [tr("Press Speak again and say what you’re going to do."), ""];

  return createPortal(
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={tr("Speak your tasks")}
      tabIndex={-1}
      data-floating=""
      className="fixed inset-0 z-[90] flex animate-[fade_var(--duration-base)_var(--ease-out)_both] flex-col bg-surface outline-none"
    >
      <header className="flex h-[52px] flex-none items-center justify-between gap-2 px-3 md:h-14 md:px-4">
        <Button onClick={leave} className="gap-2 pl-2.5">
          <XIcon size={14} />
          {tr("Cancel")}
          <span className="pointer-coarse:hidden">
            <Kbd>{tr("Esc")}</Kbd>
          </span>
        </Button>
        {hears && (
          <Button variant="plain" onClick={() => type(!typing)} disabled={busy || hearing}>
            {typing ? tr("Speak instead") : tr("Type instead")}
          </Button>
        )}
      </header>

      {/* The stage: the sphere and the words, or a box to type into, in the middle of the room it has. When the sheet
          comes up the room gets smaller, and the sphere with it (it is sized by the stage's own height). */}
      <div className={`flex min-h-0 flex-1 flex-col overscroll-contain [container-type:size] ${typing ? "overflow-y-auto" : "overflow-hidden"}`}>
        <div className={`my-auto flex w-full flex-col items-center px-4 md:px-6 ${review && !typing ? "py-2" : "pt-2 pb-4 md:pb-6"}`}>
          {typing ? (
            <div className="w-full max-w-[600px] pt-4">
              <h1 className="font-display text-title-2 font-semibold tracking-[-0.02em]">{tr("Type your tasks")}</h1>
              <p className="mt-1 text-body text-ink-2">
                {hears ? tr("In any order, as it comes. Each thing to do becomes a task on its day.") : tr("This browser can’t listen, so type or paste. Each thing to do becomes a task on its day.")}
              </p>
              <AutoTextarea
                ref={field}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={TEXT_MAX}
                disabled={busy}
                autoFocus={!hears}
                aria-label={tr("What you need to do")}
                placeholder={tr("Tomorrow morning call the bank. On Friday book the dentist…")}
                className="mt-4 max-h-[36dvh] min-h-[112px] overflow-y-auto! rounded-lg bg-surface-2 p-3.5! text-[16px] leading-6 shadow-ring-line focus-visible:shadow-ring-line-2 md:text-callout"
              />
            </div>
          ) : (
            <>
              <canvas ref={canvas} aria-hidden="true" className={`flex-none text-ink ${review ? "size-[min(240px,84cqh)] md:size-[min(300px,84cqh)]" : "size-[min(240px,56cqh)] md:size-[min(300px,60cqh)]"}`} />
              <p className={`tabular mt-1 min-h-[18px] text-caption text-ink-3 ${review ? "hidden" : ""}`}>{caption}</p>
              <p
                ref={words}
                aria-live="off"
                className={`mt-2 line-clamp-4 min-h-[52px] w-full max-w-[560px] text-center text-headline font-medium text-balance transition-colors duration-(--duration-base) md:min-h-[60px] md:text-[20px] md:leading-[30px] md:tracking-[-0.014em] ${
                  busy ? "text-ink-3" : ""
                } ${review ? "hidden" : ""}`}
              >
                {problem && phase !== "listening" && !review ? (
                  <span className="text-callout font-normal text-ink-2 md:text-[17px] md:leading-6">{problem.message}</span>
                ) : said || saying ? (
                  <>
                    <span>{said}</span>
                    {saying && <span className="text-ink-3"> {saying}</span>}
                  </>
                ) : hint ? (
                  <span key={hint[0]} className="block animate-[fade_var(--duration-base)_var(--ease-out)_both] font-normal">
                    <span className="block text-callout text-ink-2 md:text-[16px] md:leading-6">{hint[0]}</span>
                    {hint[1] && <span className="mt-1.5 block text-footnote text-ink-3">{hint[1]}</span>}
                  </span>
                ) : null}
              </p>
            </>
          )}
        </div>
      </div>

      {/* The foot: the next step, in the middle, on the same white (the sheet brings its own). */}
      <div className={`flex-none items-center justify-center gap-2 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6 md:pt-3 md:pb-9 ${review ? "hidden" : "flex"}`}>
        {n > 0 && !review && (
          <Button size="lg" onClick={() => setReview(true)} className="max-sm:flex-1 md:h-10 md:rounded-[10px]">
            {trn(n, "Review {n} task", "Review {n} tasks")}
          </Button>
        )}
        {typing ? (
          <Button size="lg" variant="primary" disabled={busy || !text.trim()} onClick={() => sort(text)} className="max-sm:flex-1 md:h-10 md:min-w-[140px] md:rounded-[10px]">
            {tr("Sort into tasks")}
          </Button>
        ) : problem?.audio && phase === "idle" ? (
          <>
            <Button size="lg" onClick={() => listen()} className="gap-2 max-sm:flex-1 md:h-10 md:rounded-[10px]">
              <Orb size={20} />
              {tr("Speak again")}
            </Button>
            <Button size="lg" variant="primary" onClick={() => hear(problem.audio!)} className="max-sm:flex-1 md:h-10 md:min-w-[140px] md:rounded-[10px]">
              {tr("Try again")}
            </Button>
          </>
        ) : phase === "listening" ? (
          <Button size="lg" variant="primary" onClick={stop} aria-label={tr("Done speaking")} className="gap-2 max-sm:flex-1 md:h-10 md:min-w-[140px] md:rounded-[10px]">
            {tr("Done|speaking")}
            <span className="pointer-coarse:hidden">
              <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-on-primary/18 px-1.5 font-sans text-caption-2 font-medium">↵</kbd>
            </span>
          </Button>
        ) : (
          <Button size="lg" variant="primary" disabled={busy || hearing || spent} onClick={() => listen()} className="gap-2 max-sm:flex-1 md:h-10 md:min-w-[140px] md:rounded-[10px]">
            <Orb size={20} />
            {tr("Speak again")}
          </Button>
        )}
      </div>

      {/* The sheet: it comes up from under the screen and lifts the stage with it, never past half the screen (a long
          list scrolls inside). Its handle pulls it back down (the tasks stay, a button on the stage brings them back). */}
      <Rise open={review}>
          <section
            role="dialog"
            aria-label={tr("Tasks to add")}
            aria-busy={busy}
            className="mx-auto flex max-h-[50dvh] w-full max-w-[720px] flex-col overflow-hidden rounded-t-[24px] bg-elevated pb-[env(safe-area-inset-bottom)] shadow-[0_0_0_1px_var(--line),0_-16px_48px_-20px_rgba(0,0,0,0.22)]"
            style={pull ? { transform: `translateY(${pull}px)` } : { transition: "transform var(--duration-base) var(--ease-out)" }}
          >
            <div
              onPointerDown={hold}
              aria-hidden="true"
              className="flex h-6 flex-none cursor-grab touch-none items-end justify-center active:cursor-grabbing"
            >
              <span className="h-[5px] w-10 rounded-full bg-line-2" />
            </div>
            <header onPointerDown={(e) => !(e.target as HTMLElement).closest("button") && hold(e)} className="flex h-14 flex-none touch-none items-center gap-3 pr-3 pl-5">
              {busy && <span aria-hidden="true" className="size-4 flex-none animate-spin rounded-full border-[1.5px] border-line-2 border-t-ink" />}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-headline font-semibold">{busy ? tr("Sorting into tasks…") : n ? trn(n, "{n} task to add", "{n} tasks to add") : tr("Nothing to add yet")}</h2>
                {!busy && n > 0 && <p className="truncate text-caption text-ink-3">{tr("Edit a task, change its day, or leave it out.")}</p>}
              </div>
              <IconButton label={tr("Close")} onClick={discard} className="shadow-[inset_0_0_0_1px_var(--line-2)]">
                <XIcon size={14} />
              </IconButton>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-line">
              <ul aria-label={tr("Tasks to add")}>
                {drafts.map((d, i) => (
                  <li
                    key={d.key}
                    onAnimationEnd={() => d.fresh && setDrafts((list) => list.map((x) => (x.key === d.key ? { ...x, fresh: false } : x)))}
                    style={d.fresh ? { animationDelay: `${120 + i * 70}ms` } : undefined}
                    className={`flex min-h-[52px] items-center gap-2 border-b border-line pr-3 pl-5 ${d.fresh ? "summary-in" : ""}`}
                  >
                    <AutoTextarea
                      value={d.title}
                      onChange={(e) => setDrafts((list) => list.map((x) => (x.key === d.key ? { ...x, title: e.target.value.replace(/\n/g, " ") } : x)))}
                      maxLength={500}
                      aria-label={tr("Task")}
                      dir="auto"
                      className="-ml-2 min-w-0 flex-1 rounded-sm px-2! py-1.5! text-[16px] leading-[22px] text-ink transition-shadow duration-(--duration-fast) hover:shadow-ring-line focus-visible:bg-surface-2 focus-visible:shadow-ring-line-2 md:text-callout"
                    />
                    <Button
                      size="sm"
                      aria-haspopup="menu"
                      aria-label={tr("Day: {day}. Change", { day: dayLabel(d.date) })}
                      onClick={(e) => setDayMenu({ key: d.key, anchor: e.currentTarget.getBoundingClientRect(), trigger: e.currentTarget })}
                      className="flex-none gap-1 pr-2"
                    >
                      {dayLabel(d.date)}
                      <ChevronDown size={11} className="text-ink-3" />
                    </Button>
                    <IconButton size="sm" label={tr("Leave out “{title}”", { title: d.title })} tip={tr("Leave out")} onClick={() => setDrafts((list) => list.filter((x) => x.key !== d.key))} className="flex-none">
                      <XIcon size={13} />
                    </IconButton>
                  </li>
                ))}
                {/* While it sorts: lines where the tasks will be. */}
                {busy &&
                  [72, 54, 63].map((w, i) => (
                    <li key={`wait-${i}`} aria-hidden="true" className="flex h-[52px] items-center justify-between gap-6 border-b border-line pr-5 pl-5 last:border-0">
                      <span className="skeleton h-3 rounded-full" style={{ width: `${w}%`, animationDelay: `${i * 140}ms` }} />
                      <span className="skeleton h-3 w-14 flex-none rounded-full" style={{ animationDelay: `${i * 140 + 70}ms` }} />
                    </li>
                  ))}
              </ul>
              {problem && !busy && <p className="px-5 py-4 text-body text-ink-2">{problem.message}</p>}
            </div>

            <footer className="flex min-h-16 flex-none items-center gap-2 border-t border-line px-5 py-3">
              {confirming ? (
                <>
                  <span className="min-w-0 flex-1 text-body text-ink">{trn(n, "Leave without adding this task?", "Leave without adding these {n} tasks?")}</span>
                  <Button size="lg" autoFocus onClick={() => setConfirming(false)} className="md:h-10 md:rounded-[10px]">
                    {tr("Keep")}
                  </Button>
                  <Button size="lg" variant="danger-quiet" onClick={close} className="md:h-10 md:rounded-[10px]">
                    {tr("Leave")}
                  </Button>
                </>
              ) : (
                <>
                  {problem?.again && !busy ? (
                    <Button size="lg" onClick={() => sort(problem.again!)} className="max-sm:flex-1 md:h-10 md:rounded-[10px]">
                      {tr("Try again")}
                    </Button>
                  ) : (
                    <Button size="lg" disabled={busy || spent} onClick={more} className="gap-2 max-sm:flex-1 md:h-10 md:rounded-[10px]">
                      {!typing && <Orb size={20} />}
                      {typing ? tr("Type more") : n ? tr("Speak more") : tr("Speak again")}
                    </Button>
                  )}
                  <span className="flex-1 max-sm:hidden" />
                  <Button size="lg" variant="primary" disabled={!n || busy} onClick={add} className="gap-2 max-sm:flex-1 md:h-10 md:min-w-[140px] md:rounded-[10px]">
                    {n ? trn(n, "Add {n} task", "Add {n} tasks") : tr("Add tasks")}
                    {n > 0 && !busy && (
                      <span className="pointer-coarse:hidden">
                        <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-on-primary/18 px-1.5 font-sans text-caption-2 font-medium">↵</kbd>
                      </span>
                    )}
                  </Button>
                </>
              )}
            </footer>
          </section>
      </Rise>

      {/* For assistive tech: what state the screen is in, without reading every word as it is heard. */}
      <p role="status" className="sr-only">
        {busy ? tr("Sorting into tasks") : hearing ? tr("Writing down what you said") : phase === "listening" ? tr("Listening") : problem ? problem.message : n ? trn(n, "{n} task ready to add", "{n} tasks ready to add") : ""}
      </p>

      {openDayMenu && dayMenu && <Menu anchor={dayMenu.anchor} trigger={dayMenu.trigger} align="end" label={tr("Day")} entries={dayEntries(openDayMenu)} onClose={() => setDayMenu(null)} />}
      {calendar && calendarDraft && (
        // Any day at all: a month to pick from, opened from the day's menu.
        <Popover anchor={calendar.anchor} trigger={calendar.trigger} align="end" label={tr("Pick a date")} onClose={() => setCalendar(null)} className="w-[268px] p-2.5">
          <MiniMonth
            year={calendar.y}
            month={calendar.m}
            selected={calendarDraft.date}
            todayKey={todayKey}
            byDate={() => []}
            onShift={(k) => setCalendar((c) => (c ? { ...c, y: new Date(c.y, c.m + k, 1).getFullYear(), m: new Date(c.y, c.m + k, 1).getMonth() } : c))}
            onSelect={(date) => {
              setDrafts((list) => list.map((x) => (x.key === calendar.key ? { ...x, date } : x)));
              setCalendar(null);
            }}
          />
        </Popover>
      )}
    </div>,
    document.body,
  );
}

/**
 * Something that comes up from under the screen and takes its place in it, pushing what's above it up (and letting it
 * back down as it leaves). Its height opens from nothing to what it holds; it is in the page only while it's up or on
 * its way.
 */
function Rise({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [up, setUp] = useState(false);
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (!open) {
      setUp(false);
      // With reduced motion nothing slides, so nothing tells when it's gone: it goes at once.
      if (reducedMotion()) setMounted(false);
      return;
    }
    // Two frames: the closed state has to be on screen before it can open from it.
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => setUp(true));
    });
    return () => cancelAnimationFrame(id);
  }, [open]);
  if (!mounted) return null;
  return (
    <div
      className="grid flex-none px-0 transition-[grid-template-rows] duration-[520ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none md:px-4"
      style={{ gridTemplateRows: up ? "1fr" : "0fr" }}
      onTransitionEnd={(e) => e.target === e.currentTarget && !open && setMounted(false)}
    >
      <div className="min-h-0 overflow-hidden pt-4">{children}</div>
    </div>
  );
}
