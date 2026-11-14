"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { fmt1, niceMax, pct } from "@/lib/stats";
import type { Task } from "@/lib/types";

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
 * Stacked columns: completed (accent) under still-open (lighter accent), a 2px surface gap between them, 4px rounded
 * tops, square at the baseline; solid hairline grid; a dashed reference line for the average. Under the pointer a
 * column is lit by a soft lane and a small card over the bar says what it holds; a click (or Enter) opens it (`onPick`).
 */
export function BarChart({ bars, avg, avgLabel, onPick }: { bars: Bar[]; avg: number | null; avgLabel: string; onPick?: (b: Bar, el: HTMLElement) => void }) {
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
              <span className="tabular absolute right-0 bottom-1 bg-surface pl-1.5 text-caption-2 font-medium text-ink-3">
                {avgLabel} {fmt1(avg)}
              </span>
            </div>
          )}

          <div className={`relative grid h-full items-end ${dense ? "gap-[3px]" : "gap-2 sm:gap-3"}`} style={cols}>
            {bars.map((b, i) => {
              const open = b.total - b.done;
              const on = hover === i;
              return (
                <button
                  key={b.key}
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onFocus={(e) => e.currentTarget.matches(":focus-visible") && setHover(i)}
                  onBlur={() => setHover(null)}
                  onClick={(e) => onPick?.(b, e.currentTarget.querySelector<HTMLElement>("[data-bar]") ?? e.currentTarget)}
                  aria-label={`${b.title}: ${b.done} of ${b.total} done`}
                  aria-haspopup="dialog"
                  // The lane behind a column under the pointer: a soft rounded band, the column itself untouched.
                  className={`relative flex h-full min-w-0 flex-col items-center justify-end rounded-[6px] transition-colors duration-(--duration-fast) ${on ? "bg-surface-2" : ""} ${
                    !b.elapsed && !b.total ? "pointer-events-none" : ""
                  }`}
                >
                  {b.total > 0 ? (
                    <span
                      data-bar=""
                      className={`flex w-full origin-bottom flex-col justify-end ${b.elapsed ? "" : "opacity-60"}`}
                      style={{ height: `${(b.total / max) * 100}%`, maxWidth: maxW, animation: `grow-y var(--duration-data) ${Math.min(i, 30) * 18}ms var(--ease-out) both` }}
                    >
                      {open > 0 && <span className="min-h-[3px] rounded-t-xs bg-accent-track" style={{ flex: open }} />}
                      {open > 0 && b.done > 0 && <span className="h-[2px] flex-none" />}
                      {b.done > 0 && <span className={`min-h-[3px] bg-accent ${open > 0 ? "" : "rounded-t-xs"}`} style={{ flex: b.done }} />}
                    </span>
                  ) : (
                    b.elapsed && <span data-bar="" className="h-[2px] w-full rounded-full bg-line-2" style={{ maxWidth: maxW }} />
                  )}
                </button>
              );
            })}
          </div>

          {hb && (hb.total > 0 || hb.elapsed) && <Tip bar={hb} index={hover!} n={n} top={1 - hb.total / max} />}
        </div>

        {/* X axis */}
        <div className={`mt-2 grid ${dense ? "gap-[3px]" : "gap-2 sm:gap-3"}`} style={cols}>
          {bars.map((b, i) => {
            const on = hover === i;
            return (
              <div key={b.key} className="flex min-w-0 flex-col items-center text-center">
                <span
                  className={`tabular text-caption-2 whitespace-nowrap transition-colors duration-(--duration-fast) ${
                    on || b.current ? "font-semibold text-ink" : "text-ink-3"
                  } ${dense && !b.major && !b.current && !on ? "invisible" : ""}`}
                >
                  {b.label}
                </span>
                {b.sub && <span className={`tabular text-caption-2 ${on || b.current ? "font-semibold text-ink" : "text-ink-3"}`}>{b.sub}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * The card over a column under the pointer: its day, how many of its tasks are done, and a thin line of the same. It
 * sits just above the bar, centred on it, and never leaves the chart's sides.
 */
function Tip({ bar, index, n, top }: { bar: Bar; index: number; n: number; top: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [x, setX] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    const w = el.offsetWidth;
    const W = box.clientWidth;
    const center = ((index + 0.5) / n) * W;
    setX(Math.min(Math.max(0, center - w / 2), W - w));
  }, [index, n, bar.key]);
  const rate = bar.total ? bar.done / bar.total : 0;
  // Above the bar where there's room; over the top of the chart for the tallest bars.
  const y = Math.max(0, top * H - 10);
  return (
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none absolute z-10 w-max min-w-[132px] max-w-[220px] -translate-y-full rounded-[10px] bg-elevated px-3 py-2.5 shadow-float transition-[left,top] duration-(--duration-fast) ease-out"
      style={{ left: x ?? 0, top: y, visibility: x == null ? "hidden" : "visible" }}
    >
      <div className="truncate text-caption text-ink-3">{bar.title}</div>
      {bar.total ? (
        <>
          <div className="tabular mt-0.5 flex items-baseline justify-between gap-3 text-footnote">
            <span className="font-semibold text-ink">
              {bar.done} <span className="font-normal text-ink-2">of {bar.total} done</span>
            </span>
            <span className="text-caption text-ink-3">{pct(rate)}</span>
          </div>
          <div aria-hidden="true" className="mt-2 h-[3px] overflow-hidden rounded-full bg-accent-track">
            <div className="h-full rounded-full bg-accent" style={{ width: `${rate * 100}%` }} />
          </div>
        </>
      ) : (
        <div className="mt-0.5 text-footnote text-ink-2">Nothing planned</div>
      )}
    </div>
  );
}
