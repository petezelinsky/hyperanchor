"use client";

import { PlusIcon } from "../icons";
import { Burst, Checkbox, ProgressRing } from "../ui";
import { useLoop } from "./useInView";

const TASKS = [
  { title: "Plan the week", note: "Three things that matter most" },
  { title: "Send the proposal to Dana", note: "" },
  { title: "Gym, 45 minutes", note: "" },
  { title: "Pick up flowers for Sam", note: "Peonies, if they have them" },
];
// Wait, then tick the four tasks one by one, celebrate, start over.
const DELAYS = [1600, 950, 950, 950, 2600, 900];

/** The hero illustration: a day's list that checks itself off. Not interactive. */
export function HeroCard() {
  const step = useLoop(DELAYS);
  const done = Math.min(step, TASKS.length);
  const all = done === TASKS.length;

  return (
    <div className="relative w-full max-w-[420px] rounded-[22px] bg-surface p-5 text-left shadow-float">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-display text-[20px] leading-7 font-bold tracking-[-0.02em]">Today</div>
          <div className={`tabular mt-0.5 text-[13px] transition-colors duration-300 ${all ? "font-medium text-ink" : "text-ink-3"}`}>
            {all ? "All done. Nice work!" : `${done} of ${TASKS.length} done`}
          </div>
        </div>
        <Burst active={all}>
          <ProgressRing value={done / TASKS.length} size={36} stroke={3.5} />
        </Burst>
      </div>
      <ul className="mt-4">
        {TASKS.map((t, i) => {
          const checked = i < done;
          return (
            <li key={t.title} className="flex items-start gap-3 border-t border-line py-2.5">
              <Checkbox checked={checked} onToggle={() => {}} label={t.title} className="mt-px" />
              <div className="min-w-0">
                <div className={`truncate text-[14px] leading-5 transition-colors duration-300 ${checked ? "text-ink-3" : "text-ink"}`}>{t.title}</div>
                {t.note && <div className="truncate text-[12.5px] text-ink-3">{t.note}</div>}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-3 border-t border-line pt-2.5 text-[14px] text-ink-3">
        <span className="flex size-5 items-center justify-center">
          <PlusIcon size={15} />
        </span>
        Add a task
      </div>
    </div>
  );
}
