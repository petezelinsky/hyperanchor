"use client";

import { DOW, MONTHS, addDays, monthGrid, plural, ymd } from "@/lib/dates";
import type { Task } from "@/lib/types";

const navBtn = "rounded-full bg-transparent font-mono text-ink transition-colors duration-150 hover:bg-white";

export function CalendarView({
  year,
  month,
  selected,
  todayKey,
  byDate,
  onPick,
  onShift,
  onThisMonth,
}: {
  year: number;
  month: number;
  selected: string;
  todayKey: string;
  byDate: (key: string) => Task[];
  onPick: (key: string) => void;
  onShift: (n: number) => void;
  onThisMonth: () => void;
}) {
  const { start, rows } = monthGrid(year, month);
  let total = 0;
  let done = 0;
  const cells = Array.from({ length: rows * 7 }, (_, i) => {
    const d = addDays(start, i);
    const key = ymd(d);
    const inMonth = d.getMonth() === month;
    const tasks = byDate(key);
    if (inMonth) {
      total += tasks.length;
      done += tasks.filter((t) => t.done).length;
    }
    return { d, key, inMonth, tasks };
  });

  return (
    <main className="mx-auto max-w-[1040px] px-4 pt-2 pb-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4 px-2 pt-6 pb-7">
        <div>
          <div className="mono text-[11px] text-muted-2">Calendar — {year}</div>
          <h1 className="mt-3 text-[clamp(36px,5vw,56px)] leading-[1.04] font-medium tracking-[-0.035em]">{MONTHS[month]}</h1>
          <p className="mt-3 text-sm text-muted">{total ? `${plural(total, "task")} · ${done} done` : "No tasks this month"}</p>
        </div>
        <div className="flex h-11 items-center gap-1 rounded-full bg-white/60 p-1">
          <button type="button" aria-label="Previous month" onClick={() => onShift(-1)} className={`${navBtn} size-9 text-[13px]`}>
            ←
          </button>
          <button type="button" onClick={onThisMonth} className={`${navBtn} mono h-9 px-3.5 text-[11px]`}>
            Today
          </button>
          <button type="button" aria-label="Next month" onClick={() => onShift(1)} className={`${navBtn} size-9 text-[13px]`}>
            →
          </button>
        </div>
      </div>

      <div className="mono grid grid-cols-7 gap-1 px-1 pb-2 text-[11px] text-muted-2 sm:gap-1.5 max-sm:text-[9px] max-sm:tracking-normal">
        {DOW.map((d) => (
          <div key={d} className="pl-1 sm:pl-2.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {cells.map(({ d, key, inMonth, tasks }) => {
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(key)}
              aria-label={`${MONTHS[d.getMonth()]} ${d.getDate()}${tasks.length ? `, ${plural(tasks.length, "task")}` : ""}`}
              className={`flex min-h-[64px] min-w-0 flex-col items-stretch gap-1 rounded-xl p-1.5 text-left text-ink transition-colors duration-150 hover:bg-white sm:min-h-[88px] sm:rounded-[14px] sm:p-2.5 ${
                isToday ? "bg-white" : inMonth ? "bg-white/55" : "bg-white/20"
              } ${key === selected ? "shadow-[inset_0_0_0_1.5px_#1E1E21]" : ""}`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span
                  className={`text-sm leading-none font-medium ${
                    inMonth ? (key < todayKey ? "text-muted-3" : "text-ink") : "text-[#BDBDC1]"
                  }`}
                >
                  {d.getDate()}
                </span>
                {isToday && <span className="size-1.5 flex-none rounded-full bg-todo" />}
              </div>
              <div className="mt-1 flex min-w-0 flex-col gap-1">
                {tasks.slice(0, 3).map((t) => (
                  <div key={t.id} className={`flex min-w-0 items-center gap-1.5 text-[11.5px] leading-[1.3] ${t.done ? "text-muted-3" : "text-ink-2"}`}>
                    <span className={`size-[5px] flex-none rounded-full ${t.done ? "bg-done" : "bg-todo"}`} />
                    <span className={`truncate max-sm:hidden ${t.done ? "line-through" : ""}`}>{t.title}</span>
                  </div>
                ))}
                {tasks.length > 3 && (
                  <div className="font-mono text-[10px] tracking-[0.06em] text-faint uppercase max-sm:hidden">+{tasks.length - 3} more</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </main>
  );
}
