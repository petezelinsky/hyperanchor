"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addDays, formatMedium, parseYmd, relativeDay, startOfWeek, ymd, type WeekStart } from "@/lib/dates";
import type { TaskDraft } from "@/lib/types";
import { DRAFT_TEXT_MAX as TEXT_MAX } from "@/lib/validate";
import { AutoTextarea } from "../AutoTextarea";
import { ChevronDown, StopIcon, XIcon } from "../icons";
import { reducedMotion } from "../motion";
import { Button, IconButton, Kbd, Menu, type MenuEntry } from "../ui";
import { canListen, Dictation, readSpokenLanguage, saveSpokenLanguage, spokenLanguages, type StopReason } from "./dictation";
import { Orb } from "./Orb";
import { ParticleRing, type RingMode } from "./ParticleRing";

type Draft = TaskDraft & { key: number };
type Phase = "listening" | "sorting" | "ready";
/** Something went wrong, in words; `again` is the text to send once more when trying again makes sense. */
type Problem = { message: string; again?: string } | null;

const PROBLEMS: Record<string, string> = {
  limit: "That’s today’s limit for sorting. It starts over tomorrow.",
  not_configured: "Sorting into tasks isn’t set up on this server yet.",
  refused: "That couldn’t be sorted into tasks. Try saying it another way.",
  busy: "The sorter is busy right now.",
  failed: "That couldn’t be sorted into tasks.",
};

/**
 * Speak your tasks: the whole screen, plain. The sphere listens in the middle, the words appear under it, and when the
 * person stops, what they said comes back as tasks on their days — to look over, fix a day, drop one, and add. Typing
 * (or pasting) works the same way, and takes over where the browser can't listen. The buttons sit at the foot, on the
 * same white, with no bar behind them.
 */
