"use client";

import { useEffect, useState } from "react";
import { dayShort, formatMedium, formatShort, weekdayNames } from "@/lib/dates";
import type { Insights, Point } from "@/lib/insights";
import { fmt1, pct, type DayStat, type Period } from "@/lib/stats";
import { ChartIcon, ChevronDown } from "../icons";
import { Accordion } from "../ui";
import { BurnChart, PlanChart, SpreadChart, TrendChart, WeekdayChart } from "./charts";
import { PANEL } from "./parts";

const KEY = "hyperanchor:detailed";

/**
 * One finding with its chart: what it's about, the result in a word or a number, one plain sentence, the picture, and
 * how it's worked out (the mathematics, in words).
 */
function Frame({
  label,
  value,
  unit,
  line,
  formula,
  legend,
  className = "",
  children,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  line: React.ReactNode;
  formula: string;
  legend?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={`flex min-w-0 flex-col rounded-[14px] bg-surface p-5 shadow-[0_0_0_1px_var(--line)] ${className}`}>
      {/* The finding keeps its line; a legend that doesn't fit beside it goes under it. */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="max-w-full flex-none">
          <h3 className="text-caption font-medium text-ink-3">{label}</h3>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5">
            <span className="tabular font-display text-[26px] leading-[32px] font-semibold tracking-[-0.022em] whitespace-nowrap text-ink">{value}</span>
            {unit && <span className="text-footnote whitespace-nowrap text-ink-3">{unit}</span>}
          </div>
        </div>
        {legend && <div className="flex min-w-0 flex-wrap items-center gap-x-3.5 gap-y-1 pt-0.5 text-caption text-ink-2">{legend}</div>}
      </div>
      <p className="mt-1 max-w-[62ch] text-footnote text-pretty text-ink-2">{line}</p>
      {children && <div className="mt-5">{children}</div>}
      <p className="mt-auto flex gap-1.5 pt-4 text-caption text-ink-3">
        <span aria-hidden="true" className="font-serif italic">
          ƒ
        </span>
        <span className="min-w-0 text-pretty">{formula}</span>
      </p>
    </section>
  );
}

/** A mark of a chart's legend: a solid line, a dashed one, or a quiet one. */
const Key = ({ kind, children }: { kind: "solid" | "dashed" | "quiet" | "bar"; children: React.ReactNode }) => (
  <span className="flex items-center gap-1.5 whitespace-nowrap">
    {kind === "bar" ? (
      <span className="h-2.5 w-1.5 rounded-[2px] bg-ink-4" />
    ) : (
      <span className={`w-3.5 border-t-2 ${kind === "solid" ? "border-accent" : kind === "dashed" ? "border-dotted border-ink-2" : "border-ink-4"}`} />
    )}
    {children}
  </span>
);

/** A figure of the strip under the charts. */
function Fact({ label, value, unit, children }: { label: string; value: React.ReactNode; unit?: string; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 bg-surface px-5 py-4">
      <dt className="text-caption text-ink-3">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
        <span className="tabular font-display text-[22px] leading-7 font-semibold tracking-[-0.02em] whitespace-nowrap text-ink">{value}</span>
        {unit && <span className="text-caption text-ink-3">{unit}</span>}
      </dd>
      {children && <dd className="mt-2">{children}</dd>}
    </div>
  );
}

/**
 * Detailed analytics: everything beyond the overview, folded away until asked for (and remembered open). The period
 * adding up against the one before, with where it is heading; momentum; how the days spread; the weekdays; what gets
 * planned against what gets done; a strip of figures; then the history (passed in as `children`).
 */
export function Detailed({
  period,
  insights,
  days,
  endsOn,
  fortnight,
  children,
}: {
  period: Period;
  insights: Insights;
  /** The period's days (the pace is told day by day). */
  days: DayStat[];
  /** "Sunday", "Nov 30", "Dec 31": where the pace leads. */
  endsOn: string;
  /** The last 14 days, oldest first: whether each had something done. */
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

  const { burn, rank, momentum, spread, weekdays, plan, typical, streak, window } = insights;
  const noun = period;
  const names = weekdayNames("short");
  const full = weekdayNames("full");
  const bestDay = weekdays.reduce((b, d) => (d.avg > b.avg ? d : b), weekdays[0]);
  const pointLabel = (p: Point) => (period === "year" ? `Week of ${formatShort(p.date)}` : formatMedium(p.date));
  const need = "Needs a week of finished days to draw.";

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
          <span className="mt-0.5 block text-footnote text-ink-3">Pace, momentum, how your days spread, and the numbers behind the charts.</span>
        </span>
        <span className="flex size-8 flex-none items-center justify-center rounded-full text-ink-2 transition-colors duration-(--duration-fast) group-hover:bg-surface-2 group-hover:text-ink">
          <ChevronDown size={16} className={`transition-transform duration-(--duration-base) ease-out ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      <Accordion open={open}>
        <div className="grid grid-cols-1 gap-3 border-t border-line bg-surface-2 p-3 md:gap-4 md:p-5 @4xl/analytics:grid-cols-12">
          {burn ? (
            <Frame
              className="@4xl/analytics:col-span-7"
              label="Pace"
              value={burn.projected != null ? `≈ ${burn.projected}` : (burn.now[burn.now.length - 1] ?? 0)}
              unit={burn.projected != null ? `by ${endsOn}` : "done in all"}
              line={
                burn.projected != null ? (
                  <>
                    Where this {noun} is heading at your recent {fmt1(burn.perDay)} a day.{" "}
                    {burn.previous != null ? (burn.previous > 0 ? `Last ${noun} ended with ${burn.previous}.` : `Last ${noun} had nothing done.`) : ""}
                  </>
                ) : burn.previous != null ? (
                  `The ${noun} before ended with ${burn.previous}.`
                ) : (
                  `How the ${noun} added up, day by day.`
                )
              }
              legend={
                <>
                  <Key kind="solid">This {noun}</Key>
                  {burn.before && <Key kind="quiet">Last {noun}</Key>}
                  {burn.ahead && <Key kind="dashed">At your pace</Key>}
                </>
              }
              formula="done so far + your recent daily average × the days left; the cone is how far such a stretch usually strays (σ·√days)"
            >
              <BurnChart burn={burn} dayLabel={(i) => (days[i] ? (period === "year" ? formatShort(days[i].date) : formatMedium(days[i].date)) : "")} vs={`at this point last ${noun}`} />
            </Frame>
          ) : (
            <Frame
              className="@4xl/analytics:col-span-5 @4xl/analytics:order-2"
              label="Among the days before"
              value={rank && rank.of ? pct(rank.beat / rank.of) : "—"}
              unit={rank && rank.of ? "of them beaten" : undefined}
              line={rank && rank.of ? `More done than on ${rank.beat} of the ${rank.of} days before it. A typical one of them: ${fmt1(rank.typical)}.` : "No days before it to compare with yet."}
              formula="the share of the 28 days before with fewer tasks done; below, how those days spread"
            >
              {spread && <SpreadChart spread={spread} />}
            </Frame>
          )}

          <Frame
            className={burn ? "@4xl/analytics:col-span-5" : "@4xl/analytics:col-span-7 @4xl/analytics:order-1"}
            label="Momentum"
            value={momentum ? momentum.label : "—"}
            line={momentum ? `From about ${fmt1(momentum.from)} to ${fmt1(momentum.to)} a ${momentum.unit}, across ${window}.` : need}
            legend={
              momentum && (
                <>
                  <Key kind="solid">{period === "year" ? "4-week average" : "7-day average"}</Key>
                  <Key kind="dashed">Trend</Key>
                </>
              )
            }
            formula={`the straight line that fits each ${momentum?.unit ?? "day"}'s count best (least squares); the curve is the average of the last ${period === "year" ? "four weeks" : "seven days"}`}
          >
            {momentum && <TrendChart momentum={momentum} dayLabel={pointLabel} />}
          </Frame>

          {burn && (
            <Frame
              className="@4xl/analytics:col-span-4"
              label="How your days spread"
              value={spread ? spread.label : "—"}
              line={
                spread
                  ? `${spread.low === spread.high ? `Most days you finish about ${spread.low}` : `Most days you finish between ${spread.low} and ${spread.high}`}; the median is ${fmt1(spread.median)}.`
                  : need
              }
              formula="steadiness = 1 ÷ (1 + spread ÷ average); the bracket is the middle half of your days, the dot their median"
            >
              {spread && <SpreadChart spread={spread} />}
            </Frame>
          )}

          <Frame
            className={burn ? "@4xl/analytics:col-span-4" : "@4xl/analytics:order-3 @4xl/analytics:col-span-6"}
            label="By weekday"
            value={bestDay.avg > 0 ? `${full[bestDay.index]}s` : "—"}
            unit={bestDay.avg > 0 ? "carry the most" : undefined}
            line={bestDay.avg > 0 ? `About ${fmt1(bestDay.avg)} done on a ${full[bestDay.index]}; under each day, the share of what was planned.` : "Not enough done yet to compare."}
            formula={`tasks done ÷ the number of such weekdays, across ${window}`}
          >
            <WeekdayChart weekdays={weekdays} names={names} />
          </Frame>

          <Frame
            className={burn ? "@4xl/analytics:col-span-4" : "@4xl/analytics:order-4 @4xl/analytics:col-span-6"}
            label="Plan against done"
            value={plan ? pct(Math.min(1, plan.share)) : "—"}
            unit={plan ? "of a plan gets done" : undefined}
            line={
              plan
                ? plan.ratio <= 1.15
                  ? "Your plans match what you finish. Keep them this size."
                  : `You plan about ${fmt1(plan.ratio)} tasks for each one you finish. A realistic day for you: ${plan.realistic}.`
                : "Needs five days with something planned."
            }
            formula="a line through the days (least squares, from zero); dashed: everything planned gets done; a realistic day is what three days in four reach"
          >
            {plan && <PlanChart plan={plan} />}
          </Frame>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] bg-line shadow-[0_0_0_1px_var(--line)] @3xl/analytics:grid-cols-4 @4xl/analytics:order-5 @4xl/analytics:col-span-12">
            <Fact label="A typical day" value={typical ? fmt1(typical.median) : "—"} unit="done (median)" />
            <Fact label="In a row" value={streak.current} unit={streak.current === 1 ? "day with something done" : "days with something done"}>
              <div aria-hidden="true" className="flex max-w-[180px] justify-between gap-1">
                {fortnight.map((d, i) => (
                  <span key={i} className={`size-2 rounded-full ${d ? "bg-accent" : "shadow-[inset_0_0_0_1.25px_var(--line-2)]"}`} />
                ))}
              </div>
            </Fact>
            <Fact label="Longest run" value={streak.longest} unit={streak.longest === 1 ? "day" : "days"} />
            <Fact label="Best day" value={typical?.best ? typical.best.done : "—"} unit={typical?.best ? `${dayShort(typical.best.date)}, ${formatShort(typical.best.date)}` : undefined} />
          </dl>
          {children && <div className="@4xl/analytics:order-6 @4xl/analytics:col-span-12">{children}</div>}
        </div>
      </Accordion>
    </section>
  );
}
