"use client";

import { useEffect, useRef, useState } from "react";
import { fmt1, pct, type Period, type Summary } from "@/lib/stats";

/** A section of the page: a heading over a hairline, like "To do" in Day, and no box around it. */
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
    <section className={`min-w-0 pt-5 ${className}`}>
      <header className="mb-4 flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line pb-2">
        <h2 className="text-footnote font-semibold text-ink">
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

/**
 * One figure: what it is, the number, and one line of context. Phones read them as rows (number on the right); wider
 * screens set them side by side between hairlines.
 */
function Figure({ label, value, unit, foot, tip }: { label: string; value: React.ReactNode; unit?: string; foot?: React.ReactNode; tip?: string }) {
  return (
    <div data-tip={tip} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-4 py-3 sm:grid-cols-1 sm:px-5 sm:py-1 sm:first:pl-0 sm:last:pr-0">
      <div className="col-start-1 row-start-1 text-caption text-ink-3">{label}</div>
      <div className="col-start-2 row-span-2 row-start-1 flex items-baseline gap-1.5 self-center sm:col-start-1 sm:row-span-1 sm:row-start-2 sm:mt-1">
        <span className="tabular font-display text-title font-semibold">{value}</span>
        {unit && <span className="text-footnote text-ink-3">{unit}</span>}
      </div>
      <div className="col-start-1 row-start-2 mt-0.5 min-h-4 text-caption text-ink-3 sm:row-start-3 sm:mt-1">{foot}</div>
    </div>
  );
}

export function Kpis({
  sum,
  settled,
  prevSettled,
  throughYesterday,
  period,
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
  /** Days with something done in the year so far, e.g. "67 this year" (a count that never resets). */
  yearNote?: string;
}) {
  const vs = `vs last ${period}`;
  const prevHas = prevSettled.planned > 0;
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
    <div className="grid grid-cols-1 max-sm:divide-y max-sm:divide-line sm:grid-cols-3 sm:divide-x sm:divide-line">
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
