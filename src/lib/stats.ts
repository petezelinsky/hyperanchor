import { addDays, dayDiff, dowIndex, parseYmd, startOfWeek, ymd } from "./dates";
import type { Task } from "./types";

export type Period = "week" | "month" | "year";
export type Bounds = { start: Date; end: Date; days: number };

/** The week/month/year `offset` periods away from today's (offset ≤ 0). */
export function periodBounds(period: Period, offset: number, todayKey: string): Bounds {
  const today = parseYmd(todayKey);
  if (period === "week") {
    const start = addDays(startOfWeek(today), offset * 7);
    return { start, end: addDays(start, 6), days: 7 };
  }
  if (period === "month") {
    const start = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return { start, end, days: end.getDate() };
  }
  const start = new Date(today.getFullYear() + offset, 0, 1);
  const end = new Date(start.getFullYear(), 11, 31);
  return { start, end, days: dayDiff(end, start) + 1 };
}

/** What analytics needs loaded: the previous period (for comparisons) through the end of this one. */
export function statsRange(period: Period, offset: number, todayKey: string): [string, string] {
  return [ymd(periodBounds(period, offset - 1, todayKey).start), ymd(periodBounds(period, offset, todayKey).end)];
}

export type DayStat = { key: string; date: Date; tasks: Task[]; done: number; total: number; elapsed: boolean; isToday: boolean };

/** One entry per day of the period. Only elapsed days (up to and including today) count towards results. */
export function dayStats(b: Bounds, todayKey: string, byDate: (key: string) => Task[]): DayStat[] {
  return Array.from({ length: b.days }, (_, i) => {
    const date = addDays(b.start, i);
    const key = ymd(date);
    const tasks = byDate(key);
    const done = tasks.filter((t) => t.done).length;
    return { key, date, tasks, done, total: tasks.length, elapsed: key <= todayKey, isToday: key === todayKey };
  });
}

export type Summary = {
  completed: number;
  planned: number;
  rate: number | null;
  elapsedDays: number;
  activeDays: number;
  avg: number;
  best: DayStat | null;
  open: { task: Task; day: DayStat }[];
  upcoming: number;
};

export function summarize(days: DayStat[]): Summary {
  const el = days.filter((d) => d.elapsed);
  const completed = el.reduce((n, d) => n + d.done, 0);
  const planned = el.reduce((n, d) => n + d.total, 0);
  const best = el.reduce<DayStat | null>((b, d) => (d.done > (b?.done ?? 0) ? d : b), null);
  const open = el
    .flatMap((day) => day.tasks.filter((t) => !t.done).map((task) => ({ task, day })))
    .reverse();
  return {
    completed,
    planned,
    rate: planned ? completed / planned : null,
    elapsedDays: el.length,
    activeDays: el.filter((d) => d.done > 0).length,
    avg: el.length ? completed / el.length : 0,
    best,
    open,
    upcoming: days.filter((d) => !d.elapsed).reduce((n, d) => n + d.total, 0),
  };
}

export type WeekdayStat = { index: number; done: number; planned: number; days: number; avg: number; rate: number | null };

/** Per weekday (Mon…Sun) across the elapsed days of the period. */
export function weekdayStats(days: DayStat[]): WeekdayStat[] {
  const out = Array.from({ length: 7 }, (_, index) => ({ index, done: 0, planned: 0, days: 0, avg: 0, rate: null as number | null }));
  for (const d of days) {
    if (!d.elapsed) continue;
    const w = out[dowIndex(d.date)];
    w.done += d.done;
    w.planned += d.total;
    w.days += 1;
  }
  for (const w of out) {
    w.avg = w.days ? w.done / w.days : 0;
    w.rate = w.planned ? w.done / w.planned : null;
  }
  return out;
}

export type MonthStat = { month: number; done: number; planned: number; rate: number | null; activeDays: number; elapsedDays: number; days: DayStat[] };

/** Per month, for the year view. */
export function monthStats(days: DayStat[]): MonthStat[] {
  const out: MonthStat[] = Array.from({ length: 12 }, (_, month) => ({ month, done: 0, planned: 0, rate: null, activeDays: 0, elapsedDays: 0, days: [] }));
  for (const d of days) {
    const m = out[d.date.getMonth()];
    m.days.push(d);
    if (!d.elapsed) continue;
    m.done += d.done;
    m.planned += d.total;
    m.elapsedDays += 1;
    if (d.done) m.activeDays += 1;
  }
  for (const m of out) m.rate = m.planned ? m.done / m.planned : null;
  return out;
}

/**
 * Consecutive days with at least one completed task, ending today — or yesterday while today
 * has nothing done yet, so a streak doesn't read as broken in the morning.
 */
export function currentStreak(todayKey: string, byDate: (key: string) => Task[], limit = 366): number {
  const doneOn = (d: Date) => byDate(ymd(d)).some((t) => t.done);
  let d = parseYmd(todayKey);
  if (!doneOn(d)) d = addDays(d, -1);
  let n = 0;
  while (n < limit && doneOn(d)) {
    n += 1;
    d = addDays(d, -1);
  }
  return n;
}

/** The longest run of consecutive elapsed days with at least one completed task. */
export function longestStreak(days: DayStat[]): number {
  let best = 0;
  let run = 0;
  for (const d of days) {
    if (!d.elapsed) break;
    run = d.done > 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** A round axis maximum ≥ v (at least 4). */
export function niceMax(v: number) {
  if (v <= 4) return 4;
  const step = v <= 10 ? 2 : v <= 50 ? 5 : v <= 100 ? 10 : 50;
  return Math.ceil(v / step) * step;
}

/** "1.5" → "1.5", "2.0" → "2". */
export const fmt1 = (n: number) => n.toFixed(1).replace(/\.0$/, "");
export const pct = (r: number) => `${Math.round(r * 100)}%`;
