"use client";

import { useState } from "react";
import { addDays, dayDiff, formatLong, MONTHS_SHORT, startOfWeek, weekdayNames, ymd } from "@/lib/dates";
import type { DayStat } from "@/lib/stats";
import { tr } from "@/lib/i18n";

// Sequential: one hue, more completed is darker (lighter in dark mode). Zero recedes toward the surface.
const LEVELS = ["var(--heat-0)", "var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)"];

/**
 * A year of days, one column per week (its first day on top), shaded by how many tasks were completed. Under the
 * pointer a day is ringed and a small card says what it held; a click opens it beside the square (`onPick`).
 */
export function Heatmap({ days, todayKey, onPick }: { days: DayStat[]; todayKey: string; onPick: (d: DayStat, el: HTMLElement) => void }) {
  const [hover, setHover] = useState<{ d: DayStat; x: number; y: number; h: number; w: number } | null>(null);
  if (!days.length) return null;
  const byKey = new Map(days.map((d) => [d.key, d]));
  const first = startOfWeek(days[0].date);
  const weeks = Math.ceil((dayDiff(days[days.length - 1].date, first) + 1) / 7);
  const max = Math.max(1, ...days.map((d) => d.done));
  const level = (d: DayStat) => (d.done ? Math.min(4, Math.max(1, Math.ceil((d.done / max) * 4))) : 0);
  const year = days[0].date.getFullYear();

  // Month labels sit above the first week that contains the month's first day.
  const monthCols = Array.from({ length: 12 }, (_, m) => Math.floor(dayDiff(new Date(year, m, 1), first) / 7));

  const point = (d: DayStat, el: HTMLElement) => {
    const grid = el.closest<HTMLElement>("[data-heat]");
    if (!grid) return;
    const g = grid.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setHover({ d, x: r.left - g.left + r.width / 2, y: r.top - g.top, h: r.height, w: g.width });
  };

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div data-heat="" className="relative min-w-[620px] pt-1" onMouseLeave={() => setHover(null)}>
          <div className="relative ml-8 h-4 text-caption-2 text-ink-3">
            {monthCols.map((col, m) => (
              <span key={m} className="absolute" style={{ left: `${(col / weeks) * 100}%` }}>
                {MONTHS_SHORT[m]}
              </span>
            ))}
          </div>
          <div className="mt-1 flex gap-2">
            <div className="grid w-6 flex-none grid-rows-7 gap-[3px] text-caption-2 text-ink-3">
              {weekdayNames("short").map((l, i) => (
                <span key={i} className="flex items-center">
                  {l === "Mon" || l === "Wed" || l === "Fri" ? l : ""}
                </span>
              ))}
            </div>
            <div className="grid flex-1 grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}>
              {Array.from({ length: weeks * 7 }, (_, i) => {
                const date = addDays(first, Math.floor(i / 7) * 7 + (i % 7));
                const d = byKey.get(ymd(date));
                if (!d) return <span key={i} className="aspect-square" />;
                const on = hover?.d.key === d.key;
                return (
                  <button
                    key={i}
                    type="button"
                    onMouseEnter={(e) => point(d, e.currentTarget)}
                    onFocus={(e) => e.currentTarget.matches(":focus-visible") && point(d, e.currentTarget)}
                    onBlur={() => setHover(null)}
                    onClick={(e) => onPick(d, e.currentTarget)}
                    aria-haspopup="dialog"
                    aria-label={`${formatLong(d.date)}: ${tr("{done} of {total} done", { done: d.done, total: d.total })}`}
                    className={`aspect-square w-full rounded-xs transition-shadow duration-(--duration-fast) ${
                      on ? "shadow-[0_0_0_1.5px_var(--surface),0_0_0_3px_var(--ink-2)]" : d.isToday ? "shadow-[0_0_0_1.5px_var(--surface),0_0_0_2.5px_var(--ink-3)]" : ""
                    }`}
                    style={{ background: d.elapsed ? LEVELS[level(d)] : "var(--surface-2)" }}
                  />
                );
              })}
            </div>
          </div>
          {hover && <HeatTip {...hover} ahead={hover.d.key > todayKey} />}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-caption-2 text-ink-3">
        {tr("Less")}
        {LEVELS.map((c, i) => (
          <span key={i} className="size-3 rounded-xs" style={{ background: c }} />
        ))}
        {tr("More")}
      </div>
    </div>
  );
}

/**
 * The card by a square under the pointer: the day, and how many of its tasks were done. Above the square, or below it
 * in the top rows, where the scrolling strip would cut it off.
 */
function HeatTip({ d, x, y, h, w, ahead }: { d: DayStat; x: number; y: number; h: number; w: number; ahead: boolean }) {
  const width = 176;
  const left = Math.min(Math.max(0, x - width / 2), w - width);
  const below = y < 60;
  return (
    <div
      role="tooltip"
      className={`pointer-events-none absolute z-10 rounded-[10px] bg-elevated px-3 py-2 shadow-float ${below ? "" : "-translate-y-full"}`}
      style={{ left, top: below ? y + h + 8 : y - 8, width }}
    >
      <div className="truncate text-caption text-ink-3">{formatLong(d.date)}</div>
      <div className="tabular mt-0.5 text-footnote">
        {d.total ? (
          <span className="font-semibold text-ink">
            {d.done} <span className="font-normal text-ink-2">{tr("of {n} done", { n: d.total })}</span>
          </span>
        ) : (
          <span className="text-ink-2">{ahead ? tr("Still ahead") : tr("Nothing planned")}</span>
        )}
      </div>
    </div>
  );
}
