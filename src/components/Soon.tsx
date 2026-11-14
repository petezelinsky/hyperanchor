"use client";

import { Orb } from "./voice/Orb";

/** The parts of the app that aren't open yet. They have no pages: the sidebar shows them, quiet, and says what's coming. */
export type Soon = "timeline" | "goals" | "agent";

export const SOON: Record<Soon, { title: string; line: string }> = {
  timeline: { title: "Timeline", line: "All of the plan. None of the planning." },
  goals: { title: "Goals", line: "A goal is a card with steps. Each step becomes a task." },
  agent: { title: "Agent", line: "An AI agent that leads your life and makes it better." },
};

/** "Soon": something that isn't open yet. */
export const SoonTag = () => (
  <span className="inline-flex h-[18px] flex-none items-center rounded-[5px] px-1.5 text-caption-2 font-medium text-ink-3 shadow-[inset_0_0_0_1px_var(--line-2)]">Soon</span>
);

/**
 * What's coming, in a few words: one small drawing of the idea, its name and one line (Bodymove's words). Shown when the
 * pointer rests on a Soon page in the sidebar, or when it's tapped in the account panel on phones.
 */
export function SoonCard({ soon, className = "" }: { soon: Soon; className?: string }) {
  const s = SOON[soon];
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <div aria-hidden="true" className="flex h-10 items-center">
        {soon === "timeline" ? <LineOfTime /> : soon === "goals" ? <Steps /> : <Orb size={36} className="text-ink" />}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-footnote font-semibold text-ink">
        {s.title}
        <SoonTag />
      </div>
      <p className="mt-1 max-w-[220px] text-caption text-balance text-ink-3">{s.line}</p>
    </div>
  );
}

/** The line of time (Bodymove's timeline): days ticking by, a few things on it, and today held where it is. */
function LineOfTime() {
  const ticks = Array.from({ length: 21 }, (_, i) => 10 + i * 9);
  return (
    <svg width="176" height="39" viewBox="0 0 200 44" fill="none" strokeLinecap="round">
      <g className="text-ink-4" stroke="currentColor" strokeWidth="1">
        <path d="M4 26h192" />
        {ticks.map((x, i) => (
          <path key={x} d={`M${x} ${i % 5 ? 23 : 21.5}V26`} />
        ))}
      </g>
      <g className="text-ink-3" fill="currentColor">
        <circle cx="46" cy="26" r="2.25" />
        <circle cx="154" cy="26" r="2.25" />
      </g>
      <g className="text-ink" fill="currentColor" stroke="currentColor" strokeWidth="1">
        <path d="M100 10v12" fill="none" />
        <circle cx="100" cy="26" r="3.25" stroke="none" />
      </g>
    </svg>
  );
}

/** A goal in steps: two done, two to go, and the goal itself at the end of the way. */
function Steps() {
  return (
    <svg width="176" height="39" viewBox="0 0 200 44" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 22h150" className="text-ink-4" stroke="currentColor" strokeWidth="1" strokeDasharray="0 6" />
      <g className="text-ink" fill="currentColor">
        <circle cx="14" cy="22" r="3" />
        <circle cx="56" cy="22" r="3" />
      </g>
      <g className="text-ink-3" stroke="currentColor" strokeWidth="1.1">
        <circle cx="98" cy="22" r="3" />
        <circle cx="140" cy="22" r="3" />
      </g>
      <path d="M184 15.5 190.5 22 184 28.5 177.5 22Z" className="text-ink" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}
