"use client";

import { addDays, dayDiff, formatMedium, MONTHS_SHORT, startOfWeek, ymd } from "@/lib/dates";
import type { DayStat } from "@/lib/stats";

const LEVELS = [
  "var(--fill)",
  "color-mix(in srgb, var(--ink) 20%, var(--paper))",
  "color-mix(in srgb, var(--ink) 42%, var(--paper))",
  "color-mix(in srgb, var(--ink) 68%, var(--paper))",
  "var(--ink)",
];

/** A year of days, one column per week (Monday on top), colored by how many tasks were completed. */
export function Heatmap({ days, onPick }: { days: DayStat[]; onPick: (key: string) => void }) {
  if (!days.length) return null;
  const byKey = new Map(days.map((d) => [d.key, d]));
  const first = startOfWeek(days[0].date);
  const weeks = Math.ceil((dayDiff(days[days.length - 1].date, first) + 1) / 7);
  const max = Math.max(1, ...days.map((d) => d.done));
  const level = (d: DayStat) => (d.done ? Math.min(4, Math.max(1, Math.ceil((d.done / max) * 4))) : 0);
  const year = days[0].date.getFullYear();

  // Month labels sit above the first week that contains the month's first day.
  const monthCols = Array.from({ length: 12 }, (_, m) => Math.floor(dayDiff(new Date(year, m, 1), first) / 7));

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[620px]">
          <div className="relative ml-8 h-4 font-mono text-[10px] tracking-[0.06em] text-faint uppercase">
            {monthCols.map((col, m) => (
              <span key={m} className="absolute" style={{ left: `${(col / weeks) * 100}%` }}>
                {MONTHS_SHORT[m]}
              </span>
            ))}
          </div>
          <div className="mt-1 flex gap-2">
            <div className="grid w-6 flex-none grid-rows-7 gap-[3px] font-mono text-[9.5px] text-faint uppercase">
              {["Mon", "", "Wed", "", "Fri", "", ""].map((l, i) => (
                <span key={i} className="flex items-center">
                  {l}
                </span>
              ))}
            </div>
            <div className="grid flex-1 grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}>
              {Array.from({ length: weeks * 7 }, (_, i) => {
                const date = addDays(first, Math.floor(i / 7) * 7 + (i % 7));
                const d = byKey.get(ymd(date));
                if (!d) return <span key={i} className="aspect-square" />;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onPick(d.key)}
                    title={`${formatMedium(d.date)} — ${d.total ? `${d.done} of ${d.total} done` : "no tasks"}`}
                    aria-label={`${formatMedium(d.date)}: ${d.done} of ${d.total} done`}
                    className={`aspect-square w-full rounded-[3px] transition-transform duration-150 hover:scale-125 ${d.isToday ? "ring-[1.5px] ring-signal ring-offset-1 ring-offset-paper" : ""}`}
                    style={{ background: d.elapsed ? LEVELS[level(d)] : "var(--fill-row)" }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-1.5 font-mono text-[10px] text-faint uppercase">
        Less
        {LEVELS.map((c, i) => (
          <span key={i} className="size-3 rounded-[3px]" style={{ background: c }} />
        ))}
        More
      </div>
    </div>
  );
}
