"use client";

import { Orb } from "./voice/Orb";

/** The parts of the app that aren't open yet. They have no pages: the sidebar shows them, quiet, and says what's coming. */
export type Soon = "timeline" | "goals" | "agent";

export const SOON: Record<Soon, { title: string; line: string }> = {
  timeline: {
    title: "Timeline",
    line: "Your whole life on one line. Look back at everything you’ve done and ahead at what’s coming: days, months and years at a glance.",
  },
  goals: {
    title: "Goals",
    line: "Cards for what you want to reach. Set a goal, break it into steps, and each step becomes a task on its day.",
  },
  agent: {
    title: "Agent",
    line: "An AI agent that makes your days better: it plans with you, keeps things moving and does tasks for you.",
  },
};

/** "Soon": something that isn't open yet. */
export const SoonTag = () => (
  <span className="inline-flex h-[18px] flex-none items-center rounded-[5px] px-1.5 text-caption-2 font-medium text-ink-3 shadow-[inset_0_0_0_1px_var(--line-2)]">Soon</span>
);

/**
 * What's coming, in a small card: a drawing of the idea on a soft panel, its name and a few lines on what it will do.
 * Shown beside a Soon page in the sidebar when the pointer rests on it, or under it in the account panel on phones.
 */
export function SoonCard({ soon, className = "" }: { soon: Soon; className?: string }) {
  const s = SOON[soon];
  return (
    <div className={className}>
      <div aria-hidden="true" className="relative overflow-hidden rounded-[12px] bg-surface-2 shadow-[inset_0_0_0_1px_var(--line)]">
        {soon === "timeline" ? <LineOfLife /> : soon === "goals" ? <GoalCards /> : <AgentAtWork />}
      </div>
      <div className="mt-3.5 flex items-center gap-2 px-0.5">
        <span className="text-callout font-semibold text-ink">{s.title}</span>
        <SoonTag />
      </div>
      <p className="mt-1 px-0.5 text-footnote text-pretty text-ink-2">{s.line}</p>
    </div>
  );
}

const ART = "block h-auto w-full";

/** Timeline: years on one line, what happened as bars over it, what's planned as outlines, and today standing on it. */
function LineOfLife() {
  const ticks = Array.from({ length: 25 }, (_, i) => i * 12);
  return (
    <svg viewBox="0 0 288 132" className={ART} fill="none">
      <defs>
        <linearGradient id="soon-fade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.16" stopColor="#fff" />
          <stop offset="0.86" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="soon-edges">
          <rect width="288" height="132" fill="url(#soon-fade)" />
        </mask>
      </defs>
      <g mask="url(#soon-edges)">
        {/* The line of time and its ticks; every fifth a little taller. */}
        <path d="M0 94h288" stroke="var(--ink-4)" strokeWidth="1" />
        {ticks.map((x, i) => (
          <path key={x} d={`M${x} ${i % 6 ? 90 : 87}V94`} stroke="var(--ink-4)" strokeWidth="1" />
        ))}
        {/* What has been: solid bars, older ones paler. */}
        <rect x="14" y="50" width="62" height="9" rx="4.5" fill="var(--line-2)" />
        <rect x="46" y="32" width="84" height="9" rx="4.5" fill="var(--ink-4)" />
        <rect x="92" y="68" width="46" height="9" rx="4.5" fill="var(--line-2)" />
        <rect x="118" y="50" width="76" height="9" rx="4.5" fill="var(--ink-3)" />
        <rect x="148" y="32" width="48" height="9" rx="4.5" fill="var(--ink)" />
        {/* What's ahead: outlines. */}
        <rect x="204.5" y="50.5" width="52" height="8" rx="4" stroke="var(--ink-4)" strokeDasharray="3 3" />
        <rect x="222.5" y="68.5" width="58" height="8" rx="4" stroke="var(--ink-4)" strokeDasharray="3 3" />
        <text x="24" y="112" fontSize="8.5" fill="var(--ink-3)" fontFamily="inherit">
          2024
        </text>
        <text x="96" y="112" fontSize="8.5" fill="var(--ink-3)" fontFamily="inherit">
          2025
        </text>
        <text x="240" y="112" fontSize="8.5" fill="var(--ink-3)" fontFamily="inherit">
          2027
        </text>
      </g>
      {/* Today: where the line is being written. */}
      <path d="M196 26v68" stroke="var(--ink)" strokeWidth="1.25" strokeLinecap="round" />
      <circle cx="196" cy="94" r="4" fill="var(--ink)" stroke="var(--surface-2)" strokeWidth="2" />
      <rect x="177" y="10" width="38" height="16" rx="8" fill="var(--ink)" />
      <text x="196" y="21.2" fontSize="8.5" fontWeight="600" fill="var(--surface)" textAnchor="middle" fontFamily="inherit">
        Today
      </text>
    </svg>
  );
}

