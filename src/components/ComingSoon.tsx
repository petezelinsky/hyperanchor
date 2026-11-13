"use client";

import { CheckIcon } from "./icons";
import { SoonTag } from "./Sidebar";
import { ProgressRing } from "./ui";

/**
 * Pages that aren't open yet: Goals and Agent. Each says in a few lines what it will be (the words are Bodymove's, the
 * agent this app grows into) and shows it with a quiet example that can't be touched.
 */
export function ComingSoon({ page }: { page: "goals" | "agent" }) {
  return (
    <div className="mx-auto w-full max-w-[600px] px-5 pt-12 pb-16 md:px-8 md:pt-[min(12vh,120px)]">
      <div className="animate-rise">
        <SoonTag />
        {page === "goals" ? <Goals /> : <Agent />}
      </div>
    </div>
  );
}

function Goals() {
  return (
    <>
      <h2 className="mt-4 font-display text-[28px] leading-[34px] font-semibold tracking-[-0.022em] text-ink">Goals, step by step.</h2>
      <p className="mt-3 max-w-[520px] text-callout text-ink-2">
        A goal is a card with steps. Tap a step and it becomes a task. A task done ticks the step, and once a week there is a check-in.
      </p>

      {/* An example goal, as the page will show it. */}
      <figure aria-label="Example: a week in Lisbon" className="mt-9 rounded-lg bg-surface shadow-[0_0_0_1px_var(--line-2),0_1px_2px_rgb(0_0_0/0.04)]">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="text-callout font-semibold text-ink">A week in Lisbon</div>
            <div className="mt-0.5 text-footnote text-ink-3">By May 18 · check-in on Sunday</div>
          </div>
          <span className="flex flex-none items-center gap-1.5 text-footnote text-ink-3">
            <ProgressRing value={0.5} size={14} stroke={1.75} />
            <span className="tabular">2 of 4</span>
          </span>
        </div>
        <ol className="px-5 py-2">
          <Step state="done" title="Flights booked" />
          <Step state="done" title="A room in Alfama" />
          <Step state="now" title="Days planned" note="3 of 5" />
          <Step state="todo" title="Packing list" />
        </ol>
      </figure>

      <p className="mt-8 text-footnote text-ink-3">Also good as a goal</p>
      <ul className="mt-2.5 flex flex-wrap gap-2">
        {["Spanish B1 by June 24", "Marathon on October 11", "Read 24 books this year"].map((g) => (
          <li key={g} className="flex h-8 items-center rounded-full px-3.5 text-footnote text-ink-2 shadow-[inset_0_0_0_1px_var(--line-2)]">
            {g}
          </li>
        ))}
      </ul>
    </>
  );
}

function Step({ state, title, note }: { state: "done" | "now" | "todo"; title: string; note?: string }) {
  return (
    <li className="flex h-11 items-center gap-3 border-b border-line last:border-b-0">
      {state === "done" ? (
        <span className="flex size-[18px] flex-none items-center justify-center rounded-[6px] bg-accent text-on-accent">
          <CheckIcon size={10} />
        </span>
      ) : state === "now" ? (
        <span className="flex size-[18px] flex-none items-center justify-center">
          <ProgressRing value={0.6} size={18} stroke={2} />
        </span>
      ) : (
        <span className="size-[18px] flex-none rounded-[6px] shadow-[inset_0_0_0_1.5px_var(--check-ring)]" />
      )}
      <span className={`min-w-0 flex-1 truncate text-body ${state === "done" ? "text-ink-3" : "text-ink"}`}>{title}</span>
      {note && <span className="tabular flex-none text-footnote text-ink-3">{note}</span>}
    </li>
  );
}

const AGENT = [
  { h: "You say it.", p: "Out loud or typed, the way it comes to mind." },
  { h: "It knows you.", p: "What you tell it once, it keeps." },
  { h: "It does the work.", p: "It searches, reads, compares and writes it up." },
  { h: "You decide once.", p: "One card, one tap. Then nothing needs you." },
];

function Agent() {
  return (
    <>
      <h2 className="mt-4 font-display text-[28px] leading-[34px] font-semibold tracking-[-0.022em] text-ink">Nothing needs you.</h2>
      <p className="mt-3 max-w-[520px] text-callout text-ink-2">An AI agent that leads your life and makes it better.</p>

      <ol className="mt-9 rounded-lg bg-surface shadow-[0_0_0_1px_var(--line-2),0_1px_2px_rgb(0_0_0/0.04)]">
        {AGENT.map((a, i) => (
          <li key={a.h} className="flex gap-4 border-b border-line px-5 py-4 last:border-b-0">
            <span className="tabular mt-px flex size-6 flex-none items-center justify-center rounded-full bg-surface-3 text-caption font-semibold text-ink-2">{i + 1}</span>
            <div className="min-w-0">
              <div className="text-callout font-semibold text-ink">{a.h}</div>
              <div className="mt-0.5 text-body text-ink-3">{a.p}</div>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