export function VoiceScreen({
  todayKey,
  weekStart,
  onAdd,
  onClose,
}: {
  todayKey: string;
  weekStart: WeekStart;
  onAdd: (drafts: TaskDraft[]) => void;
  onClose: () => void;
}) {
  const hears = useMemo(canListen, []);
  const languages = useMemo(spokenLanguages, []);
  const [language, setLanguage] = useState(readSpokenLanguage);
  const [typing, setTyping] = useState(!hears);
  const [phase, setPhase] = useState<Phase>(hears ? "listening" : "ready");
  const [said, setSaid] = useState("");
  const [saying, setSaying] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [problem, setProblem] = useState<Problem>(null);
  const [dayMenu, setDayMenu] = useState<{ key: number; anchor: DOMRect; trigger: HTMLElement } | null>(null);
  const [languageMenu, setLanguageMenu] = useState<{ anchor: DOMRect; trigger: HTMLElement } | null>(null);

  const dialog = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const ring = useRef<ParticleRing | null>(null);
  const dictation = useRef<Dictation | null>(null);
  const alive = useRef(true);
  const nextKey = useRef(1);
  // Latest values for handlers that outlive a render (recognition callbacks, key listeners).
  const latest = useRef({ language, todayKey, weekStart, drafts, phase, typing, text, problem });
  latest.current = { language, todayKey, weekStart, drafts, phase, typing, text, problem };

  /** Sends `words` to be sorted; the tasks that come back join the ones already here. */
  const sort = useCallback(async (words: string) => {
    const clean = words.trim();
    if (!clean) return;
    if (clean.length > TEXT_MAX) {
      setPhase("ready");
      return setProblem({ message: "That’s too much for one go. Sort it in two or three parts." });
    }
    setPhase("sorting");
    setProblem(null);
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
        setProblem({ message: PROBLEMS[code] ?? PROBLEMS.failed, again: code === "busy" || code === "failed" ? clean : undefined });
      } else {
        const { tasks } = (await res.json()) as { tasks: TaskDraft[] };
        if (!alive.current) return;
        setSaid("");
        setText("");
        if (tasks.length) setDrafts((list) => [...list, ...tasks.map((t) => ({ ...t, key: nextKey.current++ }))]);
        else setProblem({ message: "No tasks in that. Say what you need to do, and when." });
      }
    } catch {
      if (!alive.current) return;
      setProblem({ message: "You’re offline. What you said is kept: try again when you’re back.", again: clean });
    }
    if (alive.current) setPhase("ready");
  }, []);

  const heard = useCallback(
    (reason: StopReason, words: string) => {
      dictation.current = null;
      setSaying("");
      setSpeaking(false);
      // Whatever ended the listening, words that were heard are sorted: nothing said is lost to a late hiccup.
      if (words.trim()) {
        setSaid(words);
        return void sort(words);
      }
      setPhase("ready");
      setProblem({
        message:
          reason === "denied"
            ? "The microphone is blocked for this site. Allow it in the address bar, or type instead."
            : reason === "no-microphone"
              ? "No microphone was found. Connect one, or type instead."
              : reason === "network"
                ? "Listening needs a connection. Try again, or type instead."
                : reason === "error"
                  ? "Listening didn’t start. Try again, or type instead."
                  : "Nothing was heard. Try again a little closer to the microphone.",
      });
    },
    [sort],
  );

  const listen = useCallback(() => {
    dictation.current?.cancel();
    setProblem(null);
    setSaid("");
    setSaying("");
    setPhase("listening");
    const d = new Dictation(latest.current.language, {
      onText: (a, b) => {
        setSaid(a);
        setSaying(b);
      },
      onSpeaking: setSpeaking,
      onStop: heard,
    });
    dictation.current = d;
    d.start();
  }, [heard]);

  const stop = useCallback(() => dictation.current?.stop(), []);

  const close = useCallback(() => {
    dictation.current?.cancel();
    dictation.current = null;
    onClose();
  }, [onClose]);

  const add = useCallback(() => {
    const { drafts, phase } = latest.current;
    if (!drafts.length || phase === "sorting") return;
    dictation.current?.cancel();
    dictation.current = null;
    onAdd(drafts.map(({ title, description, date }) => ({ title, description, date })));
    onClose();
  }, [onAdd, onClose]);

  // Opens listening (the press that opened this screen is the gesture browsers ask for).
  useEffect(() => {
    alive.current = true;
    dialog.current?.focus();
    if (hears) listen();
    return () => {
      alive.current = false;
      dictation.current?.cancel();
      dictation.current = null;
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
  const mode: RingMode = phase === "listening" ? "speech" : phase === "sorting" ? "steady" : "silent";
  useEffect(() => {
    const r = ring.current;
    if (!r) return;
    r.o.mode = mode;
    r.o.intensity = mode === "steady" ? 0.55 : 1;
    r.gate = mode === "speech" ? (speaking ? 1 : 0) : null;
    r.o.color = getComputedStyle(r.canvas).color;
  }, [mode, speaking, showRing]);

  // Esc leaves; Enter adds what's ready (in the text field Enter is a new line, ⌘/Ctrl Enter sorts).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        return close();
      }
      if (e.key !== "Enter" || e.shiftKey || e.altKey) return;
      const inField = e.target instanceof HTMLTextAreaElement;
      if (inField) {
        if (!(e.metaKey || e.ctrlKey)) return;
        e.preventDefault();
        return void sort(latest.current.text);
      }
      // A focused button answers Enter by itself.
      if (e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      add();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [add, close, sort]);

  const type = (on: boolean) => {
    dictation.current?.cancel();
    dictation.current = null;
    setSpeaking(false);
    setSaying("");
    setSaid("");
    setProblem(null);
    setTyping(on);
    if (on) {
      setPhase("ready");
      requestAnimationFrame(() => field.current?.focus());
    } else listen();
  };

  const chooseLanguage = (tag: string) => {
    saveSpokenLanguage(tag);
    setLanguage(tag);
    latest.current.language = tag;
    if (latest.current.phase === "listening") listen();
  };

  const today = parseYmd(todayKey);
  const dayLabel = (key: string) => relativeDay(key, todayKey) ?? formatMedium(parseYmd(key));
  const dayEntries = (draft: Draft): MenuEntry[] => {
    const days = Array.from({ length: 7 }, (_, i) => ymd(addDays(today, i)));
    const nextWeek = ymd(addDays(startOfWeek(today), 7));
    if (!days.includes(nextWeek)) days.push(nextWeek);
    if (!days.includes(draft.date)) days.push(draft.date);
    const pick = (date: string) => () => setDrafts((list) => list.map((d) => (d.key === draft.key ? { ...d, date } : d)));
    return days.sort().map((date) => ({ label: date === nextWeek && !relativeDay(date, todayKey) ? `${formatMedium(parseYmd(date))} · next week` : dayLabel(date), onSelect: pick(date), checked: date === draft.date }));
  };
  const openDayMenu = dayMenu && drafts.find((d) => d.key === dayMenu.key);

  const n = drafts.length;
  const busy = phase === "sorting";
  const caption = phase === "listening" ? "Listening" : busy ? "Sorting into tasks…" : "";
  const hint =
    phase === "listening"
      ? "Say what you need to do, and when."
      : n
        ? typing
          ? "Anything else? Type more, or add what you have."
          : "Anything else? Speak again, or add what you have."
        : typing
          ? ""
          : "Press Speak again and say what you need to do.";
  const languageName = languages.find((l) => l.tag === language)?.name ?? "";

  const languageButton = !typing && (
    <Button
      variant="plain"
      aria-haspopup="menu"
      aria-label={`Spoken language: ${languageName}`}
      onClick={(e) => setLanguageMenu({ anchor: e.currentTarget.getBoundingClientRect(), trigger: e.currentTarget })}
      className="gap-1 pr-1.5"
    >
      {languageName}
      <ChevronDown size={12} strokeWidth={2} className="text-ink-3" />
    </Button>
  );
  const typeButton = hears && (
    <Button variant="plain" onClick={() => type(!typing)}>
      {typing ? "Speak instead" : "Type instead"}
    </Button>
  );

  return createPortal(
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="Speak your tasks"
      tabIndex={-1}
      data-floating=""
      className="fixed inset-0 z-[90] flex animate-[fade_var(--duration-base)_var(--ease-out)_both] flex-col bg-surface outline-none"
    >
      <header className="flex h-[52px] flex-none items-center justify-between gap-2 px-3 md:h-14 md:px-4">
        <Button onClick={close} className="gap-2 pl-2.5">
          <XIcon size={14} strokeWidth={1.8} />
          Cancel
          <span className="pointer-coarse:hidden">
            <Kbd>Esc</Kbd>
          </span>
        </Button>
        <div className="flex items-center gap-1 max-sm:hidden">
          {languageButton}
          {typeButton}
        </div>
      </header>

      {/* The middle: centered while it fits, scrolling from the top once the list grows long. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <div className="my-auto flex w-full flex-col items-center px-4 pt-2 pb-4 md:px-6 md:pb-6">
          {typing ? (
            <div className="w-full max-w-[600px] pt-4">
              <h1 className="font-display text-title-2 font-semibold tracking-[-0.02em]">Type your tasks</h1>
              <p className="mt-1 text-body text-ink-2">
                {hears ? "In any order, as it comes. Each thing to do becomes a task on its day." : "This browser can’t listen, so type or paste. Each thing to do becomes a task on its day."}
              </p>
              <AutoTextarea
                ref={field}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={TEXT_MAX}
                disabled={busy}
                autoFocus={!hears}
                aria-label="What you need to do"
                placeholder="Tomorrow morning call the bank. On Friday book the dentist…"
                className="mt-4 max-h-[36dvh] min-h-[112px] overflow-y-auto! rounded-lg bg-surface-2 p-3.5! text-[16px] leading-6 shadow-ring-line focus-visible:shadow-ring-line-2 md:text-callout"
              />
              {(problem || hint) && <p className="mt-3 text-footnote text-ink-2">{problem ? problem.message : hint}</p>}
            </div>
          ) : (
            <>
              <canvas ref={canvas} aria-hidden="true" className="size-[240px] flex-none text-ink md:size-[300px]" />
              <p className="-mt-1.5 min-h-[18px] text-caption text-ink-3">{caption}</p>
              <p
                aria-live="off"
                className="mt-2.5 line-clamp-4 min-h-[52px] w-full max-w-[560px] text-center text-headline font-medium text-balance md:min-h-[60px] md:text-[20px] md:leading-[30px] md:tracking-[-0.014em]"
              >
                {problem && phase !== "listening" ? (
                  <span className="font-normal text-ink-2">{problem.message}</span>
                ) : said || saying ? (
                  <>
                    <span className={busy ? "text-ink-2" : ""}>{said}</span>
                    {saying && <span className="text-ink-3"> {saying}</span>}
                  </>
                ) : (
                  <span className="font-normal text-ink-3">{hint}</span>
                )}
              </p>
            </>
          )}

          {/* What came back: tasks on their days. */}
          {drafts.length > 0 && (
            <ul aria-label="Tasks to add" className="mt-4 w-full max-w-[600px] border-t border-line md:mt-6">
              {drafts.map((d) => (
                <li key={d.key} className="flex animate-rise items-center gap-3 pl-1">
                  <span aria-hidden="true" className="size-[18px] flex-none rounded-[6px] border-[1.5px] border-check-ring" />
                  {/* One line under the whole row, from where the text starts to the edge. */}
                  <div className="flex min-h-12 min-w-0 flex-1 items-center gap-2 border-b border-line">
                    <span className="flex min-w-0 flex-1 items-baseline gap-2.5">
                      <span className="min-w-0 py-2 text-[16px] leading-[22px] text-ink max-sm:line-clamp-2 sm:truncate sm:py-0 md:text-callout">{d.title}</span>
                      {d.description && <span className="min-w-0 flex-1 truncate text-body text-ink-3 max-sm:hidden">{d.description}</span>}
                    </span>
                    <Button
                      size="sm"
                      aria-haspopup="menu"
                      aria-label={`Day: ${dayLabel(d.date)}. Change`}
                      onClick={(e) => setDayMenu({ key: d.key, anchor: e.currentTarget.getBoundingClientRect(), trigger: e.currentTarget })}
                      className="gap-1 pr-2"
                    >
                      {dayLabel(d.date)}
                      <ChevronDown size={11} strokeWidth={2} className="text-ink-3" />
                    </Button>
                    <IconButton size="sm" label={`Leave out “${d.title}”`} tip="Leave out" onClick={() => setDrafts((list) => list.filter((x) => x.key !== d.key))}>
                      <XIcon size={13} />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* The foot: the two next steps, side by side in the middle, on the same white. */}
      <div className="flex flex-none items-center justify-center gap-2 px-4 pt-2 pb-3 md:px-6 md:pt-3 md:pb-9">
        {problem?.again ? (
          <Button size="lg" disabled={busy} onClick={() => sort(problem.again!)} className="max-sm:flex-1 md:h-10 md:min-w-[120px] md:rounded-[10px]">
            Try again
          </Button>
        ) : typing ? (
          <Button size="lg" disabled={busy || !text.trim()} onClick={() => sort(text)} className="max-sm:flex-1 md:h-10 md:rounded-[10px]">
            {busy ? "Sorting…" : "Sort into tasks"}
          </Button>
        ) : phase === "listening" ? (
          <Button size="lg" onClick={stop} aria-label="Stop listening" className="max-sm:flex-1 md:h-10 md:min-w-[120px] md:rounded-[10px]">
            <StopIcon size={14} />
            Stop
          </Button>
        ) : (
          <Button size="lg" disabled={busy} onClick={listen} className="gap-2 max-sm:flex-1 md:h-10 md:rounded-[10px]">
            <Orb size={20} />
            Speak again
          </Button>
        )}
        <Button size="lg" variant="primary" disabled={!n || busy} onClick={add} className="gap-2 max-sm:flex-1 md:h-10 md:min-w-[140px] md:rounded-[10px]">
          {n ? `Add ${n} ${n === 1 ? "task" : "tasks"}` : "Add tasks"}
          {n > 0 && !busy && (
            <span className="pointer-coarse:hidden">
              <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-on-primary/18 px-1.5 font-sans text-caption-2 font-medium">↵</kbd>
            </span>
          )}
        </Button>
      </div>
      {/* Phones: the language and typing, quietly under the buttons. */}
      {(languageButton || typeButton) && (
        <div className="flex flex-none justify-center gap-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
          {languageButton}
          {typeButton}
        </div>
      )}

      {/* For assistive tech: what state the screen is in, without reading every word as it is heard. */}
      <p role="status" className="sr-only">
        {busy ? "Sorting into tasks" : phase === "listening" ? "Listening" : problem ? problem.message : n ? `${n} ${n === 1 ? "task" : "tasks"} ready to add` : ""}
      </p>

      {openDayMenu && dayMenu && <Menu anchor={dayMenu.anchor} trigger={dayMenu.trigger} align="end" label="Day" entries={dayEntries(openDayMenu)} onClose={() => setDayMenu(null)} />}
      {languageMenu && (
        <Menu
          anchor={languageMenu.anchor}
          trigger={languageMenu.trigger}
          align="end"
          label="Spoken language"
          entries={languages.flatMap((l, i): MenuEntry[] => [
            // The browser's own languages first, then the rest.
            ...(i > 0 && !l.own && languages[i - 1].own ? [{ separator: true } as const] : []),
            { label: l.name, onSelect: () => chooseLanguage(l.tag), checked: l.tag === language },
          ])}
          onClose={() => setLanguageMenu(null)}
        />
      )}
    </div>,
    document.body,
  );
}
