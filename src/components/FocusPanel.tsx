"use client";

import { useEffect, useRef, useState } from "react";
import type { Task } from "@/lib/types";
import { CheckIcon, PlusIcon, TimerIcon, XIcon } from "./icons";
import { Button, Kbd, ProgressRing } from "./ui";

/**
 * Focus mode: the whole screen for one task. The card holds only the task and its two ways on, Done and Later; where it
 * stands in the day and the timer sit in the bar above. The cards behind it, the same size, peek out by the same strip,
 * one for each task still waiting. Done lifts the card away and the next one rises into place; Later sends it to the
 * back.
 */
export function FocusPanel({
  task,
  next,
  after,
  done,
  total,
  isToday,
  onDone,
  onLater,
  onExit,
  onCapture,
}: {
  /** The task in focus; undefined once nothing is left. */
  task?: Task;
  next?: Task;
  /** How many more come after `next`. */
  after: number;
  done: number;
  total: number;
  isToday: boolean;
  onDone: (t: Task) => void;
  onLater: (t: Task) => void;
  onExit: () => void;
  /** Adds a task for later without leaving focus. */
  onCapture: (title: string) => void;
}) {
  const leaving = useLeaving(task, !!next);
  const waiting = (next ? 1 : 0) + after;
  const root = useRef<HTMLDivElement>(null);

  // The page behind holds still, and focus moves into the stage.
  useEffect(() => {
    root.current?.focus();
    const s = document.documentElement.style;
    const { overflow } = s;
    s.overflow = "hidden";
    return () => {
      s.overflow = overflow;
    };
  }, []);

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label="Focus"
      tabIndex={-1}
      className="fixed inset-0 z-[80] flex animate-[fade_var(--duration-base)_var(--ease-out)_both] flex-col bg-canvas outline-none"
    >
      <header className="grid h-[52px] flex-none grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-3 md:h-14 md:px-4">
        <div className="flex">
          <Button onClick={onExit} data-tip="Leave focus (Esc)" className="gap-2 pl-2.5">
            <XIcon size={14} strokeWidth={1.8} />
            <span className="sm:hidden">Leave</span>
            <span className="max-sm:hidden">Leave focus</span>
            <span className="pointer-coarse:hidden">
              <Kbd>Esc</Kbd>
            </span>
          </Button>
        </div>
        <Where done={done} total={total} finished={!task} />
        <div className="flex justify-end">
          <FocusTimer />
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-3 pb-6 md:px-10">
        {task ? (
          <div className="relative w-full max-w-[600px]">
            {/* The cards behind: the same size as the first, each showing the same strip under the one before. */}
            {waiting > 1 && (
              <span
                aria-hidden="true"
                className="absolute inset-x-6 inset-y-0 translate-y-6 rounded-[20px] bg-[color-mix(in_srgb,var(--surface)_52%,var(--canvas))] shadow-[0_0_0_1px_color-mix(in_srgb,var(--ink)_7%,transparent)] md:inset-x-9"
              />
            )}
            {waiting > 0 && (
              <span
                aria-hidden="true"
                className="absolute inset-x-3 inset-y-0 translate-y-3 rounded-[20px] bg-[color-mix(in_srgb,var(--surface)_80%,var(--canvas))] shadow-[0_0_0_1px_color-mix(in_srgb,var(--ink)_7%,transparent)] md:inset-x-[18px]"
              />
            )}
            <Card key={task.id} task={task} hasNext={!!next} onDone={onDone} onLater={onLater} />
            {leaving && <Card key={`${leaving.task.id}-leaving`} task={leaving.task} hasNext={leaving.hasNext} leaving />}
          </div>
        ) : total > 0 ? (
          <AllDone isToday={isToday} onExit={onExit} />
        ) : (
          <p className="text-callout text-ink-2">Nothing is planned for this day.</p>
        )}
      </main>

      {/* A thought that comes up on the way: one quiet line at the foot (N), kept for later without leaving focus. */}
      <form
        className="mx-auto mb-[max(1rem,env(safe-area-inset-bottom))] flex h-10 w-[calc(100%-24px)] max-w-[420px] flex-none items-center gap-2 rounded-sm pr-2 pl-3 text-ink-3 transition-[background-color,box-shadow] duration-(--duration-fast) focus-within:bg-surface focus-within:text-ink focus-within:shadow-ring-line-2 hover:text-ink-2 md:mb-8"
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem("thought") as HTMLInputElement;
          const title = input.value.trim();
          if (!title) return;
          onCapture(title);
          input.value = "";
        }}
      >
        <PlusIcon size={14} className="flex-none" />
        <input
          id="focus-capture"
          name="thought"
          placeholder="Jot something down for later"
          aria-label="Add a task for later"
          maxLength={500}
          autoComplete="off"
          className="peer h-full min-w-0 flex-1 bg-transparent text-footnote text-ink outline-none placeholder:text-current"
          onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
        />
        <span className="peer-focus:hidden pointer-coarse:hidden">
          <Kbd>N</Kbd>
        </span>
      </form>
    </div>
  );
}

