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
