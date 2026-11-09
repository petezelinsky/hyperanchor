// Weekday names by Date.getDay() (0 = Sunday).
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = DAY_FULL.map((d) => d.slice(0, 3));
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Local date → YYYY-MM-DD. */
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseYmd(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** The day weeks start on everywhere in the app: 1 = Monday (the default) or 0 = Sunday, chosen in Settings. */
export type WeekStart = 0 | 1;
let weekStart: WeekStart = 1;
export function setWeekStart(w: WeekStart) {
  weekStart = w;
}

/** The first day of the week containing `d`. */
export function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - dowIndex(x));
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Position of `d` in its week, 0..6, counting from the first day of the week. */
export const dowIndex = (d: Date) => (d.getDay() - weekStart + 7) % 7;

/** Weekday names in week order: "Monday" / "Mon" / "M", … */
export const weekdayNames = (form: "full" | "short" | "letter") =>
  Array.from({ length: 7 }, (_, i) => {
    const name = DAY_FULL[(i + weekStart) % 7];
    return form === "full" ? name : form === "short" ? name.slice(0, 3) : name[0];
  });

/** "Thursday" */
export const dayName = (d: Date) => DAY_FULL[d.getDay()];
/** "Thu" */
export const dayShort = (d: Date) => DAY_SHORT[d.getDay()];
export const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

export const dayDiff = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 864e5);

/** First and last visible date of the month grid (whole weeks). */
export function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = startOfWeek(first);
  const rows = Math.ceil((dayDiff(last, start) + 1) / 7);
  return { start, rows, end: addDays(start, rows * 7 - 1) };
}

export const plural = (n: number, w: string) => `${n} ${n === 1 ? w : w + "s"}`;

export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

/** "Thursday, October 23" */
export const formatLong = (d: Date) => `${dayName(d)}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
/** "Thu, Oct 23" */
export const formatMedium = (d: Date) => `${dayShort(d)}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
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
