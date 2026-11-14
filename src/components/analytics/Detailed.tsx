"use client";

import { useEffect, useState } from "react";
import { dayShort, formatShort } from "@/lib/dates";
import type { Insights } from "@/lib/insights";
import { fmt1, pct, type Period } from "@/lib/stats";
import { ChartIcon, ChevronDown } from "../icons";
import { Accordion } from "../ui";
import { PANEL } from "./parts";

const KEY = "hyperanchor:detailed";

/** One finding: what it's about, the result in a word or a number, one plain sentence, a small picture, how it's worked out. */
function Tile({ label, value, unit, line, formula, children }: { label: string; value: React.ReactNode; unit?: string; line: React.ReactNode; formula: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col rounded-[12px] bg-surface p-4 shadow-[0_0_0_1px_var(--line)] md:p-5">
      <div className="text-caption font-medium text-ink-3">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="tabular font-display text-[24px] leading-[30px] font-semibold tracking-[-0.02em] text-ink">{value}</span>
        {unit && <span className="text-footnote text-ink-3">{unit}</span>}
      </div>
      <p className="mt-1 text-footnote text-pretty text-ink-2">{line}</p>
      {children && <div className="mt-4">{children}</div>}
      {/* How it's worked out, in words: the mathematics, translated. */}
      <p className="mt-auto flex gap-1.5 pt-4 text-caption text-ink-3">
        <span aria-hidden="true" className="font-serif italic">ƒ</span>
        <span className="min-w-0">{formula}</span>
      </p>
    </div>
  );
}

/** Done so far, where the period is heading, and where the last one ended. */
function PaceBar({ soFar, projected, previous }: { soFar: number; projected: number; previous: number | null }) {
  const top = Math.max(1, projected, previous ?? 0) * 1.08;
  return (
    <div aria-hidden="true" className="relative pt-4">
      <div className="relative h-2 overflow-hidden rounded-full bg-surface-3">
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent-track" style={{ width: `${(projected / top) * 100}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${(soFar / top) * 100}%` }} />
      </div>
      {previous != null && previous > 0 && (
        <div className="absolute top-0 bottom-[-3px] flex flex-col items-center" style={{ left: `${(previous / top) * 100}%` }}>
          <span className="tabular -translate-x-1/2 text-caption-2 leading-3 whitespace-nowrap text-ink-3">{previous}</span>
          <span className="mt-0.5 w-px flex-1 -translate-x-1/2 bg-ink-2" />
        </div>
      )}
    </div>
  );
}

/** Each day's count as a thin bar, and the straight line that fits them best over it. */
function Sparkline({ series, from, to }: { series: number[]; from: number; to: number }) {
  const W = 240;
  const Hh = 44;
  const max = Math.max(1, ...series, from, to);
  const step = W / series.length;
  const y = (v: number) => Hh - 2 - (v / max) * (Hh - 6);
  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} preserveAspectRatio="none" className="block h-11 w-full" aria-hidden="true">
      {series.map((v, i) => (
        <rect key={i} x={i * step + step * 0.2} width={Math.max(1, step * 0.6)} y={y(v)} height={Hh - 2 - y(v)} rx={Math.min(1.5, step * 0.3)} fill="var(--ink-4)" />
      ))}
      <line x1={step / 2} x2={W - step / 2} y1={y(from)} y2={y(to)} stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Five steps that fill with the accent as the days get more alike. */
function Steps({ score }: { score: number }) {
  const on = Math.max(1, Math.round(score * 5));
  return (
    <div aria-hidden="true" className="flex gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`h-2 flex-1 rounded-full ${i < on ? "bg-accent" : "bg-surface-3"}`} />
      ))}
    </div>
  );
}

/** The last fortnight as dots: filled where something got done. */
function Dots({ days }: { days: boolean[] }) {
  return (
    <div aria-hidden="true" className="flex justify-between gap-1">
      {days.map((d, i) => (
        <span key={i} className={`size-2.5 rounded-full ${d ? "bg-accent" : "shadow-[inset_0_0_0_1.25px_var(--line-2)]"}`} />
      ))}
    </div>
  );
}

/**
 * Detailed analytics: everything beyond the overview, folded away until asked for (and remembered open). First a few
 * findings worked out with a little mathematics, each said plainly and with its formula in words; then the period's
 * own tables (by weekday, history), passed in as `children`.
 */
