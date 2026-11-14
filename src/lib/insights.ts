import { addDays, parseYmd, ymd } from "./dates";
import type { DayStat, Period } from "./stats";
import type { Task } from "./types";

/**
 * Detailed analytics: a little mathematics behind the charts, each result put the way a person would say it. Everything
 * here reads finished days only (a day still running isn't a result yet) from a window of recent days that suits the
 * period: the four weeks before a day; the four weeks up to the end of a week; the month itself, or the year itself.
 */

export const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);

/** The middle value: half the values are at or below it, half at or above. */
export function quantile(v: number[], q: number) {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  const at = (s.length - 1) * q;
  const lo = Math.floor(at);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (at - lo);
}
export const median = (v: number[]) => quantile(v, 0.5);

/** How far values spread around their mean (population standard deviation). */
export function stdev(v: number[]) {
  if (v.length < 2) return 0;
  const m = mean(v);
  return Math.sqrt(mean(v.map((x) => (x - m) ** 2)));
}

/** Least squares: the straight line y = intercept + slope·x through (0, v0), (1, v1)… that fits them best. */
export function trend(v: number[]): { slope: number; intercept: number } | null {
  const n = v.length;
  if (n < 3) return null;
  const mx = (n - 1) / 2;
  const my = mean(v);
  let num = 0;
  let den = 0;
  v.forEach((y, x) => {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  });
  const slope = den ? num / den : 0;
  return { slope, intercept: my - slope * mx };
}