/** Where the day stands: a dot per task (a plain bar for long days), the one in hand outlined, and "3 of 7". */
function Where({ done, total, finished }: { done: number; total: number; finished: boolean }) {
  if (!total) return <span />;
  const at = Math.min(done + 1, total);
  return (
    <span
      role="img"
      aria-label={finished ? `All ${total} done` : `Task ${at} of ${total}`}
      className="flex items-center gap-2.5 text-footnote font-medium whitespace-nowrap text-ink-3"
    >
      {total <= 12 ? (
        <span aria-hidden="true" className="flex gap-[5px]">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`size-1.5 rounded-full transition-[background-color,box-shadow] duration-(--duration-data) ${
                i < done ? "bg-ink" : i === done ? "shadow-[inset_0_0_0_1.5px_var(--ink)]" : "bg-line-2"
              }`}
            />
          ))}
        </span>
      ) : (
        <span aria-hidden="true" className="block h-1 w-24 overflow-hidden rounded-full bg-line-2">
          <span className="block h-full origin-left rounded-full bg-ink transition-transform duration-(--duration-data) ease-out" style={{ transform: `scaleX(${done / total})` }} />
        </span>
      )}
      <span aria-hidden="true" className="tabular">
        {finished ? `${total} of ${total}` : `${at} of ${total}`}
      </span>
    </span>
  );
}

const TIMER_MINUTES = 25;

/**
 * An optional timer for a stretch of focus: one click starts 25 minutes, another stops it. When the time is up a soft
 * chime plays (and phones buzz), then it rests until you want another round.
 */
function FocusTimer() {
  const [end, setEnd] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [over, setOver] = useState(false);
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!end) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t < end) return;
      setEnd(null);
      setOver(true);
      chime(audio.current);
      navigator.vibrate?.([90, 70, 90]);
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [end]);
  useEffect(() => {
    if (!over) return;
    const id = setTimeout(() => setOver(false), 10_000);
    return () => clearTimeout(id);
  }, [over]);
  useEffect(() => () => void audio.current?.close().catch(() => {}), []);

  const total = TIMER_MINUTES * 60_000;
  const start = () => {
    // Made during the click, so the browser lets it play when the time is up.
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    } catch {}
    const t = Date.now();
    setNow(t);
    setOver(false);
    setEnd(t + total);
  };

  if (end) {
    const left = Math.max(0, end - now);
    const secs = Math.ceil(left / 1000);
    const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    return (
      <Button onClick={() => setEnd(null)} aria-label={`Stop the timer, ${Math.ceil(secs / 60)} minutes left`} data-tip="Stop the timer" className="gap-2 pl-2.5">
        <ProgressRing value={1 - left / total} size={14} stroke={2.2} />
        <span className="tabular min-w-[34px] text-left">{clock}</span>
      </Button>
    );
  }
  if (over)
    return (
      <span role="status" className="flex h-8 animate-pop-in items-center px-2 text-footnote font-medium text-ink">
        {TIMER_MINUTES} minutes are up.
      </span>
    );
  return (
    <Button onClick={start} aria-label={`Start a ${TIMER_MINUTES}-minute timer`} data-tip={`Start a ${TIMER_MINUTES}-minute timer`} className="gap-2 pl-2.5">
      <TimerIcon size={14} />
      <span className="tabular">{TIMER_MINUTES}:00</span>
    </Button>
  );
}

