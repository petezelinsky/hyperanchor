/**
 * The words dates are written with, in one language: the weekdays (by Date.getDay(): 0 = Sunday) and the months, each
 * month three ways: on its own as a heading ("November"), inside a date ("November 11", "11 ноября", "11 listopada"),
 * and short ("Nov"). English is what the app starts with (and what the iOS parity fixtures are made in); the language
 * chosen in Settings swaps the set (`setDateLocale`). This file stays free of imports: scripts/ios-fixtures.mjs runs it
 * on its own.
 */
type DateWords = {
  days: string[];
  daysShort: string[];
  daysLetter: string[];
  months: string[];
  monthsIn: string[];
  /** Short, inside a date ("11 мая") and on its own (an axis: "май"). */
  monthsShort: string[];
  monthsShortAlone: string[];
  /** The day comes before the month: "11 November". */
  dayFirst: boolean;
  today: string;
  tomorrow: string;
  yesterday: string;
  /** The locale clock times are written in. */
  tag: string;
};

const EN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const EN: DateWords = {
  days: EN_DAYS,
  daysShort: EN_DAYS.map((d) => d.slice(0, 3)),
  daysLetter: EN_DAYS.map((d) => d[0]),
  months: EN_MONTHS,
  monthsIn: EN_MONTHS,
  monthsShort: EN_MONTHS.map((m) => m.slice(0, 3)),
  monthsShortAlone: EN_MONTHS.map((m) => m.slice(0, 3)),
  dayFirst: false,
  today: "Today",
  tomorrow: "Tomorrow",
  yesterday: "Yesterday",
  tag: "en-US",
};
const RU_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const RU: DateWords = {
  days: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"],
  daysShort: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
  daysLetter: ["В", "П", "В", "С", "Ч", "П", "С"],
  months: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
  monthsIn: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
  monthsShort: RU_SHORT,
  monthsShortAlone: RU_SHORT.map((m) => (m === "мая" ? "май" : m)),
  dayFirst: true,
  today: "Сегодня",
  tomorrow: "Завтра",
  yesterday: "Вчера",
  tag: "ru-RU",
};
const PL_SHORT = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
const PL: DateWords = {
  days: ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"],
  daysShort: ["Niedz", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"],
  daysLetter: ["N", "P", "W", "Ś", "C", "P", "S"],
  months: ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"],
  monthsIn: ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"],
  monthsShort: PL_SHORT,
  monthsShortAlone: PL_SHORT,
  dayFirst: true,
  today: "Dzisiaj",
  tomorrow: "Jutro",
  yesterday: "Wczoraj",
  tag: "pl-PL",
};
const WORDS: Record<string, DateWords> = { en: EN, ru: RU, pl: PL };
let W = EN;

/** The months on their own, as headings ("November 2026"), in the language on screen. */
export const MONTHS = [...EN.months];
/** The months short and on their own (an axis of a chart). */
export const MONTHS_SHORT = [...EN.monthsShortAlone];

/** Switches the words dates are written with ("en", "ru", "pl"). The lists above change in place. */
export function setDateLocale(lang: string) {
  W = WORDS[lang] ?? EN;
  MONTHS.splice(0, 12, ...W.months);
  MONTHS_SHORT.splice(0, 12, ...W.monthsShortAlone);
}

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
  Array.from({ length: 7 }, (_, i) => (form === "full" ? W.days : form === "short" ? W.daysShort : W.daysLetter)[(i + weekStart) % 7]);

/** "Thursday" */
export const dayName = (d: Date) => W.days[d.getDay()];
/** "Thu" */
export const dayShort = (d: Date) => W.daysShort[d.getDay()];
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

/** A day of a month, the way the language orders them: "October 23" / "23 октября". */
const dayOf = (d: Date, months: string[]) => (W.dayFirst ? `${d.getDate()} ${months[d.getMonth()]}` : `${months[d.getMonth()]} ${d.getDate()}`);

/** "Thursday, October 23" */
export const formatLong = (d: Date) => `${dayName(d)}, ${dayOf(d, W.monthsIn)}`;
/** "Thu, Oct 23" */
export const formatMedium = (d: Date) => `${dayShort(d)}, ${dayOf(d, W.monthsShort)}`;
/** "Oct 23" */
export const formatShort = (d: Date) => dayOf(d, W.monthsShort);
/** "October 23" */
export const formatDayMonth = (d: Date) => dayOf(d, W.monthsIn);
/** A date as it stands inside a sentence: English keeps its capitals ("to Wed, Nov 11"), the others don't ("на ср, 11 ноя"). */
export const midSentence = (s: string) => (W === EN ? s : s.charAt(0).toLowerCase() + s.slice(1));
/** A date's year, set after it: ", 2025" / " 2025". */
export const yearAfter = (y: number) => (W.dayFirst ? ` ${y}` : `, ${y}`);

/** "Today" / "Tomorrow" / "Yesterday", otherwise null. */
export function relativeDay(key: string, todayKey: string) {
  const diff = dayDiff(parseYmd(key), parseYmd(todayKey));
  return diff === 0 ? W.today : diff === 1 ? W.tomorrow : diff === -1 ? W.yesterday : null;
}

/** "October 20 – 26, 2026", "Sep 29 – Oct 5, 2026" or "Dec 29, 2025 – Jan 4, 2026". */
export function rangeLabel(start: Date, end: Date) {
  if (start.getFullYear() !== end.getFullYear())
    return `${formatShort(start)}${yearAfter(start.getFullYear())} – ${formatShort(end)}${yearAfter(end.getFullYear())}`;
  if (start.getMonth() !== end.getMonth()) return `${formatShort(start)} – ${formatShort(end)}${yearAfter(end.getFullYear())}`;
  if (W.dayFirst) return `${start.getDate()} – ${end.getDate()} ${W.monthsIn[start.getMonth()]} ${end.getFullYear()}`;
  return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
}

/** A week (or any few days) in brief: "Nov 9 – 15", "Oct 26 – Nov 1", with the year when it isn't this one. */
export function shortRange(start: Date, end: Date, thisYear: number) {
  const year = end.getFullYear() !== thisYear ? yearAfter(end.getFullYear()) : "";
  if (start.getMonth() !== end.getMonth() || start.getFullYear() !== end.getFullYear()) return `${formatShort(start)} – ${formatShort(end)}${year}`;
  if (W.dayFirst) return `${start.getDate()} – ${end.getDate()} ${W.monthsShort[start.getMonth()]}${year}`;
  return `${W.monthsShort[start.getMonth()]} ${start.getDate()} – ${end.getDate()}${year}`;
}

/** A clock time the way the language writes it: "9:41 AM" / "9:41". */
export const formatTime = (d: Date) => d.toLocaleTimeString(W.tag, { hour: "numeric", minute: "2-digit" });

/** Time for today ("9:41 AM"), otherwise a short date ("Oct 21"), for timestamps like createdAt. */
export function formatStamp(iso: string, todayKey: string) {
  const d = new Date(iso);
  if (ymd(d) === todayKey) return formatTime(d);
  return formatShort(d);
}
