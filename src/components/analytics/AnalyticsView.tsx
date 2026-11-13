"use client";

import { useMemo } from "react";
import { addDays, dayShort, formatLong, formatMedium, formatShort, MONTHS, MONTHS_SHORT, parseYmd, relativeDay, weekdayNames, ymd } from "@/lib/dates";
import { dayStats, monthStats, periodBounds, summarize, weekdayStats, type DayStat, type Period } from "@/lib/stats";
import type { SummaryInput } from "@/lib/summary";
import type { Task } from "@/lib/types";
import { shortRange } from "../WeekView";
import { AiSummary } from "./AiSummary";
import { BarChart, type Bar } from "./BarChart";
import { OpenCard, WeekdayCard } from "./Breakdown";
import { Heatmap } from "./Heatmap";
import { HistoryCard, type HistoryRow } from "./History";
import { Card, Kpis, PANEL } from "./parts";

const NOW: Record<Period, string> = { week: "This week", month: "This month", year: "This year" };

/**
 * Progress: the period on screen (a week, a month, a year) in panels across the whole work area. The AI summary on top
 * (where the server has the AI); then the four figures; the days (or months) as bars, with the weekdays (or what's left
 * open) beside them; the year's activity; what's left open and the history of every day. The page's name, its dates,
 * the period switch and the arrows are in the bar above.
 */
