// Runs the web's date, sorting and analytics code (src/lib/*.ts) on a fixed set of tasks and writes the
// results to ios/HyperanchorTests/Fixtures/web-fixtures.json. The iOS unit tests check that the Swift ports
// produce exactly the same numbers and labels. Re-run after changing src/lib/dates.ts, tasks.ts or stats.ts:
//   node scripts/ios-fixtures.mjs

import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const OUT = new URL("ios/HyperanchorTests/Fixtures/web-fixtures.json", root);

// Transpile the TypeScript modules to plain ES modules in a temp folder.
const dir = await mkdtemp(join(tmpdir(), "hyperanchor-fixtures-"));
for (const name of ["dates", "stats", "tasks"]) {
  const src = await readFile(new URL(`src/lib/${name}.ts`, root), "utf8");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  await writeFile(join(dir, `${name}.mjs`), js.replace(/from "\.\/(\w+)"/g, 'from "./$1.mjs"'));
}
const dates = await import(join(dir, "dates.mjs"));
const stats = await import(join(dir, "stats.mjs"));
const tasksLib = await import(join(dir, "tasks.mjs"));
await rm(dir, { recursive: true });

const { addDays, parseYmd, ymd } = dates;

// Deterministic pseudo-random tasks from Dec 2024 through Jan 2027 (mulberry32).
let seed = 20261022;
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const WORDS = ["Plan", "Call", "Write", "Review", "Send", "Book", "Pay", "Read", "Fix", "Draft", "Clean", "Buy"];
const tasks = [];
let n = 0;
for (let d = parseYmd("2024-12-01"); ymd(d) <= "2027-01-31"; d = addDays(d, 1)) {
  const key = ymd(d);
  const count = Math.floor(rand() * 5) - (d.getDay() === 0 ? 1 : 0); // quieter Sundays, some empty days
  for (let i = 0; i < count; i++) {
    n += 1;
    const id = `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    const created = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 8 + i, Math.floor(rand() * 60)));
    tasks.push({
      id,
      date: key,
      title: `${WORDS[Math.floor(rand() * WORDS.length)]} ${n}`,
      description: rand() < 0.3 ? "Some notes" : "",
      done: rand() < 0.62,
      createdAt: created.toISOString(),
      updatedAt: created.toISOString(),
    });
  }
}
const byDateMap = new Map();
for (const t of tasksLib.sortTasks(tasks, tasksLib.DEFAULT_SORT)) {
  if (!byDateMap.has(t.date)) byDateMap.set(t.date, []);
  byDateMap.get(t.date).push(t);
}
const byDate = (key) => byDateMap.get(key) ?? [];

// A day with nothing done, to exercise the "streak continues from yesterday" rule.
const quietToday = "2026-03-11";
for (const t of byDate(quietToday)) t.done = false;
// …and a long run of active days before it.
for (let d = parseYmd("2026-02-20"); ymd(d) < quietToday; d = addDays(d, 1)) {
  const list = byDate(ymd(d));
  if (list.length) list[0].done = true;
  else {
    n += 1;
    const t = { id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, date: ymd(d), title: `Filler ${n}`, description: "", done: true, createdAt: `${ymd(d)}T07:00:00.000Z`, updatedAt: `${ymd(d)}T07:00:00.000Z` };
    tasks.push(t);
    byDateMap.set(ymd(d), [t]);
  }
}

const summaryJSON = (s) => ({
  completed: s.completed,
  planned: s.planned,
  rate: s.rate,
  elapsedDays: s.elapsedDays,
  activeDays: s.activeDays,
  avg: s.avg,
  best: s.best?.key ?? null,
  open: s.open.map((o) => o.task.id),
  upcoming: s.upcoming,
});

const scenarios = [];
for (const today of ["2026-10-22", "2026-01-01", quietToday, "2025-12-31"]) {
  for (const period of ["week", "month", "year"]) {
    for (const offset of [0, -1, -2, -13]) {
      const b = stats.periodBounds(period, offset, today);
      const days = stats.dayStats(b, today, byDate);
      const sum = stats.summarize(days);
      scenarios.push({
        today,
        period,
        offset,
        bounds: { start: ymd(b.start), end: ymd(b.end), days: b.days },
        range: stats.statsRange(period, offset, today),
        summary: summaryJSON(sum),
        weekday: stats.weekdayStats(days).map(({ index, done, planned, days, avg, rate }) => ({ index, done, planned, days, avg, rate })),
        months: period === "year" ? stats.monthStats(days).map(({ month, done, planned, rate, activeDays, elapsedDays }) => ({ month, done, planned, rate, activeDays, elapsedDays })) : null,
        longest: stats.longestStreak(days),
        current: stats.currentStreak(today, byDate),
        labels: { avg: stats.fmt1(sum.avg), rate: sum.rate == null ? null : stats.pct(sum.rate) },
      });
    }
  }
}

const dateCases = [];
for (const key of ["2026-10-22", "2026-10-19", "2026-10-25", "2026-01-01", "2025-12-31", "2024-02-29", "2026-03-29", "2027-01-04"]) {
  const d = parseYmd(key);
  dateCases.push({
    key,
    startOfWeek: ymd(dates.startOfWeek(d)),
    dow: dates.dowIndex(d),
    long: dates.formatLong(d),
    medium: dates.formatMedium(d),
    short: dates.formatShort(d),
    relative: dates.relativeDay(key, "2026-10-22"),
    plus40: ymd(addDays(d, 40)),
    minus400: ymd(addDays(d, -400)),
  });
}
const grids = [];
for (const [year, month] of [[2026, 0], [2026, 1], [2026, 2], [2026, 5], [2026, 9], [2026, 11], [2024, 1], [2027, 1]]) {
  const g = dates.monthGrid(year, month);
  grids.push({ year, month: month + 1, start: ymd(g.start), rows: g.rows, end: ymd(g.end) });
}
const ranges = [["2026-10-19", "2026-10-25"], ["2026-09-29", "2026-10-05"], ["2025-12-29", "2026-01-04"]].map(([a, b]) => ({
  start: a,
  end: b,
  label: dates.rangeLabel(parseYmd(a), parseYmd(b)),
}));

const sortSample = [
  ["b", "Zebra", "2026-10-22T09:00:00.000Z"],
  ["a", "apple", "2026-10-22T09:00:00.000Z"],
  ["c", "Éclair", "2026-10-22T08:00:00.000Z"],
  ["d", "eclair", "2026-10-22T10:00:00.000Z"],
  ["e", "banana split", "2026-10-22T07:30:00.000Z"],
  ["f", "zebra", "2026-10-22T06:00:00.000Z"],
].map(([id, title, createdAt]) => ({ id, date: "2026-10-22", title, description: id === "e" ? "Call Mom first" : "", done: false, createdAt, updatedAt: createdAt }));
const SORTS = { orderAdded: { key: "added", dir: "asc" }, newestFirst: { key: "added", dir: "desc" }, nameAscending: { key: "title", dir: "asc" }, nameDescending: { key: "title", dir: "desc" } };
const sorting = Object.fromEntries(Object.entries(SORTS).map(([name, sort]) => [name, tasksLib.sortTasks(sortSample, sort).map((t) => t.id)]));
const matching = ["", "zeb", "MOM", "  apple ", "x"].map((q) => ({ query: q, ids: sortSample.filter((t) => tasksLib.matchesQuery(t, q)).map((t) => t.id) }));

const numbers = {
  niceMax: [0, 3, 4, 4.5, 7, 10, 11, 33, 50, 51, 99, 100, 101, 260].map((v) => [v, stats.niceMax(v)]),
  fmt1: [0, 1, 1.25, 1.05, 0.15, 2.5, 2.25, 3.333, 2.75, 10.05].map((v) => [v, stats.fmt1(v)]),
  pct: [0, 0.285, 0.5, 0.125, 2 / 3, 0.995, 1].map((v) => [v, stats.pct(v)]),
  toFixed0: [0.5, 1.5, 2.5, -0.5, 12.4999, -3.5].map((v) => [v, v.toFixed(0)]),
};

await mkdir(new URL("ios/HyperanchorTests/Fixtures/", root), { recursive: true });
await writeFile(OUT, JSON.stringify({ tasks, scenarios, dates: dateCases, grids, ranges, sortSample, sorting, matching, numbers }));
console.log(`Wrote ${OUT.pathname}: ${tasks.length} tasks, ${scenarios.length} scenarios`);