/** Two soft notes, a fifth apart. */
function chime(ctx: AudioContext | null) {
  if (!ctx) return;
  try {
    void ctx.resume();
    const t = ctx.currentTime + 0.05;
    [659.25, 987.77].forEach((freq, i) => {
      const at = t + i * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.16, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 1.5);
    });
  } catch {}
}

function Card({
  task,
  hasNext,
  onDone,
  onLater,
  leaving = false,
}: {
  task: Task;
  hasNext: boolean;
  onDone?: (t: Task) => void;
  onLater?: (t: Task) => void;
  /** The card that just left: finished ones lift away, deferred ones sink to the back. */
  leaving?: boolean;
}) {
  const motion = leaving
    ? task.done
      ? "pointer-events-none absolute inset-x-0 top-0 animate-[focus-done_var(--duration-base)_var(--ease-in)_both]"
      : "pointer-events-none absolute inset-x-0 top-0 animate-[focus-later_var(--duration-base)_var(--ease-in)_both]"
    : "relative animate-[focus-in_var(--duration-move)_80ms_var(--ease-spring)_both]";
  return (
    <article
      inert={leaving}
      aria-hidden={leaving || undefined}
      className={`z-[2] flex min-h-[300px] flex-col rounded-[20px] bg-surface px-5 pt-7 pb-5 text-left shadow-float md:px-10 md:pt-10 md:pb-8 ${motion}`}
    >
      <h2
        className={`text-[28px] leading-[34px] font-semibold tracking-[-0.026em] text-balance break-words transition-colors duration-(--duration-base) md:text-[34px] md:leading-10 md:tracking-[-0.028em] ${task.done ? "text-ink-3" : ""}`}
      >
        {task.title}
      </h2>
      {task.description && <p className="mt-2.5 text-[16px] leading-[22px] whitespace-pre-line text-ink-2 md:mt-3 md:text-headline">{task.description}</p>}
      <span className="min-h-8 flex-1" />
      <div className="flex gap-2">
        <Button variant="primary" size="lg" onClick={() => onDone?.(task)} disabled={task.done} className="gap-2 px-4 max-sm:flex-1 md:h-10 md:rounded-[10px]">
          <CheckIcon size={12} strokeWidth={2.4} />
          Done
          <KeyHint tone="dark">Space</KeyHint>
        </Button>
        {hasNext && (
          <Button size="lg" onClick={() => onLater?.(task)} disabled={task.done} className="gap-2 px-4 max-sm:flex-1 md:h-10 md:rounded-[10px]">
            Later
            <KeyHint>→</KeyHint>
          </Button>
        )}
      </div>
    </article>
  );
}

/** A small key inside a button, on computers only. */
function KeyHint({ children, tone = "light" }: { children: React.ReactNode; tone?: "light" | "dark" }) {
  return (
    <kbd
      className={`ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-xs px-1.5 font-sans text-caption-2 font-medium pointer-coarse:hidden ${
        tone === "dark" ? "bg-on-primary/15 text-on-primary/75" : "bg-surface-2 text-ink-3 shadow-ring-line"
      }`}
    >
      {children}
    </kbd>
  );
}

/** The card that just left the top of the stack, kept for a moment (as it last looked) so it can animate away. */
function useLeaving(task: Task | undefined, hasNext: boolean) {
  const [leaving, setLeaving] = useState<{ task: Task; hasNext: boolean } | null>(null);
  const shown = useRef({ task, hasNext });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const was = shown.current;
    shown.current = { task, hasNext };
    if (!was.task || was.task.id === task?.id) return;
    setLeaving({ task: was.task, hasNext: was.hasNext });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setLeaving(null), 450);
  }, [task, hasNext]);
  return leaving;
}

function AllDone({ isToday, onExit }: { isToday: boolean; onExit: () => void }) {
  // The dots above have all filled; this only says where things stand.
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-title-2 font-semibold">{isToday ? "That was the last one." : "Everything on this day is done."}</p>
      <p className="mt-1 text-body text-ink-2">{isToday ? "Today’s list is finished." : "Nothing is left open here."}</p>
      <Button onClick={onExit} className="mt-6">
        Back to the list
      </Button>
    </div>
  );
}
