export const DOW = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
export const DOW_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Local date → YYYY-MM-DD. */
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseYmd(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Monday of the week containing `d`. */
export function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Monday-first index 0..6. */
export const dowIndex = (d: Date) => (d.getDay() + 6) % 7;

export const dayDiff = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 864e5);

/** First and last visible date of the Monday-first month grid. */
export function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = startOfWeek(first);
  const rows = Math.ceil((dayDiff(last, start) + 1) / 7);
  return { start, rows, end: addDays(start, rows * 7 - 1) };
}

export const plural = (n: number, w: string) => `${n} ${n === 1 ? w : w + "s"}`;

export const DOW_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

/** "Thursday, October 23" */
export const formatLong = (d: Date) => `${DOW_FULL[dowIndex(d)]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
/** "Thu, Oct 23" */
export const formatMedium = (d: Date) => `${DOW_SHORT[dowIndex(d)]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
/** "Oct 23" */
export const formatShort = (d: Date) => `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;

/** "Today" / "Tomorrow" / "Yesterday", otherwise null. */
export function relativeDay(key: string, todayKey: string) {
  const diff = dayDiff(parseYmd(key), parseYmd(todayKey));
  return diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : null;
}

/** "October 20 – 26, 2026", "Sep 29 – Oct 5, 2026" or "Dec 29, 2025 – Jan 4, 2026". */
export function rangeLabel(start: Date, end: Date) {
  if (start.getFullYear() !== end.getFullYear())
    return `${formatShort(start)}, ${start.getFullYear()} – ${formatShort(end)}, ${end.getFullYear()}`;
  if (start.getMonth() !== end.getMonth()) return `${formatShort(start)} – ${formatShort(end)}, ${end.getFullYear()}`;
  return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
}

/** Time for today ("9:41 AM"), otherwise a short date ("Oct 21"), for timestamps like createdAt. */
export function formatStamp(iso: string, todayKey: string) {
  const d = new Date(iso);
  if (ymd(d) === todayKey) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return formatShort(d);
}

/** ISO 8601 week number. */
export function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3); // Thursday of this week
  const jan4 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round((dayDiff(t, jan4) - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}

/** Compact span for labels: "19–25 Oct 2026", "29 Sep – 5 Oct 2026", "29 Dec 2025 – 4 Jan 2026". */
export function spanLabel(start: Date, end: Date) {
  const m = (d: Date) => MONTHS_SHORT[d.getMonth()];
  if (start.getFullYear() !== end.getFullYear()) return `${start.getDate()} ${m(start)} ${start.getFullYear()} – ${end.getDate()} ${m(end)} ${end.getFullYear()}`;
  if (start.getMonth() !== end.getMonth()) return `${start.getDate()} ${m(start)} – ${end.getDate()} ${m(end)} ${end.getFullYear()}`;
  return `${start.getDate()}–${end.getDate()} ${m(end)} ${end.getFullYear()}`;
}
