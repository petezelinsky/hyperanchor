"use client";

import { useEffect, useRef, useState } from "react";
import type { Insights } from "@/lib/insights";
import { fmt1, pct, type Period, type Summary } from "@/lib/stats";
import { PANEL } from "./parts";

/** Animates a number from its previous value to the new one. */
export function useCountUp(value: number, duration = 450) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(a + (value - a) * (1 - Math.pow(1 - t, 3)));
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

/** A change against the period before, in words: green only for a rise, red only for a drop. */
function Change({ value, digits, unit, vs }: { value: number; digits: number; unit: string; vs: string }) {
  const r = Number(value.toFixed(digits));
  if (r === 0) return <span className="text-ink-2">Level with {vs}</span>;
  const up = r > 0;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`tabular inline-flex items-center gap-1 font-semibold ${up ? "text-green-ink" : "text-red-ink"}`}>
        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true" className={up ? "" : "rotate-180"}>
          <path d="M5 1.5 9 8.5H1Z" fill="currentColor" />
        </svg>
        {Math.abs(r).toFixed(digits).replace(/\.0$/, "")}
        {unit}
      </span>
      <span className="text-ink-2">
        {up ? "better than" : "below"} {vs}
      </span>
    </span>
  );
}

/** The share done, as a ring that fills with the accent, the number in its middle. */
function Ring({ value, size = 84 }: { value: number | null; size?: number }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value ?? 0));
  const shown = useCountUp(v * 100, 700);
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent-track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ opacity: v > 0 ? 1 : 0 }}
          className="transition-[stroke-dashoffset] duration-(--duration-data) ease-out"
        />
      </svg>
      <span className="tabular absolute inset-0 flex items-center justify-center font-display text-[19px] font-semibold tracking-[-0.02em] text-ink">
        {value == null ? "—" : `${Math.round(shown)}%`}
      </span>
    </div>
  );
}

function Stat({ label, value, foot, tip }: { label: string; value: React.ReactNode; foot?: React.ReactNode; tip?: string }) {
  return (
    <div data-tip={tip} className="min-w-0 px-4 first:pl-0 last:pr-0 max-md:py-1">
      <dt className="truncate text-caption text-ink-3">{label}</dt>
      <dd className="tabular mt-1 font-display text-[22px] leading-7 font-semibold tracking-[-0.02em] text-ink">{value}</dd>
      {foot && <dd className="mt-0.5 truncate text-caption text-ink-3">{foot}</dd>}
    </div>
  );
}

/**
 * The period at a glance, in one panel: how much of it is done (a ring), the count in words with how it compares, and
 * three numbers. Everything finer is in Detailed analytics.
 */
export function Overview({
  period,
  eyebrow,
  running = false,
  sum,
  settled,
  prevSettled,
  throughYesterday,
  open,
  insights,
}: {
  period: Period;
  /** "This week so far", "Last month", "Today", … */
  eyebrow: string;
  /** Today, still running: it is measured against a typical day as something still within reach, not as a result. */
  running?: boolean;
  sum: Summary;
  /** Without today (a day still running isn't a result yet). */
  settled: Summary;
  /** The same stretch of the period before. */
  prevSettled: Summary;
  throughYesterday: boolean;
  /** Tasks still open on days gone by. */
  open: number;
  insights: Insights;
}) {
  const done = useCountUp(sum.completed);
  const vs = period === "day" ? "the day before" : `last ${period}`;
  const comparable = settled.rate != null && prevSettled.rate != null && prevSettled.planned > 0;
  const day = period === "day";
  const typical = insights.rank?.typical ?? 0;
  // Today joins the count once something in it is done; until then it isn't held against anyone.
  const activeOf = settled.elapsedDays + (sum.activeDays - settled.activeDays);

  const gap = typical - sum.completed;
  const compare = day && running ? (
    insights.rank && insights.rank.of > 0 ? (
      gap > 0 ? (
        <span className="text-ink-2">
          <span className="tabular font-semibold text-ink">{fmt1(gap)}</span> more and it’s a typical day for you
        </span>
      ) : (
        <span className="text-ink-2">Already a typical day’s worth, and more</span>
      )
    ) : (
      <span className="text-ink-3">Nothing before it to compare with yet</span>
    )
  ) : day ? (
    insights.rank && insights.rank.of > 0 ? (
      <span className="text-ink-2">
        More than on <span className="tabular font-semibold text-ink">{pct(insights.rank.beat / insights.rank.of)}</span> of the 4 weeks before
      </span>
    ) : (
      <span className="text-ink-3">Nothing before it to compare with yet</span>
    )
  ) : throughYesterday && !settled.elapsedDays ? (
    <span className="text-ink-3">Compared from tomorrow, once a day has finished</span>
  ) : comparable ? (
    <span data-tip={throughYesterday ? `Days that have finished, against the same days of ${vs}` : undefined}>
      <Change value={(settled.rate! - prevSettled.rate!) * 100} digits={0} unit=" pts" vs={vs} />
    </span>
  ) : (
    <span className="text-ink-3">Nothing from {vs} to compare with</span>
  );

  return (
    <section aria-label="Overview" className={`flex flex-col gap-5 p-5 md:flex-row md:items-center md:gap-8 md:p-6 ${PANEL}`}>
      <div className="flex min-w-0 flex-1 items-center gap-5">
        <Ring value={sum.rate} />
        <div className="min-w-0">
          <p className="text-caption font-medium text-ink-3">{eyebrow}</p>
          <p className="mt-0.5 font-display text-[28px] leading-[34px] font-semibold tracking-[-0.02em] text-ink">
            <span className="tabular">{Math.round(done)}</span>
            <span className="text-[20px] font-medium text-ink-3"> of {sum.planned} done</span>
          </p>
          <p className="mt-1 text-footnote">{compare}</p>
        </div>
      </div>
      <dl className="grid flex-none grid-cols-3 divide-x divide-line border-line max-md:border-t max-md:pt-4 md:min-w-[360px]">
        {day ? (
          <>
            <Stat label="A typical day" value={fmt1(typical)} foot="done, the 4 weeks before" tip="The median: half of the days before it ended with more done, half with less." />
            {running && gap > 0 ? (
              <Stat label="To get there" value={fmt1(gap)} foot="more to finish today" />
            ) : (
              <Stat label="Against it" value={`${gap <= 0 ? "+" : "−"}${fmt1(Math.abs(gap))}`} foot={gap <= 0 ? "above typical" : "below typical"} />
            )}
            <Stat label="In a row" value={insights.streak.current} foot={insights.streak.current === 1 ? "day with something done" : "days with something done"} />
          </>
        ) : (
          <>
            <Stat
              label="Per day"
              value={settled.elapsedDays ? fmt1(settled.avg) : "—"}
              foot={throughYesterday ? "through yesterday" : "on average"}
              tip="Tasks done per finished day of the period."
            />
            <Stat label="Active days" value={`${sum.activeDays}`} foot={`of ${activeOf} with something done`} />
            <Stat label="Left open" value={open} foot={sum.upcoming ? `${sum.upcoming} more planned ahead` : "on days gone by"} />
          </>
        )}
      </dl>
    </section>
  );
}