export function Detailed({
  period,
  insights,
  endsOn,
  fortnight,
  children,
}: {
  period: Period;
  insights: Insights;
  /** "Sunday", "Nov 30", "Dec 31": where the pace leads. */
  endsOn: string;
  /** The last 14 finished days, oldest first: whether each had something done. */
  fortnight: boolean[];
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      setOpen(localStorage.getItem(KEY) === "open");
    } catch {}
  }, []);
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(KEY, o ? "closed" : "open");
      } catch {}
      return !o;
    });
  };

  const { pace, rank, momentum, steadiness, typical, planning, streak, window } = insights;
  const unit = period === "year" ? "week" : "day";
  const noun = period === "day" ? "day" : period;

  return (
    <section aria-labelledby="detailed" className={`min-w-0 ${PANEL}`}>
      <button type="button" aria-expanded={open} onClick={toggle} className="group flex w-full items-center gap-4 p-5 text-left md:px-6">
        <span aria-hidden="true" className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-surface-2 text-ink shadow-ring-line">
          <ChartIcon size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span id="detailed" className="block text-body font-semibold text-ink">
            Detailed analytics
          </span>
          <span className="mt-0.5 block text-footnote text-ink-3">Pace, momentum, steadiness and the numbers behind the charts.</span>
        </span>
        <span className="flex size-8 flex-none items-center justify-center rounded-full text-ink-2 transition-colors duration-(--duration-fast) group-hover:bg-surface-2 group-hover:text-ink">
          <ChevronDown size={16} className={`transition-transform duration-(--duration-base) ease-out ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      <Accordion open={open}>
        <div className="border-t border-line bg-canvas/60 p-3 md:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pace ? (
              <Tile
                label="Pace"
                value={`≈ ${pace.projected}`}
                unit={`by ${endsOn}`}
                line={
                  <>
                    At your recent {fmt1(pace.perDay)} a day.{" "}
                    {pace.previous != null ? (pace.previous > 0 ? `Last ${noun} ended with ${pace.previous}.` : `Last ${noun} had nothing done.`) : ""}
                  </>
                }
                formula="done so far + your recent daily average × the days left"
              >
                <PaceBar soFar={pace.soFar} projected={pace.projected} previous={pace.previous} />
              </Tile>
            ) : rank ? (
              <Tile
                label="Against the days before"
                value={rank.of ? pct(rank.beat / rank.of) : "—"}
                line={rank.of ? `More done than on ${rank.beat} of the ${rank.of} days before it.` : "No days before it to compare with yet."}
                formula="the share of the 28 days before with fewer tasks done"
              />
            ) : (
              <Tile
                label="Best day"
                value={typical?.best ? typical.best.done : "—"}
                unit={typical?.best ? `on ${formatShort(typical.best.date)}` : undefined}
                line={typical?.best ? `The most you finished on one day this ${noun}.` : `Nothing was done this ${noun}.`}
                formula="the day with the most tasks done"
              />
            )}

            <Tile
              label="Momentum"
              value={momentum ? momentum.label : "—"}
              line={
                momentum
                  ? `From about ${fmt1(momentum.from)} to ${fmt1(momentum.to)} a ${momentum.unit}, across ${window}.`
                  : "Needs a week of finished days to draw a line through."
              }
              formula={`the straight line that fits each ${unit}'s count best (least squares)`}
            >
              {momentum && <Sparkline series={momentum.series} from={momentum.from} to={momentum.to} />}
            </Tile>

            <Tile
              label="Steadiness"
              value={steadiness ? steadiness.label : "—"}
              line={
                steadiness
                  ? steadiness.low === steadiness.high
                    ? `Most days you finish about ${steadiness.low}.`
                    : `Most days you finish between ${steadiness.low} and ${steadiness.high}.`
                  : "Needs a week of finished days with something done."
              }
              formula="1 ÷ (1 + spread ÷ average) of tasks done per day; most days = the middle half"
            >
              {steadiness && <Steps score={steadiness.score} />}
            </Tile>

            <Tile
              label="A typical day"
              value={typical ? fmt1(typical.median) : "—"}
              unit="done"
              line={
                typical
                  ? `Half of your planned days end with more, half with less.${typical.best && pace ? ` Best this ${noun}: ${dayShort(typical.best.date)}, ${formatShort(typical.best.date)}, with ${typical.best.done}.` : ""}`
                  : "Nothing planned yet."
              }
              formula={`the median of days with something planned, across ${window}`}
            />

            <Tile
              label="Plan against done"
              value={planning ? `${fmt1(planning.ratio)}×` : "—"}
              line={
                planning
                  ? planning.ratio <= 1.15
                    ? "Your plans match what you finish. Keep them this size."
                    : `You plan about ${fmt1(planning.ratio)} tasks for each one you finish. A realistic day for you: ${planning.realistic}.`
                  : "Needs five days with something planned."
              }
              formula="tasks planned ÷ tasks done; a realistic day is what three days in four reach (75th percentile)"
            >
              {planning && (
                <div aria-hidden="true" className="space-y-1.5">
                  <div className="flex items-center gap-2 text-caption-2 text-ink-3">
                    <span className="w-12">Planned</span>
                    <span className="h-2 flex-1 rounded-full bg-accent-track" />
                  </div>
                  <div className="flex items-center gap-2 text-caption-2 text-ink-3">
                    <span className="w-12">Done</span>
                    <span className="flex h-2 flex-1">
                      <span className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, 100 / planning.ratio)}%` }} />
                    </span>
                  </div>
                </div>
              )}
            </Tile>

            <Tile
              label="In a row"
              value={streak.current}
              unit={streak.current === 1 ? "day" : "days"}
              line={`With something done${streak.current ? ", up to today" : ""}. The longest run here: ${streak.longest} ${streak.longest === 1 ? "day" : "days"}.`}
              formula="consecutive days with at least one task done"
            >
              <Dots days={fortnight} />
            </Tile>
          </div>
          {children && <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12">{children}</div>}
        </div>
      </Accordion>
    </section>
  );
}
