"use client";

import { useEffect, useState } from "react";
import type { Task } from "@/lib/types";
import { CheckIcon, PlusIcon } from "./icons";
import { Burst, Button, Checkbox, Kbd } from "./ui";

/**
 * Focus mode: one task at a time, large, with a single obvious next step. The rest of the day is
 * reduced to one quiet line ("Up next"), so there is nothing else to choose between.
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
  return (
    <div className="mx-auto flex max-w-[600px] flex-col items-center px-1 pt-6 pb-16 text-center md:pt-12">
      <p className="text-[12px] font-medium tracking-[0.06em] text-ink-3 uppercase">One thing at a time</p>

      {task ? (
        <>
          <div key={task.id} className="mt-5 w-full animate-rise rounded-[20px] bg-surface p-5 text-left shadow-float md:p-7">
            <div className="flex items-start gap-4">
              <Checkbox
                size={26}
                checked={task.done}
                onToggle={() => onDone(task)}
                label={task.done ? `Mark “${task.title}” as not done` : `Mark “${task.title}” as done`}
                className="mt-[3px]"
              />
              <div className="min-w-0 flex-1">
                <h2
                  className={`text-[21px] leading-[1.3] font-semibold tracking-[-0.02em] break-words transition-colors duration-300 md:text-[24px] ${task.done ? "text-ink-3" : ""}`}
                >
                  {task.title}
                </h2>
                {task.description && <p className="mt-2 text-[14.5px] leading-relaxed whitespace-pre-line text-ink-2">{task.description}</p>}
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 pl-[42px]">
              <Button variant="primary" size="lg" onClick={() => onDone(task)} disabled={task.done} className="pl-4">
                <CheckIcon size={12} strokeWidth={2.4} />
                Done
              </Button>
              {next && (
                <Button size="lg" onClick={() => onLater(task)} disabled={task.done}>
                  Not now
                </Button>
              )}
            </div>
          </div>
          <p className="mt-5 max-w-full truncate px-4 text-[13px] text-ink-3">
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
      ) : (
        total > 0 ? (
          <AllDone isToday={isToday} />
        ) : (
          <p className="mt-8 animate-rise text-[15px] text-ink-2">Nothing is planned for this day.</p>
        )
      )}

      {total > 0 && (
        <div className="mt-8 flex w-full max-w-[260px] items-center gap-3 text-[12px] text-ink-3">
          <span aria-hidden="true" className="block h-1.5 flex-1 overflow-hidden rounded-full bg-accent-track">
            <span className="block h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${(done / total) * 100}%` }} />
          </span>
          <span className="tabular whitespace-nowrap">
            {done} of {total} done
          </span>
        </div>
      )}

      <form
        className="mt-8 flex h-10 w-full max-w-[420px] items-center gap-2 rounded-[12px] bg-surface-2 px-3.5 shadow-[inset_0_0_0_1px_var(--line)] transition-shadow focus-within:bg-surface focus-within:shadow-[0_0_0_1px_var(--accent),0_0_0_4px_var(--accent-soft)]"
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
      </form>

      <Button variant="plain" onClick={onExit} className="mt-4 gap-2">
        Exit focus
        <span className="pointer-coarse:hidden">
          <Kbd>Esc</Kbd>
        </span>
      </Button>
    </div>
  );
}

function AllDone({ isToday }: { isToday: boolean }) {
  // Burst fires on a change, so switch it on just after mounting.
  const [cheer, setCheer] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setCheer(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="mt-8 flex animate-rise flex-col items-center">
      <Burst active={cheer}>
        <span className="flex size-14 items-center justify-center rounded-full bg-accent text-on-accent">
          <CheckIcon size={22} strokeWidth={2.4} />
        </span>
      </Burst>
      <p className="mt-5 text-[20px] font-semibold tracking-[-0.015em]">{isToday ? "All done for today." : "Everything on this day is done."}</p>
      <p className="mt-1.5 text-[14px] text-ink-2">Nice work. Take a breath.</p>
    </div>
  );
}
