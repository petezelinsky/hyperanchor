import { addDays, dowIndex, parseYmd, startOfWeek, ymd } from "./dates";

/**
 * Natural-language dates for quick add: "Call mom tomorrow", "Report fri", "Plan next monday",
 * "Dentist oct 28", "Review in 3 days". The date phrase must be at the end of the text
 * (today / tomorrow may also lead). Returns the title without the phrase.
 */
export type Parsed = { title: string; date: string | null; phrase: string | null };

const WEEKDAYS: Record<string, number> = {
  monday: 0, mon: 0,
  tuesday: 1, tues: 1, tue: 1,
  wednesday: 2, weds: 2, wed: 2,
  thursday: 3, thurs: 3, thur: 3, thu: 3,
  friday: 4, fri: 4,
  saturday: 5, sat: 5,
  sunday: 6, sun: 6,
};
// Short forms that are also ordinary words only count after "on" / "this" / "next" / "by" / "due".
const AMBIGUOUS = new Set(["sat", "sun"]);

const MONTHS: Record<string, number> = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3, may: 4, june: 5, jun: 5,
  july: 6, jul: 6, august: 7, aug: 7, september: 8, sept: 8, sep: 8, october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
};

const WD = Object.keys(WEEKDAYS).join("|");
const MO = Object.keys(MONTHS).join("|");
const PREP = "(?:(on|this|next|by|due)\\s+)?";

type Rule = { re: RegExp; resolve: (m: RegExpMatchArray, today: Date) => Date | null };

const RULES: Rule[] = [
  { re: /(?:^|\s)(?:on\s+|by\s+|due\s+)?(today|tonight)$/i, resolve: (_, t) => t },
  { re: /(?:^|\s)(?:on\s+|by\s+|due\s+)?(tomorrow|tmrw|tmr)$/i, resolve: (_, t) => addDays(t, 1) },
  { re: /(?:^|\s)(?:on\s+)?(?:the\s+)?(weekend)$/i, resolve: (_, t) => (dowIndex(t) >= 5 ? t : addDays(startOfWeek(t), 5)) },
  { re: /(?:^|\s)(next\s+week)$/i, resolve: (_, t) => addDays(startOfWeek(t), 7) },
  {
    re: /(?:^|\s)in\s+(\d{1,3})\s+(days?|d|weeks?|w)$/i,
    resolve: (m, t) => addDays(t, Number(m[1]) * (/^w/i.test(m[2]) ? 7 : 1)),
  },
  {
    re: new RegExp(`(?:^|\\s)${PREP}(${WD})$`, "i"),
    resolve: (m, t) => {
      const prep = m[1]?.toLowerCase();
      const word = m[2].toLowerCase();
      if (AMBIGUOUS.has(word) && !prep) return null;
      const idx = WEEKDAYS[word];
      if (prep === "next") return addDays(startOfWeek(t), 7 + idx);
      return addDays(t, (idx - dowIndex(t) + 7) % 7);
    },
  },
  {
    re: new RegExp(`(?:^|\\s)(?:on\\s+|by\\s+|due\\s+)?(${MO})\\s+(\\d{1,2})(?:st|nd|rd|th)?$`, "i"),
    resolve: (m, t) => monthDay(MONTHS[m[1].toLowerCase()], Number(m[2]), t),
  },
  {
    re: new RegExp(`(?:^|\\s)(?:on\\s+|by\\s+|due\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MO})$`, "i"),
    resolve: (m, t) => monthDay(MONTHS[m[2].toLowerCase()], Number(m[1]), t),
  },
  {
    re: /(?:^|\s)(?:on\s+|by\s+|due\s+)?(\d{4})-(\d{2})-(\d{2})$/i,
    resolve: (m) => validDate(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
  },
];

const LEADING = /^(today|tomorrow|tmrw|tmr)\s+/i;

function validDate(y: number, m: number, d: number) {
  const date = new Date(y, m, d);
  return date.getFullYear() === y && date.getMonth() === m && date.getDate() === d ? date : null;
}

/** The next such day: this year, or next year if it has already passed. */
function monthDay(month: number, day: number, today: Date) {
  const date = validDate(today.getFullYear(), month, day);
  if (!date) return null;
  return date < today ? validDate(today.getFullYear() + 1, month, day) : date;
}

export function parseTaskInput(input: string, todayKey: string): Parsed {
  const text = input.replace(/\s+/g, " ").trim();
  const today = parseYmd(todayKey);

  for (const rule of RULES) {
    const m = text.match(rule.re);
    if (!m || m.index === undefined) continue;
    const date = rule.resolve(m, today);
    if (!date) continue;
    const title = text.slice(0, m.index).trim();
    if (!title) break; // only a date phrase: keep it as the title
    return { title, date: ymd(date), phrase: m[0].trim() };
  }

  const lead = text.match(LEADING);
  if (lead) {
    const title = text.slice(lead[0].length).trim();
    const word = lead[1].toLowerCase();
    if (title) return { title, date: ymd(word === "today" ? today : addDays(today, 1)), phrase: lead[1] };
  }

  return { title: text, date: null, phrase: null };
}
