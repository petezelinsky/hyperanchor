"use client";

import { useState } from "react";
import { statsPeriod, type StatsRange } from "@/lib/analytics";
import { ORANGE } from "@/lib/colors";
import { DOW, DOW_FULL, MONTHS, addDays, dayDiff, dowIndex, parseYmd, ymd } from "@/lib/dates";
import type { Task } from "@/lib/types";

const NOT_DONE = "rgba(30,30,33,0.09)";
const short = (d: Date) => `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;

type Day = { d: Date; key: string; tasks: Task[]; done: number; total: number; future: boolean; isToday: boolean };

export function AnalyticsView({
  range,
  offset,
  todayKey,
  byDate,
  onRange,
  onOffset,
  onPick,
}: {
  range: StatsRange;
  offset: number;
  todayKey: string;
  byDate: (key: string) => Task[];
  onRange: (r: StatsRange) => void;
  onOffset: (o: number) => void;
  onPick: (key: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const month = range === "month";
  const current = offset === 0;
  const { start, days: n, end } = statsPeriod(range, offset, todayKey);

  const days: Day[] = Array.from({ length: n }, (_, i) => {
    const d = addDays(start, i);
    const key = ymd(d);
    const future = key > todayKey;
    const tasks = future ? [] : byDate(key);
    const done = tasks.filter((t) => t.done).length;
    return { d, key, tasks, done, total: tasks.length, future, isToday: key === todayKey };
  });
  const elapsed = days.filter((x) => !x.future);
  const totalDone = elapsed.reduce((a, x) => a + x.done, 0);
  const scale = Math.max(4, ...days.map((x) => x.total));
  const best = elapsed.reduce<Day | null>((a, x) => (x.done > (a?.done ?? 0) ? x : a), null);
  const avg = elapsed.length ? totalDone / elapsed.length : 0;

  const periodName = month
    ? `${MONTHS[start.getMonth()]} ${start.getFullYear()}`
    : start.getMonth() === end.getMonth()
      ? `${MONTHS[start.getMonth()]} ${start.getDate()} — ${end.getDate()}`
      : `${short(start)} — ${short(end)}`;
  const label = `${month ? (current ? "This month" : "Month") : current ? "This week" : "Week"} — ${periodName}`;
  const summary = totalDone
    ? `${avg.toFixed(1).replace(/\.0$/, "")} per day on average` +
      (best ? ` · Best day: ${DOW_FULL[dowIndex(best.d)]}, ${short(best.d)}` : "")
    : "Nothing completed yet";

  const history = elapsed.filter((x) => x.total).reverse();
  const today = parseYmd(todayKey);
  const histDate = (d: Date) => {
    const diff = dayDiff(today, d);
    return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : `${DOW_FULL[dowIndex(d)].slice(0, 3)}, ${short(d)}`;
  };

  const seg = (on: boolean) => `h-9 rounded-full px-3.5 ${on ? "bg-white text-ink" : "bg-transparent text-muted-2"}`;
  const navBtn = "rounded-full bg-transparent font-mono text-ink transition-colors duration-150 hover:bg-white";
  const gap = month ? "gap-0.5 sm:gap-1" : "gap-2 sm:gap-3.5";
  const cols = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` };

  return (
    <main className="mx-auto max-w-[1040px] px-4 pt-2 pb-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4 px-2 pt-6 pb-7">
        <div>
          <div className="mono text-[11px] text-muted-2">{label}</div>
          <h1 className="mt-3 text-[clamp(36px,5vw,56px)] leading-[1.04] font-medium tracking-[-0.035em]">{totalDone} done</h1>
          <p className="mt-3 text-sm text-muted">{summary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="mono flex h-11 items-center gap-0.5 rounded-full bg-white/60 p-1 text-[11px]">
            <button type="button" aria-pressed={!month} onClick={() => onRange("week")} className={seg(!month)}>
              Week
            </button>
            <button type="button" aria-pressed={month} onClick={() => onRange("month")} className={seg(month)}>
              Month
            </button>
          </div>
          <div className="flex h-11 items-center gap-1 rounded-full bg-white/60 p-1">
            <button type="button" aria-label="Previous period" onClick={() => onOffset(offset - 1)} className={`${navBtn} size-9 text-[13px]`}>
              ←
            </button>
            {!current && (
              <button type="button" onClick={() => onOffset(0)} className={`${navBtn} mono h-9 px-3.5 text-[11px] whitespace-nowrap`}>
                {month ? "This month" : "This week"}
              </button>
            )}
            <button
              type="button"
              aria-label="Next period"
              disabled={current}
              onClick={() => onOffset(Math.min(0, offset + 1))}
              className={`${navBtn} size-9 text-[13px] disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent`}
            >
              →
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[30px] bg-white/60 px-4 pt-6 pb-5 shadow-card sm:px-7 sm:pt-7">
        <div className="mono flex items-center justify-between gap-3 text-[11px] text-muted-2">
          <span>Done per day</span>
          <span className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] bg-primary" />
              Done
            </span>
            <span className="flex items-center gap-1.5 text-muted-3">
              <span className="size-2.5 rounded-[3px]" style={{ background: NOT_DONE }} />
              Not done
            </span>
          </span>
        </div>

        <div className="relative mt-5 h-[260px]">
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-[#DCDCD8]" />
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-[#E4E4E0]" />
          <div className="absolute inset-x-0 bottom-0 border-t border-dash" />
          <div className={`relative grid h-full items-end ${gap}`} style={cols}>
            {days.map((x, i) => {
              const isHov = hover === x.key;
              const showPop = isHov && x.total > 0;
              const dim = hover && !isHov ? 0.4 : 1;
              const edge = i < n * 0.3 ? "left-0" : i > n * 0.7 ? "right-0" : "left-1/2 -translate-x-1/2";
              return (
                <div
                  key={x.key}
                  onMouseEnter={() => !x.future && setHover(x.key)}
                  onMouseLeave={() => setHover((h) => (h === x.key ? null : h))}
                  className={`relative flex h-full transition-colors duration-150 ${month ? "-mx-0.5 rounded-lg px-0.5" : "-mx-[7px] rounded-2xl px-[7px]"} ${showPop ? "z-30" : ""}`}
                  style={{ background: isHov && !x.future ? "rgba(255,255,255,0.85)" : "transparent" }}
                >
                  <button
                    type="button"
                    onClick={() => onPick(x.key)}
                    aria-label={`${DOW_FULL[dowIndex(x.d)]}, ${short(x.d)}: ${x.done} of ${x.total} done`}
                    className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2 bg-transparent p-0 transition-opacity duration-150"
                    style={{ opacity: dim }}
                  >
                    <span className={`font-mono ${month ? "text-[10px]" : "text-xs"} ${x.isToday ? "text-ink" : "text-muted"}`}>{x.done || ""}</span>
                    <span
                      className={`flex w-full flex-col gap-0.5 overflow-hidden transition-[height] duration-300 ease-in-out ${month ? "max-w-[22px] rounded-md" : "max-w-16 rounded-[14px]"}`}
                      style={{
                        height: x.total ? `${Math.round((x.total / scale) * 100)}%` : "0%",
                        minHeight: x.future ? 0 : 4,
                        background: !x.future && !x.total ? "#E1E1DD" : "transparent",
                      }}
                    >
                      <span className="min-h-0" style={{ flex: x.total - x.done, background: NOT_DONE }} />
                      <span className="min-h-0" style={{ flex: x.done, background: x.isToday ? ORANGE : "#2A2A2E" }} />
                    </span>
                  </button>
                  {showPop && (
                    <div
                      className={`pointer-events-none absolute bottom-[calc(100%+8px)] w-[280px] max-w-[80vw] rounded-[22px] bg-dropdown p-[18px] shadow-dropdown ${edge}`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="mono text-[11px] text-muted-2">
                          {DOW_FULL[dowIndex(x.d)].slice(0, 3)} — {short(x.d)}
                        </span>
                        <span className="font-mono text-[11px] tracking-[0.06em] text-muted-3">
                          {x.done}/{x.total}
                        </span>
                      </div>
                      <div className="mt-3.5 flex flex-col gap-2">
                        {[...x.tasks]
                          .sort((a, b) => Number(b.done) - Number(a.done))
                          .map((t) => (
                            <TaskLine key={t.id} task={t} accent={x.isToday} className="text-sm leading-[1.35]" truncate />
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className={`mt-3 grid ${gap}`} style={cols}>
          {days.map((x, i) => (
            <div
              key={x.key}
              className="flex flex-col items-center gap-[3px] transition-opacity duration-150"
              style={{
                opacity: hover && hover !== x.key ? 0.4 : 1,
                color: x.future ? "#BDBDC1" : x.isToday || hover === x.key ? "#1E1E21" : "#6B6B70",
              }}
            >
              <span className="h-3 font-mono text-[9.5px] tracking-[0.08em] opacity-75 max-sm:text-[8px] max-sm:tracking-normal">
                {month ? (dowIndex(x.d) === 0 ? "MON" : "") : DOW[i]}
              </span>
              <span className={`${month ? "text-[11px] max-sm:text-[9px]" : "text-sm"} ${x.isToday ? "font-semibold" : "font-medium"}`}>
                {x.d.getDate()}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 px-2">
        <div className="mono text-[11px] text-muted-2">History</div>
        <div className="mt-3 flex flex-col">
          {history.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => onPick(x.key)}
              className="grid w-full grid-cols-[76px_minmax(0,1fr)_auto] items-baseline gap-3 border-t border-[rgba(30,30,33,0.07)] bg-transparent py-3.5 text-left text-ink transition-opacity duration-150 hover:opacity-75 sm:grid-cols-[110px_minmax(0,1fr)_auto] sm:gap-5"
            >
              <span className="text-[13px] text-muted-2">{histDate(x.d)}</span>
              <span className="flex min-w-0 flex-wrap gap-x-[18px] gap-y-1">
                {[...x.tasks]
                  .sort((a, b) => Number(b.done) - Number(a.done))
                  .map((t) => (
                    <TaskLine key={t.id} task={t} className="inline-flex text-sm leading-[1.4]" />
                  ))}
              </span>
              <span className="font-mono text-[11px] tracking-[0.06em] whitespace-nowrap text-muted-3">
                {x.done}/{x.total}
              </span>
            </button>
          ))}
          {!history.length && <div className="pt-5 pb-4 text-[15px] text-muted-2">Nothing here yet.</div>}
        </div>
      </div>
    </main>
  );
}

/** One task as a dot + title: done in ink with a filled dot (orange for today), not done faint with a hollow dot. */
function TaskLine({ task, accent = false, truncate = false, className = "" }: { task: Task; accent?: boolean; truncate?: boolean; className?: string }) {
  const dot = task.done ? (accent ? ORANGE : "#1E1E21") : "#C9C9C5";
  return (
    <span className={`flex items-center gap-[7px] ${className}`} style={{ color: task.done ? "#1E1E21" : "#B4B4B8" }}>
      <span className="size-[5px] flex-none rounded-full" style={{ background: task.done ? dot : "transparent", boxShadow: `inset 0 0 0 1px ${dot}` }} />
      <span className={truncate ? "min-w-0 truncate" : "min-w-0 wrap-anywhere"}>{task.title}</span>
    </span>
  );
}
