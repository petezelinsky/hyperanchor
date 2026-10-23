"use client";

import { useEffect, useRef, useState } from "react";
import { fmt1, pct, type Period, type Summary } from "@/lib/stats";
import { FlameIcon } from "../icons";

export function Card({ title, aside, className = "", children }: { title: string; aside?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={`animate-rise rounded-[16px] bg-surface p-4 shadow-lift md:p-5 ${className}`}>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

/** Animates a number from its previous value to the new one. */
function useCountUp(value: number, duration = 450) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const v = a + (value - a) * (1 - Math.pow(1 - t, 3));
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, duration]);
  return shown;
}

/** Signed change vs the previous period, colored by direction (up is good for every measure here). */
function Delta({ value, digits, suffix = "", vs }: { value: number; digits: number; suffix?: string; vs: string }) {
  const r = Number(value.toFixed(digits));
  const tone = r > 0 ? "bg-green-soft text-green-ink" : r < 0 ? "bg-red-soft text-red-ink" : "bg-surface-3 text-ink-3";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`tabular inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[11.5px] font-semibold ${tone}`}>
        {r > 0 ? "▲" : r < 0 ? "▼" : "="} {r === 0 ? "0" : Math.abs(r).toFixed(digits).replace(/\.0$/, "")}
        {r !== 0 && suffix}
      </span>
      <span>{vs}</span>
    </span>
  );
}

export type SparkPoint = { value: number; current: boolean; elapsed: boolean };

/** Tiny columns of the period's trend: de-emphasized, the current day or month in the accent. */
function Sparkline({ points }: { points: SparkPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <span aria-hidden="true" className="flex h-7 w-[84px] items-end gap-[2px]">
      {points.map((p, i) => (
        <span
          key={i}
          className={`min-w-0 flex-1 rounded-t-[2px] ${p.current ? "bg-accent" : p.elapsed ? "bg-ink-4" : "bg-line"}`}
          style={{ height: p.elapsed ? `${Math.max(8, (p.value / max) * 100)}%` : "8%" }}
        />
      ))}
    </span>
  );
}

/** A ratio against its limit: accent fill on a lighter accent track. */
export function Meter({ value, className = "" }: { value: number | null; className?: string }) {
  return (
    <span aria-hidden="true" className={`block h-1.5 overflow-hidden rounded-full bg-accent-track ${className}`}>
      <span className="block h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${Math.round((value ?? 0) * 100)}%` }} />
    </span>
  );
}

function Tile({ label, value, unit, visual, foot }: { label: string; value: React.ReactNode; unit?: string; visual?: React.ReactNode; foot: React.ReactNode }) {
  return (
    <div className="flex min-w-0 animate-rise flex-col rounded-[16px] bg-surface p-4 shadow-lift">
      <div className="flex h-7 items-center justify-between gap-2">
        <span className="truncate text-[12.5px] font-medium text-ink-2">{label}</span>
        {visual && <span className="flex-none max-sm:hidden">{visual}</span>}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="font-display text-[30px] leading-9 font-semibold tracking-[-0.03em]">{value}</span>
        {unit && <span className="text-[13px] text-ink-3">{unit}</span>}
      </div>
      <div className="mt-1.5 flex min-h-5 flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-ink-3">{foot}</div>
    </div>
  );
}

export function Kpis({
  sum,
  prev,
  period,
  current,
  spark,
  streak,
  longest,
  recent,
}: {
  sum: Summary;
  prev: Summary;
  period: Period;
  /** Viewing the current period (vs an earlier one). */
  current: boolean;
  spark: SparkPoint[];
  /** Current streak (current period) or the longest one in the period. */
  streak: number;
  longest: number;
  /** Whether each of the last 7 days had something completed, oldest first. */
  recent: boolean[];
}) {
  const vs = `vs ${current ? "last" : "previous"} ${period}`;
  const prevHas = prev.planned > 0;
  const completed = useCountUp(sum.completed);
  const rate = useCountUp(sum.rate ?? 0);
  const avg = useCountUp(sum.avg);
  const streakN = useCountUp(streak);
  const none = <span>No data for the previous {period}</span>;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        label="Completed"
        value={Math.round(completed)}
        visual={<Sparkline points={spark} />}
        foot={
          <>
            <span>{sum.planned ? `of ${sum.planned} planned` : "Nothing planned yet"}</span>
            {prevHas && <Delta value={sum.completed - prev.completed} digits={0} vs={vs} />}
          </>
        }
      />
      <Tile
        label="Completion rate"
        value={sum.rate == null ? "—" : pct(rate)}
        visual={<Meter value={sum.rate} className="w-[84px]" />}
        foot={sum.rate == null ? <span>Plan tasks to see your rate</span> : prevHas && prev.rate != null ? <Delta value={(sum.rate - prev.rate) * 100} digits={0} suffix=" pts" vs={vs} /> : none}
      />
      <Tile
        label="Daily average"
        value={fmt1(avg)}
        unit="per day"
        foot={
          <>
            <span>
              {sum.activeDays}/{sum.elapsedDays} days active
            </span>
            {prevHas && <Delta value={sum.avg - prev.avg} digits={1} vs={vs} />}
          </>
        }
      />
      <Tile
        label={current ? "Current streak" : "Longest streak"}
        value={Math.round(streakN)}
        unit={streak === 1 ? "day" : "days"}
        visual={
          <span aria-hidden="true" className="flex items-center gap-[3px]">
            {recent.map((on, i) => (
              <span key={i} className={`size-[7px] rounded-full ${on ? "bg-orange" : "bg-line-2"}`} />
            ))}
            <FlameIcon size={15} className={`ml-1 ${streak > 0 ? "text-orange" : "text-ink-4"}`} />
          </span>
        }
        foot={<span>{current ? `Longest this ${period}: ${longest} ${longest === 1 ? "day" : "days"}` : "Days in a row with something done"}</span>}
      />
    </div>
  );
}
