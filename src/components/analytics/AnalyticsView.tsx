"use client";

import { addDays, dayShort, formatLong, formatMedium, MONTHS, MONTHS_SHORT, parseYmd, rangeLabel, relativeDay, ymd } from "@/lib/dates";
import { currentStreak, dayStats, longestStreak, monthStats, periodBounds, summarize, type DayStat, type Period } from "@/lib/stats";
import type { Task } from "@/lib/types";
import { ChartIcon } from "../icons";
import { EmptyState, NavGroup, Toolbar } from "../Toolbar";
import { Button, SegmentedControl } from "../ui";
import { BarChart, type Bar } from "./BarChart";
import { OpenCard, WeekdayCard } from "./Breakdown";
import { Heatmap } from "./Heatmap";
import { HistoryCard, type HistoryRow } from "./History";
import { Card, Kpis, type SparkPoint } from "./parts";

const NOW: Record<Period, string> = { week: "This Week", month: "This Month", year: "This Year" };

export function AnalyticsView({
  period,
  offset,
  todayKey,
  firstDay,
  byDate,
  onPeriod,
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
  byDate: (key: string) => Task[];
  onPeriod: (p: Period) => void;
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

  const label = period === "week" ? rangeLabel(b.start, b.end) : period === "month" ? `${MONTHS[b.start.getMonth()]} ${year}` : String(year);

  let bars: Bar[];
  let history: HistoryRow[];
  let spark: SparkPoint[];
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
    spark = months.map((m) => ({ value: m.done, current: isNow(m.month), elapsed: m.elapsedDays > 0 }));
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
    spark = days.map((d) => ({ value: d.done, current: d.isToday, elapsed: d.elapsed }));
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
  const longest = longestStreak(days);
  // The current streak counts back from today (or from yesterday, while today has nothing done yet).
  const streak = current ? currentStreak(todayKey, byDate) : longest;
  const streakSince = (() => {
    if (!current || !streak) return null;
    const last = byDate(todayKey).some((t) => t.done) ? today : addDays(today, -1);
    const first = addDays(last, -(streak - 1));
    const key = ymd(first);
    return key === todayKey ? "today" : key === ymd(addDays(today, -1)) ? "yesterday" : formatMedium(first).replace(/^\w+, /, "");
  })();
  // The last seven days up to today (or up to the end of an earlier period).
  const end = current ? today : b.end;
  const recent = Array.from({ length: 7 }, (_, i) => byDate(ymd(addDays(end, i - 6))).some((t) => t.done));

  return (
    <>
      <Toolbar title="Analytics" subtitle={label} wide>
        <SegmentedControl
          label="Period"
          value={period}
          onChange={onPeriod}
          options={[
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
            { value: "year", label: "Year" },
          ]}
        />
        <NavGroup
          prevLabel={`Previous ${period}`}
          nextLabel={`Next ${period}`}
          todayLabel={NOW[period]}
          onPrev={() => onOffset(offset - 1)}
          onNext={() => onOffset(offset + 1)}
          onToday={() => onOffset(0)}
          todayDisabled={offset === 0}
          nextDisabled={offset === 0}
        />
      </Toolbar>

      {!sum.planned && !sum.upcoming && !prevDays.some((d) => d.total) ? (
        // Nothing to measure yet: one calm line instead of empty charts.
        <div className="mx-auto max-w-[1240px] px-3 pb-10 md:px-8">
          {current ? (
            <EmptyState icon={<ChartIcon size={22} />} title={`Nothing planned this ${period} yet`} action={<Button onClick={onPlan}>{period === "week" ? "Plan your week" : "Plan your month"}</Button>}>
              Your progress shows up here as you add and finish tasks.
            </EmptyState>
          ) : (
            <EmptyState icon={<ChartIcon size={22} />} title={`Nothing was planned in ${label}`} action={<Button onClick={() => onOffset(0)}>{`Back to ${NOW[period].toLowerCase()}`}</Button>}>
              There’s nothing to measure for this {period}.
            </EmptyState>
          )}
        </div>
      ) : (
      <div className="mx-auto max-w-[1240px] space-y-3 px-3 pb-10 md:space-y-4 md:px-8">
        <Kpis
          sum={sum}
          settled={settled}
          prevSettled={prevSettled}
          throughYesterday={throughYesterday}
          period={period}
          current={current}
          spark={spark}
          streak={streak}
          streakSince={streakSince}
          recent={recent}
        />

        <Card
          title={period === "year" ? "Completed per month" : "Completed per day"}
          aside={
            <span className="flex items-center gap-4 text-[12px] text-ink-2">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px] bg-accent" />
                Done
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px] bg-accent-track" />
                Not done
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
            onPick={(bar) => (period === "year" ? history.find((h) => h.key === bar.key)?.onPick() : onOpenDay(bar.key))}
          />
          {sum.upcoming > 0 && (
            <p className="mt-3 text-[12px] text-ink-3">
              {sum.upcoming === 1 ? "1 more task is" : `${sum.upcoming} more tasks are`} planned for the rest of this {period}.
            </p>
          )}
        </Card>

        {period === "year" && (
          <Card title="Activity" aside={<span className="text-[12px] text-ink-3">Completed tasks per day</span>}>
            <Heatmap days={days} onPick={onOpenDay} />
          </Card>
        )}

        <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
          {period !== "week" && <WeekdayCard days={days} />}
          <OpenCard
            open={throughYesterday ? sum.open.filter((o) => !o.day.isToday) : sum.open}
            todayKey={todayKey}
            onToggle={onToggle}
            onMove={onMove}
            onOpenDay={onOpenDay}
            className={period === "week" ? "lg:col-span-2" : ""}
          />
        </div>

        <HistoryCard rows={history} unit={period === "year" ? "months" : "days"} />
      </div>
      )}
    </>
  );
}
