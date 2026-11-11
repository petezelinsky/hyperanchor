"use client";

import { useEffect, useRef, useState } from "react";
import type { Task } from "@/lib/types";
import { CheckIcon, PlusIcon, TimerIcon } from "./icons";
import { Button, Checkbox, Kbd, ProgressRing } from "./ui";

/**
 * Focus mode: one task at a time, on the top card of a small stack — the edges peeking out below are what's left.
 * Done lifts the card away and the next one rises into place; Not now sends it to the back. The rest of the day is
 * one quiet line, so there is nothing else to choose between.
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

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-22rem)] w-full max-w-[600px] flex-col items-center justify-center pt-4 pb-6 md:min-h-[calc(100dvh-14rem)]">
      {task ? (
        <>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            <Progress done={done} total={total} />
            <span aria-hidden="true" className="text-ink-4">
              ·
            </span>
            <FocusTimer />
          </div>
          <div className="relative mt-6 w-full">
            {waiting > 1 && <span aria-hidden="true" className="absolute inset-x-[9%] -bottom-[18px] h-16 rounded-card bg-surface-2 shadow-lift" />}
            {waiting > 0 && <span aria-hidden="true" className="absolute inset-x-[4.5%] -bottom-[9px] h-16 rounded-card bg-surface shadow-lift" />}
            <Card key={task.id} task={task} hasNext={!!next} onDone={onDone} onLater={onLater} />
            {leaving && <Card key={`${leaving.task.id}-leaving`} task={leaving.task} hasNext={leaving.hasNext} leaving />}
          </div>
          <p className="mt-10 max-w-full truncate px-4 text-footnote text-ink-3">
            {next ? (
              <>
                Up next: <span className="text-ink-2">{next.title}</span>
                {after > 0 && ` · ${after} more after that`}
              </>
            ) : (
              "This is the last one."
            )}
          </p>
        </>
      ) : total > 0 ? (
        <AllDone isToday={isToday} onExit={onExit} />
      ) : (
        <p className="text-callout text-ink-2">Nothing is planned for this day.</p>
      )}

      <form
        className="group mt-8 flex h-10 w-full max-w-[420px] items-center gap-2 rounded-sm bg-surface-2 pointer-coarse:h-11 pr-2 pl-3.5 shadow-ring-line transition-shadow focus-within:bg-surface focus-within:shadow-ring-accent"
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem("thought") as HTMLInputElement;
          const title = input.value.trim();
          if (!title) return;
          onCapture(title);
          input.value = "";
        }}
      >
        <PlusIcon size={14} className="flex-none text-ink-3" />
        <input
          id="focus-capture"
          name="thought"
          placeholder="Something else on your mind? Jot it down"
          aria-label="Add a task for later"
          maxLength={500}
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent text-footnote outline-none"
          onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
        />
        <span className="group-focus-within:hidden pointer-coarse:hidden">
          <Kbd>N</Kbd>
        </span>
      </form>
    </div>
  );
}

/** Where you are in the day: one segment per task (a plain bar for long days), the current one half-lit. */
function Progress({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex items-center gap-3 text-footnote text-ink-3">
      {total <= 12 ? (
        <span aria-hidden="true" className="flex gap-1">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 w-5 rounded-full transition-colors duration-(--duration-data) ${i < done ? "bg-accent" : i === done ? "bg-accent/45" : "bg-accent-track"}`}
            />
          ))}
        </span>
      ) : (
        <span aria-hidden="true" className="block h-1.5 w-40 overflow-hidden rounded-full bg-accent-track">
          <span className="block h-full origin-left rounded-full bg-accent transition-transform duration-(--duration-data) ease-out" style={{ transform: `scaleX(${done / total})` }} />
        </span>
      )}
      <span className="tabular">
        Task {Math.min(done + 1, total)} of {total}
      </span>
    </div>
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
      <button
        type="button"
        onClick={() => setEnd(null)}
        aria-label={`Stop the timer, ${Math.ceil(secs / 60)} minutes left`}
        data-tip="Stop the timer"
        className="tap group relative flex h-7 items-center gap-1.5 rounded-full px-2 text-footnote font-medium text-accent-ink transition-colors duration-(--duration-fast) hover:bg-surface-3"
      >
        <ProgressRing value={1 - left / total} size={14} stroke={2.2} />
        <span className="tabular min-w-[34px] text-left">{clock}</span>
      </button>
    );
  }
  if (over)
    return (
      <span role="status" className="flex h-7 animate-pop-in items-center px-2 text-footnote font-medium text-accent-ink">
        {TIMER_MINUTES} minutes are up.
      </span>
    );
  return (
    <button
      type="button"
      onClick={start}
      aria-label={`Start a ${TIMER_MINUTES}-minute timer`}
      data-tip={`Start a ${TIMER_MINUTES}-minute timer`}
      className="tap relative flex h-7 items-center gap-1.5 rounded-full px-2 text-footnote text-ink-3 transition-colors duration-(--duration-fast) hover:bg-surface-3 hover:text-ink"
    >
      <TimerIcon size={13} />
      {TIMER_MINUTES} min
    </button>
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
    <article inert={leaving} aria-hidden={leaving || undefined} className={`rounded-card bg-surface p-5 text-left shadow-float sm:p-7 ${motion}`}>
      <div className="flex items-start gap-4">
        <Checkbox
          size={28}
          checked={task.done}
          onToggle={() => onDone?.(task)}
          label={task.done ? `Mark “${task.title}” as open` : `Mark “${task.title}” as done`}
          className="mt-[3px]"
        />
        <div className="min-w-0 flex-1">
          <h2
            className={`text-title-2 font-semibold break-words transition-colors duration-(--duration-base) sm:text-title ${task.done ? "text-ink-3" : ""}`}
          >
            {task.title}
          </h2>
          {task.description && <p className="mt-2 text-callout whitespace-pre-line text-ink-2">{task.description}</p>}
        </div>
      </div>
      <div className="mt-7 grid grid-cols-2 gap-2 sm:flex sm:pl-[44px]">
        <Button variant="primary" size="lg" onClick={() => onDone?.(task)} disabled={task.done} className={`gap-2 px-4 ${hasNext ? "" : "col-span-2"}`}>
          <CheckIcon size={12} strokeWidth={2.4} />
          Done
          <KeyHint tone="dark">Space</KeyHint>
        </Button>
        {hasNext && (
          <Button size="lg" onClick={() => onLater?.(task)} disabled={task.done} className="gap-2 px-4">
            Not now
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
        tone === "dark" ? "bg-on-primary/15 text-on-primary/75" : "bg-surface-3 text-ink-3"
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
  // The ring in the header has just filled and thrown its confetti; this only says where things stand.
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
