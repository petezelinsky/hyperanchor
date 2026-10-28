"use client";

import { useEffect, useRef, useState } from "react";
import type { Task } from "@/lib/types";
import { CheckIcon, PlusIcon } from "./icons";
import { Burst, Button, Checkbox, Kbd } from "./ui";

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
  const leaving = useLeaving(task);
  const waiting = (next ? 1 : 0) + after;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-22rem)] w-full max-w-[600px] flex-col items-center justify-center pt-4 pb-6 md:min-h-[calc(100dvh-14rem)]">
      {task ? (
        <>
          <Progress done={done} total={total} />
          <div className="relative mt-6 w-full">
            {waiting > 1 && <span aria-hidden="true" className="absolute inset-x-[9%] -bottom-[18px] h-16 rounded-[20px] bg-surface-2 shadow-lift" />}
            {waiting > 0 && <span aria-hidden="true" className="absolute inset-x-[4.5%] -bottom-[9px] h-16 rounded-[22px] bg-surface shadow-lift" />}
            <Card key={task.id} task={task} hasNext={!!next} onDone={onDone} onLater={onLater} />
            {leaving && <Card key={`${leaving.id}-leaving`} task={leaving} hasNext={false} leaving />}
          </div>
          <p className="mt-10 max-w-full truncate px-4 text-[13px] text-ink-3">
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
        <p className="animate-rise text-[15px] text-ink-2">Nothing is planned for this day.</p>
      )}

      <form
        className="group mt-8 flex h-10 w-full max-w-[420px] items-center gap-2 rounded-[12px] bg-surface-2 pr-2 pl-3.5 shadow-[inset_0_0_0_1px_var(--line)] transition-shadow focus-within:bg-surface focus-within:shadow-[0_0_0_1px_var(--accent),0_0_0_4px_var(--accent-soft)]"
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
          className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none"
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
    <div className="flex items-center gap-3 text-[12.5px] text-ink-3">
      {total <= 12 ? (
        <span aria-hidden="true" className="flex gap-1">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 w-5 rounded-full transition-colors duration-500 ${i < done ? "bg-accent" : i === done ? "bg-accent/45" : "bg-accent-track"}`}
            />
          ))}
        </span>
      ) : (
        <span aria-hidden="true" className="block h-1.5 w-40 overflow-hidden rounded-full bg-accent-track">
          <span className="block h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${(done / total) * 100}%` }} />
        </span>
      )}
      <span className="tabular">
        Task {Math.min(done + 1, total)} of {total}
      </span>
    </div>
  );
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
      ? "pointer-events-none absolute inset-x-0 top-0 animate-[focus-done_0.4s_var(--ease-out)_both]"
      : "pointer-events-none absolute inset-x-0 top-0 animate-[focus-later_0.34s_ease-in_both]"
    : "relative animate-[focus-in_0.45s_0.08s_var(--ease-out)_both]";
  return (
    <article inert={leaving} aria-hidden={leaving || undefined} className={`rounded-[24px] bg-surface p-5 text-left shadow-float sm:p-7 ${motion}`}>
      <div className="flex items-start gap-4">
        <Checkbox
          size={28}
          checked={task.done}
          onToggle={() => onDone?.(task)}
          label={task.done ? `Mark “${task.title}” as not done` : `Mark “${task.title}” as done`}
          className="mt-[3px]"
        />
        <div className="min-w-0 flex-1">
          <h2
            className={`text-[22px] leading-[1.25] font-semibold tracking-[-0.025em] break-words transition-colors duration-300 sm:text-[28px] ${task.done ? "text-ink-3" : ""}`}
          >
            {task.title}
          </h2>
          {task.description && <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line text-ink-2">{task.description}</p>}
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
      className={`ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] px-1.5 font-sans text-[11px] font-medium pointer-coarse:hidden ${
        tone === "dark" ? "bg-on-primary/15 text-on-primary/75" : "bg-surface-3 text-ink-3"
      }`}
    >
      {children}
    </kbd>
  );
}

/** The task that just left the top of the stack, kept for a moment so it can animate away. */
function useLeaving(task?: Task) {
  const [leaving, setLeaving] = useState<Task | null>(null);
  const shown = useRef(task);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const was = shown.current;
    shown.current = task;
    if (!was || was.id === task?.id) return;
    setLeaving(was);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setLeaving(null), 450);
  }, [task]);
  return leaving;
}

function AllDone({ isToday, onExit }: { isToday: boolean; onExit: () => void }) {
  // Burst fires on a change, so switch it on just after mounting.
  const [cheer, setCheer] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setCheer(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="flex animate-rise flex-col items-center text-center">
      <Burst active={cheer}>
        <span className="flex size-16 items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_0_0_8px_var(--accent-soft)]">
          <CheckIcon size={24} strokeWidth={2.4} />
        </span>
      </Burst>
      <p className="mt-7 text-[22px] font-semibold tracking-[-0.02em]">{isToday ? "All done for today." : "Everything on this day is done."}</p>
      <p className="mt-1.5 text-[14.5px] text-ink-2">Nice work. Take a breath.</p>
      <Button onClick={onExit} className="mt-6">
        Back to the list
      </Button>
    </div>
  );
}