/** Goals: a card with a goal on it, how far along it is, and its steps, two done and one to go; more cards behind it. */
function GoalCards() {
  return (
    <svg viewBox="0 0 288 132" className={ART} fill="none">
      {/* The cards behind. */}
      <rect x="86" y="13" width="152" height="100" rx="12" fill="var(--surface)" stroke="var(--line)" transform="rotate(5 162 63)" />
      <rect x="74" y="15" width="152" height="100" rx="12" fill="var(--surface)" stroke="var(--line-2)" transform="rotate(-3 150 65)" />
      {/* The goal on top. */}
      <rect x="64.5" y="16.5" width="159" height="103" rx="12" fill="var(--surface)" stroke="var(--line-2)" />
      <path d="M82 31.5 87 36.500 82 41.500 77 36.500Z" stroke="var(--ink)" strokeWidth="1.2" strokeLinejoin="round" />
      <rect x="95" y="33" width="74" height="7" rx="3.5" fill="var(--ink)" />
      <text x="208" y="40" fontSize="8.5" fill="var(--ink-3)" textAnchor="end" fontFamily="inherit">
        2 of 3
      </text>
      <rect x="78" y="50" width="131" height="4" rx="2" fill="var(--line)" />
      <rect x="78" y="50" width="87" height="4" rx="2" fill="var(--ink)" />
      {/* Its steps: each one a task. */}
      {[0, 1, 2].map((i) => {
        const y = 70 + i * 16;
        const done = i < 2;
        return (
          <g key={i}>
            {done ? (
              <>
                <rect x="78" y={y - 5} width="10" height="10" rx="3.2" fill="var(--ink)" />
                <path d={`M80.6 ${y + 0.2} 82.400 ${y + 2} 85.600 ${y - 1.600}`} stroke="var(--surface)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </>
            ) : (
              <rect x="78.6" y={y - 4.4} width="8.8" height="8.8" rx="2.8" stroke="var(--check-ring)" strokeWidth="1.2" />
            )}
            <rect x="95" y={y - 2.5} width={[72, 92, 58][i]} height="5" rx="2.5" fill={done ? "var(--ink-4)" : "var(--ink-3)"} />
          </g>
        );
      })}
    </svg>
  );
}

/** Agent: the sphere in the middle, and tasks around it getting done. */
function AgentAtWork() {
  const chip = (x: number, y: number, w: number, done: boolean) => (
    <g>
      <rect x={x + 0.5} y={y + 0.5} width={w} height="21" rx="10.5" fill="var(--surface)" stroke="var(--line-2)" />
      {done ? (
        <>
          <circle cx={x + 11.5} cy={y + 11} r="5" fill="var(--ink)" />
          <path d={`M${x + 9.1} ${y + 11.2} ${x + 10.9} ${y + 13} ${x + 14} ${y + 9.4}`} stroke="var(--surface)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <circle cx={x + 11.5} cy={y + 11} r="4.4" stroke="var(--check-ring)" strokeWidth="1.2" />
      )}
      <rect x={x + 21} y={y + 8.5} width={w - 31} height="5" rx="2.5" fill={done ? "var(--ink-4)" : "var(--ink-3)"} />
    </g>
  );
  return (
    <div className="relative">
      <svg viewBox="0 0 288 132" className={ART} fill="none">
        {/* Its reach: two quiet orbits. */}
        <ellipse cx="144" cy="66" rx="112" ry="46" stroke="var(--line-2)" strokeDasharray="1.5 5" strokeLinecap="round" />
        <ellipse cx="144" cy="66" rx="74" ry="30" stroke="var(--line-2)" strokeDasharray="1.5 5" strokeLinecap="round" />
        {chip(18, 22, 70, true)}
        {chip(196, 34, 76, true)}
        {chip(30, 88, 82, true)}
        {chip(186, 92, 66, false)}
      </svg>
      <span className="absolute top-1/2 left-1/2 flex size-[30%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-surface-2">
        <Orb size={64} className="text-ink" />
      </span>
    </div>
  );
}
