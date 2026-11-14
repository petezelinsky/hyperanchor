"use client";

import type { Insights } from "@/lib/insights";
import { fmt1, pct, type Period, type Summary } from "@/lib/stats";
import { PANEL } from "./parts";

/** A change against the period before, in words: green only for a rise, red only for a drop. */
function Change({ value, digits, unit, vs }: { value: number; digits: number; unit: string; vs: string }) {
  const r = Number(value.toFixed(digits));
  if (r === 0) return <span className="text-ink-2">Level with {vs}</span>;
  const up = r > 0;
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-x-1.5">
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

/** The most tasks shown one pill each; beyond it the track is drawn as three lengths. */
const PILLS = 60;

/**
 * The period's tasks as one line: done, left open, and still ahead. Up to sixty, every task is a pill of its own (so a
 * week reads as the handful of things it is); more than that, three lengths in the same order.
 */
function Track({ done, open, ahead }: { done: number; open: number; ahead: number }) {
  const total = done + open + ahead;
  if (!total) return <div aria-hidden="true" className="h-2.5 rounded-full bg-surface-3" />;
  if (total <= PILLS)
    return (
      <div aria-hidden="true" className="flex gap-[3px]">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            style={{ animationDelay: `${Math.min(i, 40) * 14}ms` }}
            className={`h-2.5 min-w-0 flex-1 animate-[fade_var(--duration-base)_var(--ease-out)_both] rounded-full ${
              i < done ? "bg-accent" : i < done + open ? "bg-accent-track" : "shadow-[inset_0_0_0_1.25px_var(--line-2)]"
            }`}
          />
        ))}
      </div>
    );
  return (
    <div aria-hidden="true" className="flex h-2.5 gap-[3px]">
      {done > 0 && <span className="rounded-full bg-accent" style={{ flex: done }} />}
      {open > 0 && <span className="rounded-full bg-accent-track" style={{ flex: open }} />}
      {ahead > 0 && <span className="rounded-full shadow-[inset_0_0_0_1.25px_var(--line-2)]" style={{ flex: ahead }} />}
    </div>
  );
}

/** What a mark of the track stands for, with its count. */
const Mark = ({ kind, n, children }: { kind: "done" | "open" | "ahead"; n: number; children: React.ReactNode }) => (
  <span className="flex items-center gap-1.5 whitespace-nowrap">
    <span className={`h-2 w-3 rounded-full ${kind === "done" ? "bg-accent" : kind === "open" ? "bg-accent-track" : "shadow-[inset_0_0_0_1.25px_var(--line-2)]"}`} />
    <span className="text-ink-2">{children}</span>
    <span className="tabular font-medium text-ink">{n}</span>
  </span>
);

/** Small bars, one per day (or month): the shape of the period at a glance. */
function Bars({ values }: { values: number[] }) {
  const top = Math.max(1, ...values);
  return (
    <div aria-hidden="true" className="flex h-8 items-end gap-[3px]">
      {values.map((v, i) => (
        <span key={i} className={`rounded-[1.5px] ${values.length > 14 ? "w-[3px]" : "w-[5px]"} ${v ? "bg-ink-3" : "bg-line-2"}`} style={{ height: `${v ? Math.max(14, (v / top) * 100) : 9}%` }} />
      ))}
    </div>
  );
}

/** Days as dots: filled where something got done. */
function Dots({ days }: { days: boolean[] }) {
  return (
    <div aria-hidden="true" className="flex max-w-[132px] flex-wrap justify-end gap-[3px]">
      {days.map((d, i) => (
        <span key={i} className={`size-[7px] rounded-full ${d ? "bg-ink-3" : "shadow-[inset_0_0_0_1.25px_var(--line-2)]"}`} />
      ))}
    </div>
  );
}

function Stat({ label, value, foot, tip, children }: { label: string; value: React.ReactNode; foot?: React.ReactNode; tip?: string; children?: React.ReactNode }) {
  return (
    <div
      data-tip={tip}
      className="flex min-w-0 items-end justify-between gap-3 py-3 @xl/analytics:px-5 @xl/analytics:pt-4 @xl/analytics:pb-0 @xl/analytics:first:pl-0 @xl/analytics:last:pr-0"
    >
      {/* Narrow: a line each, the name on the left and the figure on the right. Wider: three columns, figure under name. */}
      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 @xl/analytics:block">
        <dt className="text-caption text-ink-3 @max-xl/analytics:text-footnote @max-xl/analytics:text-ink-2">{label}</dt>
        <dd className="tabular row-span-2 font-display text-[22px] leading-7 font-semibold tracking-[-0.02em] text-ink @xl/analytics:mt-1">{value}</dd>
        {foot && <dd className="text-caption text-pretty text-ink-3 @xl/analytics:mt-0.5">{foot}</dd>}
      </div>
      {children && <div className="flex-none pb-1 @max-4xl/analytics:hidden">{children}</div>}
    </div>
  );
}

