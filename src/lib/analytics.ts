import { addDays, parseYmd, startOfWeek, ymd } from "./dates";

export type StatsRange = "week" | "month";

/** First day and length of the analytics period `offset` weeks/months away from today (offset ≤ 0). */
export function statsPeriod(range: StatsRange, offset: number, todayKey: string) {
  const today = parseYmd(todayKey);
  if (range === "month") {
    const start = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    return { start, days, end: addDays(start, days - 1) };
  }
  const start = addDays(startOfWeek(today), offset * 7);
  return { start, days: 7, end: addDays(start, 6) };
}

export const periodRange = (range: StatsRange, offset: number, todayKey: string): [string, string] => {
  const { start, end } = statsPeriod(range, offset, todayKey);
  return [ymd(start), ymd(end)];
};
