"use client";

import { useState } from "react";
import { fmt1, niceMax, pct } from "@/lib/stats";
import type { Task } from "@/lib/types";
import { CheckIcon } from "../icons";

export type Bar = {
  key: string;
  label: string;
  /** Second label line (e.g. the date under the weekday); optional. */
  sub?: string;
  /** Show the label even in dense mode. */
  major?: boolean;
  title: string;
  done: number;
  total: number;
  elapsed: boolean;
  current: boolean;
  tasks?: Task[];
};

const H = 216;

/**
 * Stacked columns: completed (accent) under still-open (lighter accent), a 2px surface gap between them,
 * 4px rounded tops, square at the baseline; solid hairline grid; a dashed reference line for the average.
 */
export function BarChart({ bars, avg, avgLabel, onPick }: { bars: Bar[]; avg: number | null; avgLabel: string; onPick?: (b: Bar) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...bars.map((b) => b.total)));
  const n = bars.length;
  const dense = n > 12;
  const maxW = dense ? 14 : 24;
  const cols = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` };
  const hb = hover != null ? bars[hover] : null;

  return (
    <div className="flex gap-2.5">
      {/* Y axis */}
      <div className="tabular relative w-6 flex-none text-right text-caption-2 text-ink-3" style={{ height: H }}>
        {[max, max / 2, 0].map((v, i) => (
          <span key={i} className="absolute right-0 -translate-y-1/2" style={{ top: `${(i / 2) * 100}%` }}>
            {fmt1(v)}
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height: H }} onMouseLeave={() => setHover(null)}>
          <div className="absolute inset-x-0 top-0 border-t border-line" />
          <div className="absolute inset-x-0 top-1/2 border-t border-line" />
          <div className="absolute inset-x-0 bottom-0 border-t border-line-2" />
          {avg != null && avg > 0 && (
            <div className="pointer-events-none absolute inset-x-0 z-[1] border-t border-dashed border-ink-3" style={{ bottom: `${(avg / max) * 100}%` }}>
              <span className="tabular absolute right-0 bottom-1 rounded-xs bg-surface px-1.5 py-px text-caption-2 font-medium text-ink-2 shadow-lift">
                {avgLabel} {fmt1(avg)}
              </span>
            </div>
          )}

          <div className={`relative grid h-full items-end ${dense ? "gap-[3px]" : "gap-2 sm:gap-3"}`} style={cols}>
            {bars.map((b, i) => {
              const open = b.total - b.done;
              return (
                <button
                  key={b.key}
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  onClick={() => onPick?.(b)}
                  disabled={!b.elapsed && !b.total}
                  aria-label={`${b.title}: ${b.done} of ${b.total} done`}
                  className={`flex h-full min-w-0 flex-col items-center justify-end rounded-sm transition-[background-color,opacity] duration-(--duration-fast) ${hover === i ? "bg-surface-2" : ""} ${
                    hover != null && hover !== i ? "opacity-45" : ""
                  }`}
                >
                  {b.total > 0 ? (
                    <span
                      className={`flex w-full origin-bottom flex-col justify-end ${b.elapsed ? "" : "opacity-60"}`}
                      style={{ height: `${(b.total / max) * 100}%`, maxWidth: maxW, animation: `grow-y var(--duration-data) ${Math.min(i, 30) * 18}ms var(--ease-out) both` }}
                    >
                      {open > 0 && <span className="min-h-[3px] rounded-t-xs bg-accent-track" style={{ flex: open }} />}
                      {open > 0 && b.done > 0 && <span className="h-[2px] flex-none" />}
                      {b.done > 0 && <span className={`min-h-[3px] bg-accent ${open > 0 ? "" : "rounded-t-xs"}`} style={{ flex: b.done }} />}
                    </span>
                  ) : (
                    b.elapsed && <span className="h-[2px] w-full rounded-full bg-line-2" style={{ maxWidth: maxW }} />
                  )}
                </button>
              );
            })}
          </div>

          {hb && (hb.total > 0 || hb.elapsed) && <Tooltip bar={hb} index={hover!} n={n} />}
        </div>

        {/* X axis */}
        <div className={`mt-2 grid ${dense ? "gap-[3px]" : "gap-2 sm:gap-3"}`} style={cols}>
          {bars.map((b, i) => (
            <div key={b.key} className={`flex min-w-0 flex-col items-center text-center transition-opacity ${hover != null && hover !== i ? "opacity-45" : ""}`}>
              <span className={`tabular text-caption-2 whitespace-nowrap ${b.current ? "font-semibold text-ink" : "text-ink-3"} ${dense && !b.major && !b.current ? "invisible" : ""}`}>
                {b.label}
              </span>
              {b.sub && <span className={`tabular text-caption-2 ${b.current ? "font-semibold text-ink" : "text-ink-3"}`}>{b.sub}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Tooltip({ bar, index, n }: { bar: Bar; index: number; n: number }) {
  const center = ((index + 0.5) / n) * 100;
  const align = center < 22 ? "left" : center > 78 ? "right" : "center";
  const style: React.CSSProperties =
    align === "left" ? { left: 0 } : align === "right" ? { right: 0 } : { left: `${center}%`, transform: "translateX(-50%)" };
  const tasks = bar.tasks ? [...bar.tasks].sort((a, b) => Number(b.done) - Number(a.done)) : [];

  return (
    <div role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+8px)] z-10 w-[244px] animate-pop-in rounded-lg bg-elevated p-3 shadow-float" style={style}>
      <div className="tabular text-callout font-semibold">
        {bar.total ? (
          <>
            {bar.done} <span className="text-caption font-normal text-ink-3">of {bar.total} done · {pct(bar.done / bar.total)}</span>
          </>
        ) : (
          <span className="text-footnote font-normal text-ink-3">Nothing planned</span>
        )}
      </div>
      <div className="mt-0.5 text-caption text-ink-2">{bar.title}</div>
      {tasks.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-line pt-2">
          {tasks.slice(0, 6).map((t) => (
            <li key={t.id} className={`flex items-center gap-2 text-caption ${t.done ? "text-ink" : "text-ink-3"}`}>
              <span
                className={`flex size-3 flex-none items-center justify-center rounded-full ${t.done ? "bg-accent text-on-accent" : "border border-check-ring"}`}
              >
                {t.done && <CheckIcon size={7} />}
              </span>
              <span className="truncate">{t.title}</span>
            </li>
          ))}
          {tasks.length > 6 && <li className="pl-5 text-caption text-ink-3">{tasks.length - 6} more</li>}
        </ul>
      )}
    </div>
  );
}
