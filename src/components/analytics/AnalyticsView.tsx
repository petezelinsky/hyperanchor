"use client";

import { DOW_FULL, DOW_SHORT, dowIndex, formatLong, formatMedium, formatShort, MONTHS, MONTHS_SHORT, parseYmd, relativeDay, spanLabel } from "@/lib/dates";
import { dayStats, monthStats, pct, periodBounds, summarize, type Period } from "@/lib/stats";
import type { Task } from "@/lib/types";
import { DotTabs } from "../ui";
import { NavControls, Page, ViewHeader } from "../ViewHeader";
import { BarChart, type Bar } from "./BarChart";
import { OpenSection, WeekdaySection } from "./Breakdown";
import { Heatmap } from "./Heatmap";
import { HistorySection, type HistoryRow } from "./History";
import { KpiStrip, Section } from "./parts";

const NOW: Record<Period, string> = { week: "This week", month: "This month", year: "This year" };
const plural = (n: number, w: string) => `${n} ${n === 1 ? w : w + "s"}`;

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
  const months = period === "year" ? monthStats(days) : [];

  // The headline: what got done, in plain words.
  const when =
    period === "week"
      ? offset === 0 ? "this week" : offset === -1 ? "last week" : `the week of ${formatShort(b.start)}`
      : period === "month"
        ? offset === 0 ? "this month" : `in ${MONTHS[b.start.getMonth()]}`
        : offset === 0 ? "this year" : `in ${year}`;
  const bestMonth = months.reduce<(typeof months)[number] | null>((best, m) => (m.done > (best?.done ?? 0) ? m : best), null);
  const strongest =
    period === "year"
      ? bestMonth && ` — ${MONTHS[bestMonth.month]} was the strongest month`
      : sum.best && ` — ${period === "week" ? DOW_FULL[dowIndex(sum.best.date)] : formatShort(sum.best.date)} was your best day`;
  const headline = `${plural(sum.completed, "task")} done ${when}.`;
  const rest = !sum.planned
    ? "Nothing was planned yet."
    : !sum.completed
      ? `${plural(sum.planned, "task")} planned so far.`
      : `That’s ${pct(sum.rate ?? 0)} of what you planned${strongest || ""}.`;

  const label = `${period === "week" ? `${offset === 0 ? "This week" : "Week"} · ${spanLabel(b.start, b.end)}` : period === "month" ? `${MONTHS[b.start.getMonth()]} ${year}` : String(year)}`;

  let bars: Bar[];
  let history: HistoryRow[];
  if (period === "year") {
    const monthOffset = (m: number) => (year - today.getFullYear()) * 12 + (m - today.getMonth());
    bars = months.map((m) => ({
      key: `m${m.month}`,
      label: MONTHS_SHORT[m.month],
      major: true,
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
  const elapsedBars = bars.filter((x) => x.elapsed).length;
  const avg = period === "year" ? (elapsedBars ? sum.completed / elapsedBars : 0) : sum.avg;
  const key = `${period}:${offset}`;

  return (
    <Page className="pb-24">
      <ViewHeader label={label} title={headline} rest={rest} animKey={key}>
        <DotTabs
          label="Period"
          value={period}
          onChange={onPeriod}
          options={[
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
            { value: "year", label: "Year" },
          ]}
          className="mr-1"
        />
        <NavControls
          prevLabel={`Previous ${period}`}
          nextLabel={`Next ${period}`}
          todayLabel={NOW[period]}
          onPrev={() => onOffset(offset - 1)}
          onNext={() => onOffset(offset + 1)}
          onToday={() => onOffset(0)}
          showToday={offset !== 0}
          nextDisabled={offset === 0}
        />
      </ViewHeader>

      <KpiStrip key={`k${key}`} sum={sum} prev={prev} period={period} className="mt-10" />

      <Section
        label={period === "year" ? "Done per month" : "Done per day"}
        className="mt-14"
        aside={
          <span className="flex items-center gap-4 font-mono text-[10px] tracking-[0.06em] text-muted uppercase">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] bg-ink" />
              Done
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] bg-track" />
              Open
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 border-t border-dashed border-ink/50" />
              Average
            </span>
          </span>
        }
      >
        <BarChart key={`c${key}`} bars={bars} avg={avg} onPick={(bar) => (period === "year" ? history.find((h) => h.key === bar.key)?.onPick() : onOpenDay(bar.key))} />
        {sum.upcoming > 0 && (
          <p className="mt-4 text-[13px] text-muted">
            {sum.upcoming === 1 ? "1 more task is" : `${sum.upcoming} more tasks are`} planned for the rest of this {period}.
          </p>
        )}
      </Section>

      {period === "year" && (
        <Section label="Activity" className="mt-14" aside={<span className="mono-label">Completed per day</span>}>
          <Heatmap days={days} onPick={onOpenDay} />
        </Section>
      )}

      <div className="mt-14 grid gap-14 lg:grid-cols-2 lg:gap-12">
        {period !== "week" && <WeekdaySection days={days} />}
        <OpenSection open={sum.open} todayKey={todayKey} onToggle={onToggle} onMove={onMove} onOpenDay={onOpenDay} className={period === "week" ? "lg:col-span-2" : ""} />
      </div>

      <div className="mt-14">
        <HistorySection rows={history} unit={period === "year" ? "months" : "days"} />
      </div>
    </Page>
  );
}
