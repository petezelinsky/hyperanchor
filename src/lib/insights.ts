import { addDays, dowIndex, parseYmd, ymd } from "./dates";
import type { DayStat, Period } from "./stats";
import type { Task } from "./types";

/**
 * Detailed analytics: a little mathematics behind the charts, each result put the way a person would say it. Everything
 * here reads finished days only (a day still running isn't a result yet) from a window of recent days that suits the
 * period: the four weeks before a day; the four weeks up to the end of a week; the month itself, or the year itself.
 */

export const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);

/** The value a share `q` of the way through the sorted values (0.5: the median). */
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

/** The average of each value and the `span - 1` before it (fewer at the start). */
export function movingAverage(v: number[], span: number) {
  let sum = 0;
  return v.map((x, i) => {
    sum += x;
    if (i >= span) sum -= v[i - span];
    return sum / Math.min(i + 1, span);
  });
}

/** A point of the window: a day (a year's trend: a week), what was done and planned in it. */
export type Point = { key: string; date: Date; done: number; planned: number };

export type Insights = {
  /** Finished days the window holds. */
  days: number;
  /** "the last 4 weeks", "this month so far", … */
  window: string;
  /**
   * The period as it adds up, day by day: tasks done so far (`now`, up to the last day that has begun), where it is
   * heading at the recent pace (`ahead`, from today to the period's end, with `spread`: how far a day's count strays),
   * and the period before, added up the same way. Null for a single day.
   */
  burn: { now: number[]; ahead: number[] | null; spread: number; before: number[] | null; length: number; projected: number | null; perDay: number; previous: number | null } | null;
  /** A day: how it compares with the days before it (the share of them it beat). */
  rank: { beat: number; of: number; typical: number } | null;
  /** The window's counts (a year: week by week), their moving average, and the straight line through them. */
  momentum: { points: Point[]; average: number[]; from: number; to: number; unit: "day" | "week"; change: number; label: "Rising" | "Steady" | "Slowing" } | null;
  /** How many days ended with 0, 1, 2… done; the middle half of them; and how alike they are: 1 / (1 + σ/μ). */
  spread: { bins: number[]; median: number; mean: number; low: number; high: number; score: number; label: string } | null;
  /** Each weekday (in week order): what's done on a day like it on average, and the share of what's planned. */
  weekdays: { index: number; avg: number; rate: number | null; days: number }[];
  /** Days by what was planned and what got done (how many days share each pair), and the share that gets done. */
  plan: { dots: { planned: number; done: number; days: number }[]; share: number; ratio: number; realistic: number; max: number } | null;
  /** The typical (median) day with something planned, and the best day of the period. */
  typical: { median: number; best: DayStat | null } | null;
  streak: { current: number; longest: number };
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Works the insights out. `days` are the period's days and `prev` those of the period before; `byDate` reaches the
 * days before them.
 */
export function insights(
  period: Period,
  days: DayStat[],
  prev: DayStat[],
  todayKey: string,
  byDate: (key: string) => Task[],
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
  const window: Point[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) window.push({ key: ymd(d), date: d, done: doneOn(d), planned: plannedOn(d) });
  const counts = window.map((p) => p.done);
  const n = window.length;
  const running = period !== "day" && first.date <= today && last.date >= today;

  const label =
    period === "day" ? "the 4 weeks before" : period === "week" ? "the last 4 weeks" : period === "month" ? (running ? "this month so far" : "the month") : running ? "this year so far" : "the year";

  // The period adding up, and where it is heading: done so far + the recent daily average × the days left (today counts
  // for what's still missing of an average day).
  let burn: Insights["burn"] = null;
  if (period !== "day") {
    const recent = counts.slice(-28);
    const perDay = mean(recent);
    const sigma = stdev(recent);
    const cumulate = (list: DayStat[]) => {
      const out: number[] = [];
      let sum = 0;
      for (const d of list) {
        if (ymd(d.date) > todayKey) break;
        sum += d.done;
        out.push(sum);
      }
      return out;
    };
    const now = cumulate(days);
    const beforeAll = cumulate(prev);
    const before = prev.some((d) => d.total > 0) ? beforeAll : null;
    let ahead: number[] | null = null;
    let projected: number | null = null;
    if (running && now.length) {
      const todayDone = days.find((d) => d.isToday)?.done ?? 0;
      let at = now[now.length - 1] + Math.max(0, perDay - todayDone);
      // From the end of today (index 0) to the period's last day.
      ahead = [at];
      for (let i = now.length; i < days.length; i++) {
        at += perDay;
        ahead.push(at);
      }
      projected = Math.round(at);
    }
    burn = { now, ahead, spread: sigma, before, length: days.length, projected, perDay, previous: before ? (before[before.length - 1] ?? 0) : null };
  }

  // A day against the four weeks before it.
  let rank: Insights["rank"] = null;
  if (period === "day" && n) rank = { beat: counts.filter((c) => c < first.done).length, of: n, typical: median(counts) };

  // Momentum: least squares through the counts (a year: weekly sums, so a quiet weekday doesn't read as a slump), and
  // their moving average (a week of days, or four weeks of a year).
  let momentum: Insights["momentum"] = null;
  const points = period === "year" ? weekly(window) : window;
  const series = points.map((p) => p.done);
  const fit = series.length >= 7 && series.some((c) => c > 0) ? trend(series) : null;
  if (fit) {
    const a = Math.max(0, fit.intercept);
    const b = Math.max(0, fit.intercept + fit.slope * (series.length - 1));
    const change = (b - a) / Math.max(mean(series), 0.5);
    momentum = {
      points,
      average: movingAverage(series, period === "year" ? 4 : 7),
      from: round1(a),
      to: round1(b),
      unit: period === "year" ? "week" : "day",
      change,
      label: change > 0.15 ? "Rising" : change < -0.15 ? "Slowing" : "Steady",
    };
  }

  // How the days spread: a count of days for each number done, the middle half, and steadiness 1 / (1 + σ/μ).
  let spread: Insights["spread"] = null;
  const m = mean(counts);
  if (n >= 7 && m > 0) {
    const top = Math.max(...counts);
    const bins = Array.from({ length: top + 1 }, () => 0);
    for (const c of counts) bins[c] += 1;
    const score = 1 / (1 + stdev(counts) / m);
    spread = {
      bins,
      median: median(counts),
      mean: m,
      low: Math.round(quantile(counts, 0.25)),
      high: Math.round(quantile(counts, 0.75)),
      score,
      label: score >= 0.75 ? "Very steady" : score >= 0.6 ? "Steady" : score >= 0.45 ? "Uneven" : "Up and down",
    };
  }

  // The weekdays of the window.
  const week = Array.from({ length: 7 }, (_, index) => ({ index, done: 0, planned: 0, days: 0 }));
  for (const p of window) {
    const w = week[dowIndex(p.date)];
    w.done += p.done;
    w.planned += p.planned;
    w.days += 1;
  }
  const weekdays = week.map((w) => ({ index: w.index, avg: w.days ? w.done / w.days : 0, rate: w.planned ? w.done / w.planned : null, days: w.days }));

  // Plan against done: each day as a point, and the share of what's planned that gets done (a line through the origin,
  // least squares). A realistic day is what three days in four reach.
  let plan: Insights["plan"] = null;
  const plannedDays = window.filter((p) => p.planned > 0);
  const pSum = plannedDays.reduce((s, p) => s + p.planned, 0);
  const dSum = plannedDays.reduce((s, p) => s + p.done, 0);
  if (plannedDays.length >= 5 && dSum > 0) {
    const pairs = new Map<string, { planned: number; done: number; days: number }>();
    for (const p of plannedDays) {
      const k = `${p.planned}:${p.done}`;
      const at = pairs.get(k);
      if (at) at.days += 1;
      else pairs.set(k, { planned: p.planned, done: p.done, days: 1 });
    }
    const share = plannedDays.reduce((s, p) => s + p.planned * p.done, 0) / plannedDays.reduce((s, p) => s + p.planned * p.planned, 0);
    plan = {
      dots: [...pairs.values()],
      share,
      ratio: pSum / dSum,
      realistic: Math.max(1, Math.round(quantile(plannedDays.map((p) => p.done), 0.75))),
      max: Math.max(...plannedDays.map((p) => p.planned)),
    };
  }

  // The typical day: the median over days that had something planned (an empty day isn't a typical one).
  const best = days.reduce<DayStat | null>((b, d) => (d.elapsed && d.done > (b?.done ?? 0) ? d : b), null);
  const typical: Insights["typical"] = plannedDays.length ? { median: median(plannedDays.map((p) => p.done)), best } : best ? { median: 0, best } : null;

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

  return { days: n, window: label, burn, rank, momentum, spread, weekdays, plan, typical, streak: { current, longest } };
}

/** Days → weeks (sums, oldest first; a last, unfinished week is left out), each named by its first day. */
function weekly(days: Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 0; i + 7 <= days.length; i += 7) {
    const w = days.slice(i, i + 7);
    out.push({ key: w[0].key, date: w[0].date, done: w.reduce((s, p) => s + p.done, 0), planned: w.reduce((s, p) => s + p.planned, 0) });
  }
  return out;
}