export type Insights = {
  /** Finished days the window holds. */
  days: number;
  /** "the last 4 weeks", "this month so far", … */
  window: string;
  /** The current period only: where it is heading at the recent pace. */
  pace: { soFar: number; projected: number; previous: number | null; perDay: number } | null;
  /** A day: how it compares with the days before it (the share of them it beat). */
  rank: { beat: number; of: number; typical: number } | null;
  /** The straight line through the window's daily (a year: weekly) counts. */
  momentum: { from: number; to: number; unit: "day" | "week"; change: number; label: "Rising" | "Steady" | "Slowing"; series: number[] } | null;
  /** How alike the days are: 1 / (1 + σ/μ), and the middle half of them. */
  steadiness: { score: number; label: string; low: number; high: number } | null;
  /** The typical (median) day with something planned, and the best day of the period. */
  typical: { median: number; best: DayStat | null } | null;
  /** Planned against done on the window's days with something planned, and what a good day holds (75th percentile). */
  planning: { ratio: number; realistic: number } | null;
  streak: { current: number; longest: number };
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Works the insights out. `days` are the period's days; `byDate` reaches the days before it; `prevTotal` is what the
 * previous period finished with (for the pace).
 */
export function insights(
  period: Period,
  days: DayStat[],
  todayKey: string,
  byDate: (key: string) => Task[],
  prevTotal: number | null,
  /** The person's first day with a task: days before it aren't theirs to be measured on. */
  firstDay: string | null = null,
): Insights {
  const today = parseYmd(todayKey);
  const first = days[0];
  const last = days[days.length - 1];
  const doneOn = (d: Date) => byDate(ymd(d)).filter((t) => t.done).length;
  const plannedOn = (d: Date) => byDate(ymd(d)).length;
  // The last finished day the window can reach: the period's end, or yesterday while the period is still running.
  const yesterday = addDays(today, -1);
  const end = period === "day" ? addDays(first.date, -1) : last.date < today ? last.date : yesterday;
  const from = period === "day" || period === "week" ? addDays(end, -27) : first.date;
  const start = firstDay && ymd(from) < firstDay ? parseYmd(firstDay) : from;
  const window: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) window.push(d);
  const counts = window.map(doneOn);
  const planned = window.map(plannedOn);
  const n = window.length;

  const label =
    period === "day" ? "the 4 weeks before" : period === "week" ? "the last 4 weeks" : period === "month" ? (last.date >= today ? "this month so far" : "the month") : last.date >= today ? "this year so far" : "the year";

  // Pace: the running period's total if the recent average holds for the days left (today counts as half done).
  let pace: Insights["pace"] = null;
  const running = period !== "day" && first.date <= today && last.date >= today;
  if (running) {
    const recent = counts.slice(-28);
    const perDay = mean(recent);
    const soFar = days.reduce((s, d) => s + (d.elapsed ? d.done : 0), 0);
    const left = days.filter((d) => d.date > today).length;
    const todayDone = days.find((d) => d.isToday)?.done ?? 0;
    pace = { soFar, perDay, previous: prevTotal, projected: Math.round(soFar + perDay * left + Math.max(0, perDay - todayDone)) };
  }

  // A day against the four weeks before it.
  let rank: Insights["rank"] = null;
  if (period === "day" && n) {
    const done = first.done;
    rank = { beat: counts.filter((c) => c < done).length, of: n, typical: median(counts) };
  }

  // Momentum: least squares through the daily counts (a year: weekly sums, so a quiet weekday doesn't read as a slump).
  let momentum: Insights["momentum"] = null;
  const series = period === "year" ? weekly(counts) : counts;
  const fit = series.length >= 7 && series.some((c) => c > 0) ? trend(series) : null;
  if (fit) {
    const from = Math.max(0, fit.intercept);
    const to = Math.max(0, fit.intercept + fit.slope * (series.length - 1));
    const change = (to - from) / Math.max(mean(series), 0.5);
    momentum = { from: round1(from), to: round1(to), unit: period === "year" ? "week" : "day", change, label: change > 0.15 ? "Rising" : change < -0.15 ? "Slowing" : "Steady", series };
  }

  // Steadiness: 1 / (1 + coefficient of variation). Days alike → 1; days that swing as much as their average → ½.
  let steadiness: Insights["steadiness"] = null;
  const m = mean(counts);
  if (n >= 7 && m > 0) {
    const score = 1 / (1 + stdev(counts) / m);
    steadiness = {
      score,
      label: score >= 0.75 ? "Very steady" : score >= 0.6 ? "Steady" : score >= 0.45 ? "Uneven" : "Up and down",
      low: Math.round(quantile(counts, 0.25)),
      high: Math.round(quantile(counts, 0.75)),
    };
  }

  // The typical day: the median over days that had something planned (an empty day isn't a typical one).
  const plannedDays = counts.filter((_, i) => planned[i] > 0);
  const best = days.reduce<DayStat | null>((b, d) => (d.elapsed && d.done > (b?.done ?? 0) ? d : b), null);
  const typical: Insights["typical"] = plannedDays.length ? { median: median(plannedDays), best } : best ? { median: 0, best } : null;

  // Planning: how much gets planned for each task that gets done, and what a good day (the 75th percentile) holds.
  let planning: Insights["planning"] = null;
  const pSum = planned.reduce((a, b) => a + b, 0);
  const dSum = plannedDays.reduce((a, b) => a + b, 0);
  if (plannedDays.length >= 5 && dSum > 0) planning = { ratio: pSum / dSum, realistic: Math.max(1, Math.round(quantile(plannedDays, 0.75))) };

  // Streaks: days in a row with something done, now (ending today, or yesterday while today has nothing yet) and the
  // longest within the window and the period.
  let current = 0;
  for (let d = doneOn(today) ? today : yesterday; current < 366 && doneOn(d) > 0; d = addDays(d, -1)) current++;
  let longest = 0;
  let run = 0;
  const span: number[] = [...counts];
  for (const d of days) if (d.elapsed && d.date > end) span.push(d.done);
  for (const c of span) {
    run = c > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }

  return { days: n, window: label, pace, rank, momentum, steadiness, typical, planning, streak: { current, longest } };
}

/** Daily counts → weekly sums, oldest first (a last, unfinished week is left out). */
function weekly(counts: number[]) {
  const out: number[] = [];
  for (let i = 0; i + 7 <= counts.length; i += 7) out.push(counts.slice(i, i + 7).reduce((a, b) => a + b, 0));
  return out;
}