/**
 * The period at a glance, in one panel: the count in large figures with the share and how it compares, the period's
 * tasks as one line (done, left open, ahead), and three numbers with a small picture each. Everything finer is in
 * Detailed analytics.
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
  series,
  active,
  fortnight,
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
  /** Tasks still open on days gone by (a day: its own). */
  open: number;
  /** Done per day of the period so far (a year: per month). */
  series: number[];
  /** Each finished day of the period: whether something got done (not for a year). */
  active: boolean[];
  /** The last 14 days: whether each had something done. */
  fortnight: boolean[];
  insights: Insights;
}) {
  const vs = period === "day" ? "the day before" : `last ${period}`;
  const comparable = settled.rate != null && prevSettled.rate != null && prevSettled.planned > 0;
  const day = period === "day";
  const typical = insights.rank?.typical ?? 0;
  // Today joins the count once something in it is done; until then it isn't held against anyone.
  const activeOf = settled.elapsedDays + (sum.activeDays - settled.activeDays);
  const gap = typical - sum.completed;
  // The line of tasks: done; left open on days gone by (a day: its own open ones); and what is still ahead, today's
  // remaining tasks included.
  const left = open;
  const ahead = day ? 0 : sum.upcoming + Math.max(0, sum.planned - sum.completed - open);

  const compare = day ? (
    !(insights.rank && insights.rank.of > 0) ? (
      <span className="text-ink-3">Nothing before it to compare with yet</span>
    ) : running ? (
      gap > 0 ? (
        <span className="text-ink-2">
          <span className="tabular font-semibold text-ink">{fmt1(gap)}</span> more and it’s a typical day for you
        </span>
      ) : (
        <span className="text-ink-2">Already a typical day’s worth, and more</span>
      )
    ) : (
      <span className="text-ink-2">
        More than on <span className="tabular font-semibold text-ink">{pct(insights.rank.beat / insights.rank.of)}</span> of the 4 weeks before
      </span>
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
    <section aria-label="Overview" className={`p-5 md:p-6 ${PANEL}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <div className="min-w-0">
          <p className="text-caption font-medium text-ink-3">{eyebrow}</p>
          <p className="mt-1 flex items-baseline gap-2.5">
            <span className="tabular font-display text-[44px] leading-[46px] font-semibold tracking-[-0.035em] text-ink">{sum.completed}</span>
            <span className="text-[17px] leading-6 text-ink-3">of {sum.planned} done</span>
          </p>
        </div>
        <div className="min-w-0 @xl/analytics:text-right">
          <p className="tabular font-display text-[22px] leading-7 font-semibold tracking-[-0.02em] text-ink">{sum.rate == null ? "—" : pct(sum.rate)}</p>
          <p className="mt-0.5 text-footnote">{compare}</p>
        </div>
      </div>

      <div className="mt-5">
        <Track done={sum.completed} open={left} ahead={ahead} />
        <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-caption">
          <Mark kind="done" n={sum.completed}>
            Done
          </Mark>
          <Mark kind="open" n={left}>
            {day && running ? "Still open" : "Left open"}
          </Mark>
          {ahead > 0 && (
            <Mark kind="ahead" n={ahead}>
              Still ahead
            </Mark>
          )}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-1 divide-line border-t border-line @max-xl/analytics:divide-y @xl/analytics:grid-cols-3 @xl/analytics:divide-x">
        {day ? (
          <>
            <Stat label="A typical day" value={fmt1(typical)} foot="done, the 4 weeks before" tip="The median: half of the days before it ended with more done, half with less." />
            {running && gap > 0 ? (
              <Stat label="To get there" value={fmt1(gap)} foot="more to finish today" />
            ) : (
              <Stat label="Against it" value={`${gap <= 0 ? "+" : "−"}${fmt1(Math.abs(gap))}`} foot={gap <= 0 ? "above typical" : "below typical"} />
            )}
            <Stat label="In a row" value={insights.streak.current} foot={insights.streak.current === 1 ? "day with something done" : "days with something done"}>
              <Dots days={fortnight} />
            </Stat>
          </>
        ) : (
          <>
            <Stat
              label="Per day"
              value={settled.elapsedDays ? fmt1(settled.avg) : "—"}
              foot={throughYesterday ? "through yesterday" : "on average"}
              tip="Tasks done per finished day of the period."
            >
              <Bars values={series} />
            </Stat>
            <Stat label="Active days" value={sum.activeDays} foot={`of ${activeOf} with something done`}>
              {period !== "year" && <Dots days={active} />}
            </Stat>
            <Stat label="Left open" value={open} foot="on days gone by" />
          </>
        )}
      </dl>
    </section>
  );
}
