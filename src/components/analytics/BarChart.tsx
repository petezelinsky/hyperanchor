"use client";

import { useEffect, useState } from "react";
import { fmt1, niceMax, pct } from "@/lib/stats";
import type { Task } from "@/lib/types";

export type Bar = {
  key: string;
  label: string;
  /** Second label line (e.g. the date under the weekday); optional. */
  sub?: string;
  /** Show the label even when the chart is dense. */
  major?: boolean;
  title: string;
  done: number;
  total: number;
  elapsed: boolean;
  current: boolean;
  tasks?: Task[];
};

const H = 220;

export function BarChart({ bars, avg, onPick }: { bars: Bar[]; avg: number | null; onPick?: (b: Bar) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const max = niceMax(Math.max(0, ...bars.map((b) => b.total)));
  const n = bars.length;
  const dense = n > 12;
  const maxW = n <= 7 ? 40 : n <= 12 ? 30 : 12;
  const gap = dense ? "gap-[3px] sm:gap-1" : "gap-2 sm:gap-4";
  const cols = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` };
  const hb = hover != null ? bars[hover] : null;

  return (
    <div className="flex gap-3">
      <div className="tabular relative w-5 flex-none text-right font-mono text-[10px] text-faint" style={{ height: H }}>
        {[max, max / 2, 0].map((v, i) => (
          <span key={i} className="absolute right-0 -translate-y-1/2" style={{ top: `${(i / 2) * 100}%` }}>
            {fmt1(v)}
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height: H }} onMouseLeave={() => setHover(null)}>
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-line" />
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
          <div className="absolute inset-x-0 bottom-0 border-t border-edge" />
          {avg != null && avg > 0 && (
            <div className="pointer-events-none absolute inset-x-0 z-[1] border-t border-dashed border-ink/35 transition-[bottom] duration-700 ease-quiet" style={{ bottom: `${grown ? (avg / max) * 100 : 0}%` }}>
              <span className="tabular absolute right-0 bottom-1 bg-paper/90 pl-1.5 font-mono text-[10px] text-muted uppercase">avg {fmt1(avg)}</span>
            </div>
          )}

          <div className={`relative grid h-full items-end ${gap}`} style={cols}>
            {bars.map((b, i) => (
              <button
                key={b.key}
                type="button"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={() => onPick?.(b)}
                disabled={!b.elapsed && !b.total}
                aria-label={`${b.title}: ${b.done} of ${b.total} done`}
                className={`flex h-full min-w-0 flex-col items-center justify-end rounded-[8px] transition-[background-color,opacity] duration-150 ${hover === i ? "bg-fill-row" : ""} ${hover != null && hover !== i ? "opacity-40" : ""}`}
              >
                {b.total > 0 ? (
                  <span
                    className="flex w-full flex-col gap-[2px] overflow-hidden rounded-[4px] transition-[height] duration-700 ease-quiet"
                    style={{ height: grown ? `${(b.total / max) * 100}%` : "0%", maxWidth: maxW, transitionDelay: `${Math.min(i, 31) * 12}ms` }}
                  >
                    {b.total > b.done && <span className="min-h-0 bg-track" style={{ flex: b.total - b.done }} />}
                    {b.done > 0 && <span className={`min-h-0 ${b.current ? "bg-signal" : "bg-ink"}`} style={{ flex: b.done }} />}
                  </span>
                ) : (
                  b.elapsed && <span className="h-[2px] w-full rounded-full bg-ghost" style={{ maxWidth: maxW }} />
                )}
              </button>
            ))}
          </div>

          {hb && (hb.total > 0 || hb.elapsed) && <Tooltip bar={hb} index={hover!} n={n} />}
        </div>

        <div className={`mt-2.5 grid ${gap}`} style={cols}>
          {bars.map((b, i) => (
            <div key={b.key} className={`flex min-w-0 flex-col items-center gap-0.5 text-center transition-opacity ${hover != null && hover !== i ? "opacity-40" : ""}`}>
              <span
                className={`tabular font-mono text-[10px] tracking-[0.04em] whitespace-nowrap uppercase ${b.current ? "text-ink" : "text-faint"} ${dense && !b.major && !b.current ? "invisible" : ""}`}
              >
                {b.label}
              </span>
              {b.sub && <span className={`tabular text-[13px] ${b.current ? "font-medium text-ink" : "text-muted"}`}>{b.sub}</span>}
              {b.current && <span className="size-1 rounded-full bg-signal" />}
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
  const style: React.CSSProperties = align === "left" ? { left: 0 } : align === "right" ? { right: 0 } : { left: `${center}%`, transform: "translateX(-50%)" };
  const tasks = bar.tasks ? [...bar.tasks].sort((a, b) => Number(b.done) - Number(a.done)) : [];

  return (
    <div role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+8px)] z-10 w-[250px]" style={style}>
      <div className="animate-pop rounded-[14px] bg-paper p-4 shadow-menu">
        <div className="text-[14px] font-medium">{bar.title}</div>
        <div className="tabular mt-0.5 font-mono text-[11px] text-muted uppercase">
          {bar.total ? `${bar.done} of ${bar.total} done · ${pct(bar.done / bar.total)}` : "Nothing planned"}
        </div>
        {tasks.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
            {tasks.slice(0, 6).map((t) => (
              <li key={t.id} className={`flex items-center gap-2.5 text-[13px] ${t.done ? "text-ink" : "text-faint"}`}>
                <span className={`size-[6px] flex-none rounded-full ${t.done ? (bar.current ? "bg-signal" : "bg-ink") : "shadow-[inset_0_0_0_1.2px_var(--ghost)]"}`} />
                <span className="truncate">{t.title}</span>
              </li>
            ))}
            {tasks.length > 6 && <li className="pl-4 font-mono text-[11px] text-faint">+{tasks.length - 6} more</li>}
          </ul>
        )}
      </div>
    </div>
  );
}
