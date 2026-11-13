"use client";

import { SoonTag } from "./Sidebar";
import { Orb } from "./voice/Orb";

type Soon = "timeline" | "goals" | "agent";

/**
 * Pages that aren't open yet: Timeline, Goals and Agent. Each is only a sign of what's coming, in the middle of the page:
 * one small drawing of the idea, its name, and one line in Bodymove's words.
 */
const PAGES: Record<Soon, { title: string; line: string; figure: React.ReactNode }> = {
  timeline: { title: "Timeline", line: "All of the plan. None of the planning.", figure: <LineOfTime /> },
  goals: { title: "Goals", line: "A goal is a card with steps. Each step becomes a task.", figure: <Steps /> },
  agent: { title: "Agent", line: "An AI agent that leads your life and makes it better.", figure: <Orb size={44} className="text-ink" /> },
};

export function ComingSoon({ page }: { page: Soon }) {
  const p = PAGES[page];
  return (
    <div className="flex min-h-full items-center justify-center px-6 pt-16 pb-[14vh] max-md:min-h-[calc(100dvh-101px)]">
      <div key={page} className="flex max-w-[360px] animate-rise flex-col items-center text-center">
        <div aria-hidden="true" className="flex h-11 items-center">
          {p.figure}
        </div>
        <h2 className="mt-5 flex items-center gap-2 font-display text-[17px] leading-6 font-semibold tracking-[-0.014em] text-ink">
          {p.title}
          <SoonTag />
        </h2>
        <p className="mt-1.5 text-body text-balance text-ink-3">{p.line}</p>
      </div>
    </div>
  );
}

/** The line of time (Bodymove's timeline): days ticking by, a few things on it, and today held where it is. */
function LineOfTime() {
  const ticks = Array.from({ length: 21 }, (_, i) => 10 + i * 9);
  return (
    <svg width="200" height="44" viewBox="0 0 200 44" fill="none" strokeLinecap="round">
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
    <svg width="200" height="44" viewBox="0 0 200 44" fill="none" strokeLinecap="round" strokeLinejoin="round">
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
