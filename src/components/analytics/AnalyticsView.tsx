"use client";

import { useMemo, useState } from "react";
import { addDays, dayName, dayShort, formatLong, formatMedium, formatShort, MONTHS, MONTHS_SHORT, parseYmd, relativeDay, weekdayNames, ymd } from "@/lib/dates";
import { insights as readInsights } from "@/lib/insights";
import { dayStats, monthStats, periodBounds, summarize, weekdayStats, type DayStat, type Period } from "@/lib/stats";
import type { SummaryInput } from "@/lib/summary";
import type { Task } from "@/lib/types";
import { shortRange } from "../WeekView";
import { AiSummary } from "./AiSummary";
import { BarChart, type Bar } from "./BarChart";
import { OpenCard, WeekdayCard } from "./Breakdown";
import { Detailed } from "./Detailed";
import { Heatmap } from "./Heatmap";
import { HistoryCard, type HistoryRow } from "./History";
import { Overview } from "./Overview";
import { Card, PANEL } from "./parts";
import { Peek, type Pick } from "./Peek";

const NOW: Record<Period, string> = { day: "Today", week: "This week", month: "This month", year: "This year" };
const LAST: Record<Period, string> = { day: "Yesterday", week: "Last week", month: "Last month", year: "Last year" };

/**
 * Analytics: the period on screen (a day, a week, a month, a year) in a few panels across the work area, simple first.
 * The AI summary on top (where the server has the AI); the period at a glance (how much is done, how it compares);
 * the days (or months) as bars beside what's left open; for a year, its days as a grid. Everything finer (pace,
 * momentum, steadiness, the weekdays, the history) waits folded away in Detailed analytics. A click on a bar, a square
 * or a row opens that day (or month) in a small card beside it, with a way to go to it. The page's name, its dates, the
 * period switch and the arrows are in the bar above.
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
  /** The signed-in account (what's remembered on this device is kept per account). */
  account: string;
  byDate: (key: string) => Task[];
  onOffset: (o: number) => void;
  onDrill: (p: Period, offset: number) => void;
  onOpenDay: (key: string) => void;
  onToggle: (t: Task) => void;
  onMove: (t: Task, date: string) => void;
  /** Goes to where this period gets planned (Day, Week or Month). */
  onPlan: () => void;
}) {
  const [pick, setPick] = useState<Pick | null>(null);
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
  const throughYesterday = todayIndex >= 0 && period !== "day";
  const today = parseYmd(todayKey);
  const year = b.start.getFullYear();
  const current = offset === 0;
  const prevSum = summarize(prevDays);
  const doneInPeriod = days.reduce((n, d) => n + d.done, 0);

  const label =
    period === "day"
      ? formatLong(b.start)
      : period === "week"
        ? shortRange(b.start, b.end, today.getFullYear())
        : period === "month"
          ? `${MONTHS[b.start.getMonth()]} ${year}`
          : String(year);
  const noun = period;
  const eyebrow = offset === 0 ? (period === "day" ? "Today so far" : `${NOW[period]} so far`) : offset === -1 ? LAST[period] : label;

  const months = period === "year" ? monthStats(days) : [];
  const monthOffset = (y: number, m: number) => (y - today.getFullYear()) * 12 + (m - today.getMonth());
  const pickDay = (d: { key: string; date: Date; tasks: Task[] }, el: HTMLElement) =>
    setPick({ kind: "day", key: d.key, date: d.date, tasks: d.tasks, anchor: el.getBoundingClientRect(), trigger: el });
  const pickMonth = (m: number, el: HTMLElement) => {
    const ms = months[m];
    const best = ms.days.reduce<DayStat | null>((x, d) => (d.elapsed && d.done > (x?.done ?? 0) ? d : x), null);
    setPick({
      kind: "month",
      month: m,
      year,
      done: ms.done,
      planned: ms.planned,
      activeDays: ms.activeDays,
      elapsedDays: ms.elapsedDays,
      best: best ? { date: best.date, done: best.done } : null,
      anchor: el.getBoundingClientRect(),
      trigger: el,
    });
  };

  // The chart: a day among the two weeks up to it; a week's or a month's days; a year's months.
  let bars: Bar[];
  if (period === "year") {
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
  } else {
    const span = period === "day" ? fromStart(dayStats({ start: addDays(b.start, -13), end: b.start, days: 14 }, todayKey, byDate)) : days;
    bars = span.map((d) => ({
      key: d.key,
      label: period === "month" ? String(d.date.getDate()) : dayShort(d.date),
      sub: period === "month" ? undefined : String(d.date.getDate()),
      major: d.date.getDate() === 1 || d.date.getDate() % 5 === 0,
      title: formatLong(d.date),
      done: d.done,
      total: d.total,
      elapsed: d.elapsed,
      current: period === "day" ? d.key === ymd(b.start) : d.isToday,
      tasks: d.tasks,
    }));
  }
  const barDays = new Map((period === "year" ? [] : period === "day" ? dayStats({ start: addDays(b.start, -13), end: b.start, days: 14 }, todayKey, byDate) : days).map((d) => [d.key, d]));

  // The average line counts finished days only (a year: the months since the person started).
  const settledMonths = period === "year" ? monthStats(settledDays).filter((m) => m.elapsedDays > 0).length : 0;
  const finishedBars = bars.filter((x) => x.elapsed && !(period !== "year" && x.key === todayKey));
  const avg =
    period === "year"
      ? settledMonths
        ? settled.completed / settledMonths
        : 0
      : finishedBars.length
        ? finishedBars.reduce((s, x) => s + x.done, 0) / finishedBars.length
        : 0;

  // The history: a day reads against the four weeks before it; the other periods list their own days (a year, months).
  const history: HistoryRow[] =
    period === "year"
      ? months
          .filter((m) => m.planned > 0)
          .map((m) => ({
            key: `m${m.month}`,
            label: `${MONTHS[m.month]} ${year}`,
            done: m.done,
            planned: m.planned,
            rate: m.rate,
            activeDays: `${m.activeDays} of ${m.elapsedDays}`,
            onPick: (el) => pickMonth(m.month, el),
          }))
      : (period === "day" ? fromStart(dayStats({ start: addDays(b.start, -28), end: b.start, days: 29 }, todayKey, byDate)) : days)
          .filter((d) => d.elapsed && d.total > 0)
          .map((d) => ({
            key: d.key,
            label: relativeDay(d.key, todayKey) ?? formatMedium(d.date),
            done: d.done,
            planned: d.total,
            rate: d.done / d.total,
            tasks: d.tasks,
            onPick: (el) => pickDay(d, el),
          }));

  const ins = readInsights(period, days, todayKey, byDate, prevDays.length ? prevSum.completed : null, firstDay);
  // The last fortnight, up to today (or the period's end), for the streak.
  const fortnightEnd = b.end < today ? b.end : today;
  const fortnight = Array.from({ length: 14 }, (_, i) => byDate(ymd(addDays(fortnightEnd, i - 13))).some((t) => t.done));
  const endsOn = period === "week" ? dayName(b.end) : period === "month" ? formatShort(b.end) : "Dec 31";

  const quiet = "tap relative font-medium text-ink underline decoration-ink-4 underline-offset-[3px] hover:decoration-current";
  const empty = !sum.planned && !sum.upcoming && !prevDays.some((d) => d.total) && (period !== "day" || !history.length);

  // What the summary is written from: the page's own numbers and the titles of what was done and what's still open.
  const summaryInput = useMemo((): SummaryInput & { start: string; end: string } => {
    const short = weekdayNames("short");
    const context = period === "day" ? dayStats({ start: addDays(b.start, -6), end: b.start, days: 7 }, todayKey, byDate) : days;
    return {
      period,
      start: ymd(b.start),
      end: ymd(b.end),
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
          : context.map((d) => ({ label: `${dayShort(d.date)} ${formatShort(d.date)}${d.isToday ? " (today)" : ""}`, done: d.done, planned: d.total })),
      weekdays: period === "month" || period === "year" ? weekdayStats(days).map((w) => ({ day: short[w.index], done: w.done, planned: w.planned })) : [],
      doneTitles: days.flatMap((d) => d.tasks.filter((t) => t.done).map((t) => t.title)).slice(-40),
      openTitles: (period === "day" ? days[0].tasks.filter((t) => !t.done).map((task) => ({ task, day: days[0] })) : sum.open)
        .slice(0, 25)
        .map((o) => ({ title: o.task.title, date: formatShort(o.day.date) })),
    };
    // The numbers are all derived from these.
  }, [days, prevDays, period, label, current, todayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // What's left open: on finished days (a day: its own open tasks, today's included).
  const open =
    period === "day"
      ? days[0].tasks.filter((t) => !t.done).map((task) => ({ task, day: days[0] }))
      : throughYesterday
        ? sum.open.filter((o) => !o.day.isToday)
        : sum.open;

  const chart = (
    <Card
      title={period === "year" ? "Done per month" : period === "day" ? "The last two weeks" : "Done per day"}
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
      <BarChart
        bars={bars}
        avg={avg}
        avgLabel="avg"
        onPick={(bar, el) => {
          if (period === "year") return pickMonth(Number(bar.key.slice(1)), el);
          const d = barDays.get(bar.key);
          if (d) pickDay(d, el);
        }}
      />
    </Card>
  );

  return (
    // The page's grey, with the panels on it, edge to edge of the work area (the lens takes its picture from here).
    <div data-lens="" className="min-h-full bg-canvas max-md:min-h-[calc(100dvh-100px)]">
      <div className="mx-auto w-full max-w-[1480px] px-3 pt-3 pb-10 md:px-6 md:pt-6 lg:px-8">
        {empty ? (
          // Nothing to measure yet: a sentence where the numbers go, instead of empty charts.
          <p className={`p-5 text-callout text-ink-2 md:p-6 ${PANEL}`}>
            {current ? `Nothing planned ${period === "day" ? "today" : `this ${period}`} yet. ` : `Nothing was planned in ${label}. `}
            <button type="button" onClick={current ? onPlan : () => onOffset(0)} className={quiet}>
              {current ? `Plan your ${period === "year" ? "month" : period}` : `Back to ${NOW[period].toLowerCase()}`}
            </button>
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-12">
            {ai && (
              <div className="lg:col-span-12">
                <AiSummary input={summaryInput} done={doneInPeriod} noun={noun} account={account} />
              </div>
            )}
            <div className="lg:col-span-12">
              <Overview
                period={period}
                eyebrow={eyebrow}
                running={period === "day" && current}
                sum={sum}
                settled={settled}
                prevSettled={prevSettled}
                throughYesterday={throughYesterday}
                open={open.length}
                insights={ins}
              />
            </div>
            {chart}
            <OpenCard
              open={open}
              todayKey={todayKey}
              onToggle={onToggle}
              onMove={onMove}
              title={period === "day" && current ? "Still open" : "Left open"}
              empty={period === "day" ? (current ? "Nothing left for today." : "Everything on this day got done.") : "Nothing from earlier days is waiting."}
              className="lg:col-span-4"
            />
            {period === "year" && (
              <Card title="Activity" className="lg:col-span-12" aside={<span className="text-caption text-ink-3">Tasks done per day</span>}>
                <Heatmap days={days} todayKey={todayKey} onPick={(d, el) => pickDay(d, el)} />
              </Card>
            )}
            <div className="lg:col-span-12">
              <Detailed period={period} insights={ins} endsOn={endsOn} fortnight={fortnight}>
                {(period === "month" || period === "year") && <WeekdayCard days={days} className="lg:col-span-5" />}
                <HistoryCard
                  rows={history}
                  unit={period === "year" ? "months" : "days"}
                  className={period === "month" || period === "year" ? "lg:col-span-7" : "lg:col-span-12"}
                />
              </Detailed>
            </div>
          </div>
        )}
      </div>
      {pick && (
        <Peek
          pick={pick}
          todayKey={todayKey}
          onOpenDay={onOpenDay}
          onOpenMonth={(y, m) => onDrill("month", monthOffset(y, m))}
          onClose={() => setPick(null)}
        />
      )}
    </div>
  );
}
