"use client";

import { DOW_SHORT, dowIndex, formatLong, formatMedium, MONTHS, MONTHS_SHORT, parseYmd, rangeLabel, relativeDay } from "@/lib/dates";
import { dayStats, monthStats, periodBounds, summarize, type Period } from "@/lib/stats";
import type { Task } from "@/lib/types";
import { NavGroup, Toolbar } from "../Toolbar";
import { SegmentedControl } from "../ui";
import { BarChart, type Bar } from "./BarChart";
import { OpenCard, WeekdayCard } from "./Breakdown";
import { Heatmap } from "./Heatmap";
import { HistoryCard, type HistoryRow } from "./History";
import { Card, Kpis } from "./parts";

const NOW: Record<Period, string> = { week: "This Week", month: "This Month", year: "This Year" };

export function AnalyticsView({
  period,
  offset,
  todayKey,
  byDate,
  onPeriod,
  onOffset,
  onDrill,
  onOpenDay,
  onToggle,
  onMove,
}: {
  period: Period;
  offset: number;
  todayKey: string;
  byDate: (key: string) => Task[];
  onPeriod: (p: Period) => void;
  onOffset: (o: number) => void;
  onDrill: (p: Period, offset: number) => void;
  onOpenDay: (key: string) => void;
  onToggle: (t: Task) => void;
  onMove: (t: Task, date: string) => void;
}) {
  const b = periodBounds(period, offset, todayKey);
  const days = dayStats(b, todayKey, byDate);
  const sum = summarize(days);
  const prev = summarize(dayStats(periodBounds(period, offset - 1, todayKey), todayKey, byDate));
  const today = parseYmd(todayKey);
  const year = b.start.getFullYear();

  const label = period === "week" ? rangeLabel(b.start, b.end) : period === "month" ? `${MONTHS[b.start.getMonth()]} ${year}` : String(year);

  let bars: Bar[];
  let history: HistoryRow[];
  if (period === "year") {
    const months = monthStats(days);
    const monthOffset = (m: number) => (year - today.getFullYear()) * 12 + (m - today.getMonth());
    bars = months.map((m) => ({
      key: `m${m.month}`,
      label: MONTHS_SHORT[m.month],
      title: `${MONTHS[m.month]} ${year}`,
      done: m.done,
      total: m.planned,
      elapsed: m.elapsedDays > 0,
      current: year === today.getFullYear() && m.month === today.getMonth(),
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
      label: period === "week" ? DOW_SHORT[dowIndex(d.date)] : String(d.date.getDate()),
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

  const avg = period === "year" ? (bars.filter((x) => x.elapsed).length ? sum.completed / bars.filter((x) => x.elapsed).length : 0) : sum.avg;

  return (
    <>
      <Toolbar title="Analytics" subtitle={label}>
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

      <div className="mx-auto max-w-[1180px] space-y-4 px-4 py-5 md:px-7 md:py-6">
        <Kpis sum={sum} prev={prev} period={period} />

        <Card
          title={period === "year" ? "Completed per month" : "Completed per day"}
          aside={
            <span className="flex items-center gap-4 text-[12px] text-label-2">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px] bg-accent" />
                Done
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px] bg-fill" />
                Open
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 border-t border-dashed border-accent" />
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
            <p className="mt-3 text-[12px] text-label-2">
              {sum.upcoming === 1 ? "1 more task is" : `${sum.upcoming} more tasks are`} planned for the rest of this {period}.
            </p>
          )}
        </Card>

        {period === "year" && (
          <Card title="Activity" aside={<span className="text-[12px] text-label-2">Completed tasks per day</span>}>
            <Heatmap days={days} onPick={onOpenDay} />
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {period !== "week" && <WeekdayCard days={days} />}
          <OpenCard
            open={sum.open}
            todayKey={todayKey}
            onToggle={onToggle}
            onMove={onMove}
            onOpenDay={onOpenDay}
            className={period === "week" ? "lg:col-span-2" : ""}
          />
        </div>

        <HistoryCard rows={history} unit={period === "year" ? "months" : "days"} />
      </div>
    </>
  );
}
