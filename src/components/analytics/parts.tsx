"use client";

import { useEffect, useRef, useState } from "react";
import { fmt1, pct, type Period, type Summary } from "@/lib/stats";

/** The panels' own look: white sheets with a hairline edge on the page's grey (dark: a step up from the background). */
export const PANEL = "rounded-[14px] bg-surface shadow-[0_0_0_1px_var(--line)]";

/** A section of the page: a panel, its title (and a quiet aside) on top. */
export function Card({
  title,
  count,
  aside,
  className = "",
  children,
}: {
  title: string;
  /** Shown beside the title, quietly, like the count after "To do". */
  count?: number;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`min-w-0 p-5 md:p-6 ${PANEL} ${className}`}>
      <header className="mb-5 flex min-h-6 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="text-body font-semibold text-ink">
          {title}
          {!!count && <span className="tabular ml-1.5 font-normal text-ink-3">{count}</span>}
        </h2>
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

/** Signed change vs the previous period: arrow + number, tinted by direction (up is good for every measure here). */
function Delta({ value, digits, suffix = "", vs }: { value: number; digits: number; suffix?: string; vs: string }) {
  const r = Number(value.toFixed(digits));
  const tone = r > 0 ? "text-green-ink" : r < 0 ? "text-red-ink" : "text-ink-2";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`tabular inline-flex items-center gap-0.5 text-caption font-semibold ${tone}`}>
        {r > 0 ? "▲" : r < 0 ? "▼" : "="} {r === 0 ? "0" : Math.abs(r).toFixed(digits).replace(/\.0$/, "")}
        {r !== 0 && suffix}
      </span>
      <span>{vs}</span>
    </span>
  );
}

/** One figure, as a tile of its own: what it is, the number, and one line of context. */
function Figure({ label, value, unit, foot, tip }: { label: string; value: React.ReactNode; unit?: string; foot?: React.ReactNode; tip?: string }) {
  return (
    <div data-tip={tip} className={`flex min-w-0 flex-col p-4 md:p-5 ${PANEL}`}>
      <div className="min-h-8 text-footnote text-ink-3 sm:min-h-0">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="tabular font-display text-[28px] leading-[34px] font-semibold tracking-[-0.02em]">{value}</span>
        {unit && <span className="text-footnote text-ink-3">{unit}</span>}
      </div>
      <div className="mt-1 min-h-4 text-caption text-ink-3">{foot}</div>
    </div>
  );
}

export function Kpis({
  sum,
  settled,
  prevSettled,
  throughYesterday,
  period,
  current,
  yearNote,
}: {
  sum: Summary;
  /** The period without today: a day still in progress isn't a result yet. */
  settled: Summary;
  /** The same stretch of the previous period. */
  prevSettled: Summary;
  /** Today falls in this period, so rates and averages stop at yesterday. */
  throughYesterday: boolean;
  period: Period;
  /** The period is the one running now. */
  current: boolean;
  /** Days with something done in the year so far, e.g. "67 this year" (a count that never resets). */
  yearNote?: string;
}) {
  const vs = `vs last ${period}`;
  const prevHas = prevSettled.planned > 0;
  const doneCount = useCountUp(sum.completed);
  const rate = useCountUp(settled.rate ?? 0);
  const avg = useCountUp(settled.avg);
  const active = useCountUp(sum.activeDays);
  // Today joins the count once something in it is done; until then it isn't held against anyone.
  const activeOf = settled.elapsedDays + (sum.activeDays - settled.activeDays);
  const suffix = throughYesterday ? ", through yesterday" : "";
  const none = `No last ${period} to compare with`;
  // The first day of a period has nothing finished to count yet.
  const waiting = throughYesterday && !settled.elapsedDays ? "Counts finished days only" : null;

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      <Figure
        label={current ? "Done so far" : "Done"}
        value={Math.round(doneCount)}
        unit={`of ${sum.planned}`}
        foot={sum.upcoming > 0 ? `${sum.upcoming} more planned this ${period}` : sum.planned ? `${sum.planned - sum.completed} left open` : "Nothing planned"}
      />
      <Figure
        label={`Completion${suffix}`}
        value={settled.rate == null ? "—" : pct(rate)}
        foot={
          waiting ??
          (settled.rate == null ? (
            "Nothing planned yet"
          ) : prevHas && prevSettled.rate != null ? (
            <Delta value={(settled.rate - prevSettled.rate) * 100} digits={0} suffix=" pts" vs={vs} />
          ) : (
            none
          ))
        }
      />
      <Figure
        label={`Per day${suffix}`}
        value={settled.elapsedDays ? fmt1(avg) : "—"}
        foot={waiting ?? (prevHas ? <Delta value={settled.avg - prevSettled.avg} digits={1} vs={vs} /> : none)}
      />
      <Figure
        label="Days with something done"
        tip="A count that only grows: a day without anything done takes nothing away."
        value={Math.round(active)}
        unit={`of ${activeOf}`}
        foot={yearNote}
      />
    </div>
  );
}