export function AnalyticsView({
  period,
  offset,
  todayKey,
  firstDay,
  ai,
  account,
  byDate,
  onOffset,
  onDrill,
  onOpenDay,
  onToggle,
  onMove,
  onPlan,
}: {
  period: Period;
  offset: number;
  todayKey: string;
  /** The earliest day the person has a task on: days before it don't count against them. */
  firstDay: string | null;
  /** The server has the AI: the summary is offered. */
  ai: boolean;
  /** The signed-in account (summaries are kept on this device per account). */
  account: string;
  byDate: (key: string) => Task[];
  onOffset: (o: number) => void;
  onDrill: (p: Period, offset: number) => void;
  onOpenDay: (key: string) => void;
  onToggle: (t: Task) => void;
  onMove: (t: Task, date: string) => void;
  /** Goes to where this period gets planned (Week or Month). */
  onPlan: () => void;
}) {
  const b = periodBounds(period, offset, todayKey);
  // Days before the person's first task aren't theirs to be measured on: averages start when they started.
  const fromStart = (list: DayStat[]) => (firstDay ? list.map((d) => (d.key < firstDay ? { ...d, elapsed: false } : d)) : list);
  const days = fromStart(dayStats(b, todayKey, byDate));
  const sum = summarize(days);
  const prevDays = fromStart(dayStats(periodBounds(period, offset - 1, todayKey), todayKey, byDate));
  // A day still in progress isn't a result yet: rates and averages of the current period run through yesterday, and are
  // compared with the same stretch of the previous period.
  const todayIndex = days.findIndex((d) => d.isToday);
  const settledDays = todayIndex >= 0 ? days.map((d) => (d.isToday ? { ...d, elapsed: false } : d)) : days;
  const settled = summarize(settledDays);
  const prevSettled = summarize(todayIndex >= 0 ? prevDays.slice(0, todayIndex) : prevDays);
  const throughYesterday = todayIndex >= 0;
  const today = parseYmd(todayKey);
  const year = b.start.getFullYear();
  const current = offset === 0;

  const label = period === "week" ? shortRange(b.start, b.end, today.getFullYear()) : period === "month" ? `${MONTHS[b.start.getMonth()]} ${year}` : String(year);

  let bars: Bar[];
  let history: HistoryRow[];
  if (period === "year") {
    const months = monthStats(days);
    const monthOffset = (m: number) => (year - today.getFullYear()) * 12 + (m - today.getMonth());
    const isNow = (m: number) => year === today.getFullYear() && m === today.getMonth();
    bars = months.map((m) => ({
      key: `m${m.month}`,
      label: MONTHS_SHORT[m.month],
      title: `${MONTHS[m.month]} ${year}`,
      done: m.done,
      total: m.planned,
      elapsed: m.elapsedDays > 0,
      current: isNow(m.month),
    }));
    history = months
      .filter((m) => m.planned > 0)
      .map((m) => ({
        key: `m${m.month}`,
        label: `${MONTHS[m.month]} ${year}`,
        done: m.done,
        planned: m.planned,
        rate: m.rate,
        activeDays: `${m.activeDays} of ${m.elapsedDays}`,
        onPick: () => onDrill("month", monthOffset(m.month)),
      }));
  } else {
    bars = days.map((d) => ({
      key: d.key,
      label: period === "week" ? dayShort(d.date) : String(d.date.getDate()),
      sub: period === "week" ? String(d.date.getDate()) : undefined,
      major: d.date.getDate() === 1 || d.date.getDate() % 5 === 0,
      title: formatLong(d.date),
      done: d.done,
      total: d.total,
      elapsed: d.elapsed,
      current: d.isToday,
      tasks: d.tasks,
    }));
    history = days
      .filter((d) => d.elapsed && d.total > 0)
      .map((d) => ({
        key: d.key,
        label: relativeDay(d.key, todayKey) ?? formatMedium(d.date),
        done: d.done,
        planned: d.total,
        rate: d.done / d.total,
        tasks: d.tasks,
        onPick: () => onOpenDay(d.key),
      }));
  }

  const elapsedBars = bars.filter((x) => x.elapsed).length;
  // The average line, like the figures, counts finished days only (and, for a year, the months since the person started).
  const settledMonths = period === "year" ? monthStats(settledDays).filter((m) => m.elapsedDays > 0).length : 0;
  const avg = period === "year" ? (settledMonths ? settled.completed / settledMonths : elapsedBars ? sum.completed / elapsedBars : 0) : settled.elapsedDays ? settled.avg : sum.avg;
  // Days with something done this year so far: a count that only grows (nothing resets it). Shown beside the figure for
  // the current week or month; for the current year it is the figure itself.
  let thisYear = 0;
  if (current && period !== "year") for (let d = new Date(today.getFullYear(), 0, 1); d <= today; d = addDays(d, 1)) if (byDate(ymd(d)).some((t) => t.done)) thisYear++;
  const quiet = "tap relative font-medium text-ink underline decoration-ink-4 underline-offset-[3px] hover:decoration-current";
  const empty = !sum.planned && !sum.upcoming && !prevDays.some((d) => d.total);

  // What the summary is written from: the page's own numbers and the titles of what was done and what's still open.
  const prevSum = summarize(prevDays);
  const summaryInput = useMemo((): SummaryInput => {
    const short = weekdayNames("short");
    return {
      period,
      label,
      current,
      today: todayKey,
      done: sum.completed,
      planned: sum.planned,
      upcoming: sum.upcoming,
      activeDays: sum.activeDays,
      elapsedDays: sum.elapsedDays,
      previous: prevSum.planned ? { done: prevSum.completed, planned: prevSum.planned } : null,
      series:
        period === "year"
          ? monthStats(days).map((m) => ({ label: MONTHS_SHORT[m.month], done: m.done, planned: m.planned }))
          : days.map((d) => ({ label: `${dayShort(d.date)} ${formatShort(d.date)}${d.isToday ? " (today)" : ""}`, done: d.done, planned: d.total })),
      weekdays: period === "week" ? [] : weekdayStats(days).map((w) => ({ day: short[w.index], done: w.done, planned: w.planned })),
      doneTitles: days.flatMap((d) => d.tasks.filter((t) => t.done).map((t) => t.title)).slice(-40),
      openTitles: sum.open.slice(0, 25).map((o) => ({ title: o.task.title, date: formatShort(o.day.date) })),
    };
    // The numbers are all derived from these.
  }, [days, prevDays, period, label, current, todayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = throughYesterday ? sum.open.filter((o) => !o.day.isToday) : sum.open;
  const chart = (
    <Card
      title={period === "year" ? "Done per month" : "Done per day"}
      className="lg:col-span-8"
      aside={
        <span className="flex items-center gap-4 text-caption text-ink-2">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs bg-accent" />
            Done
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs bg-accent-track" />
            Open
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 border-t border-dashed border-ink-3" />
            Average
          </span>
        </span>
      }
    >
      <BarChart bars={bars} avg={avg} avgLabel="avg" onPick={(bar) => (period === "year" ? history.find((h) => h.key === bar.key)?.onPick() : onOpenDay(bar.key))} />
    </Card>
  );

  return (
    // The page's grey, with the panels on it, edge to edge of the work area (the lens takes its picture from here).
    <div data-lens="" className="min-h-full bg-canvas max-md:min-h-[calc(100dvh-100px)]">
      <div className="mx-auto w-full max-w-[1480px] px-3 pt-3 pb-10 md:px-6 md:pt-6 lg:px-8">
        {empty ? (
          // Nothing to measure yet: a sentence where the numbers go, instead of empty charts.
          <p className={`p-5 text-callout text-ink-2 md:p-6 ${PANEL}`}>
            {current ? `Nothing planned this ${period} yet. ` : `Nothing was planned in ${label}. `}
            <button type="button" onClick={current ? onPlan : () => onOffset(0)} className={quiet}>
              {current ? (period === "week" ? "Plan your week" : "Plan your month") : `Back to ${NOW[period].toLowerCase()}`}
            </button>
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-12">
            {ai && (
              <div className="lg:col-span-12">
                <AiSummary input={summaryInput} store={`hyperanchor:summary:${account}:${period}:${ymd(b.start)}`} noun={period} />
              </div>
            )}
            <div className="lg:col-span-12">
              <Kpis
                sum={sum}
                settled={settled}
                prevSettled={prevSettled}
                throughYesterday={throughYesterday}
                period={period}
                current={current}
                yearNote={current && period !== "year" ? `${thisYear} this year` : undefined}
              />
            </div>
            {chart}
            {period === "week" ? (
              <OpenCard open={open} todayKey={todayKey} onToggle={onToggle} onMove={onMove} className="lg:col-span-4" />
            ) : (
              <WeekdayCard days={days} className="lg:col-span-4" />
            )}
            {period === "year" && (
              <Card title="Activity" className="lg:col-span-12" aside={<span className="text-caption text-ink-3">Tasks done per day</span>}>
                <Heatmap days={days} onPick={onOpenDay} />
              </Card>
            )}
            {period !== "week" && <OpenCard open={open} todayKey={todayKey} onToggle={onToggle} onMove={onMove} className="lg:col-span-5" />}
            <HistoryCard rows={history} unit={period === "year" ? "months" : "days"} className={period === "week" ? "lg:col-span-12" : "lg:col-span-7"} />
          </div>
        )}
      </div>
    </div>
  );
}
