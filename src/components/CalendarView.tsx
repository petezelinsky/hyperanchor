"use client";

import { useEffect, useState } from "react";
import { GREEN, ORANGE } from "@/lib/colors";
import { DOW, DOW_FULL, MONTHS, addDays, monthGrid, plural, ymd } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { CheckIcon } from "./icons";

const navBtn = "rounded-full bg-transparent font-mono text-ink transition-colors duration-150 hover:bg-white";
const SELECTED_SHADOW = "0 1px 2px rgba(0,0,0,0.04), 0 12px 28px -14px rgba(0,0,0,0.28)";
const POPOVER_SHADOW = "0 1px 2px rgba(0,0,0,0.04), 0 28px 64px -20px rgba(0,0,0,0.3)";

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
  const [open, setOpen] = useState<string | null>(null);
  const { start, rows } = monthGrid(year, month);

  // The popover closes on month change, Esc and clicks outside it (cells handle their own clicks).
  useEffect(() => setOpen(null), [year, month]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    const onDown = (e: PointerEvent) => {
      const el = e.target as Element;
      if (!el.closest?.("[data-cal-pop]") && !el.closest?.("[data-cal-cell]")) setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

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
    return { i, d, key, inMonth, tasks };
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
        {cells.map(({ i, d, key, inMonth, tasks }) => {
          const isToday = key === todayKey;
          const isSel = key === selected;
          const past = key < todayKey;
          const isOpen = open === key && tasks.length > 0;
          return (
            <div key={key} className={`relative flex ${isOpen ? "z-30" : ""}`}>
              <button
                type="button"
                data-cal-cell=""
                onClick={() => (tasks.length ? setOpen((o) => (o === key ? null : key)) : onPick(key))}
                aria-expanded={tasks.length ? isOpen : undefined}
                aria-label={`${MONTHS[d.getMonth()]} ${d.getDate()}${tasks.length ? `, ${plural(tasks.length, "task")}` : ""}`}
                className={`flex min-h-[64px] min-w-0 flex-1 flex-col items-stretch gap-1 rounded-xl p-1.5 text-left text-ink transition-colors duration-150 hover:bg-white sm:min-h-[88px] sm:rounded-[14px] sm:p-2.5 ${
                  isSel || isToday ? "bg-white" : inMonth ? "bg-white/55" : "bg-white/20"
                }`}
                style={{ boxShadow: isSel ? SELECTED_SHADOW : "none" }}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className={`text-sm leading-none font-medium ${inMonth ? (past ? "text-muted-3" : "text-ink") : "text-[#BDBDC1]"}`}>
                    {d.getDate()}
                  </span>
                  {isToday && <span className="size-1.5 flex-none rounded-full bg-todo" />}
                </div>
                <div className="mt-1 flex min-w-0 flex-col gap-1">
                  {tasks.slice(0, 3).map((t) => {
                    const p = previewStyle(t.done, past);
                    return (
                      <div key={t.id} className="flex min-w-0 items-center gap-1.5 text-[11.5px] leading-[1.3]" style={{ color: p.text }}>
                        <span className="size-[5px] flex-none rounded-full" style={{ background: p.dot }} />
                        <span className={`truncate max-sm:hidden ${p.strike ? "line-through" : ""}`}>{t.title}</span>
                      </div>
                    );
                  })}
                  {tasks.length > 3 && (
                    <div className="font-mono text-[10px] tracking-[0.06em] text-faint uppercase max-sm:hidden">+{tasks.length - 3} more</div>
                  )}
                </div>
              </button>
              {isOpen && (
                <DayPopover
                  date={d}
                  tasks={tasks}
                  past={past}
                  // Expands over the cell: upward for the last two rows, right-aligned for Fri–Sun.
                  position={`${Math.floor(i / 7) >= rows - 2 ? "sm:bottom-[-8px]" : "sm:top-[-8px]"} ${i % 7 >= 4 ? "sm:right-[-8px]" : "sm:left-[-8px]"}`}
                  onClose={() => setOpen(null)}
                  onOpenDay={() => {
                    setOpen(null);
                    onPick(key);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

function previewStyle(done: boolean, past: boolean) {
  if (past) return { dot: done ? GREEN : "#D2D2CF", text: done ? "#3A3A3E" : "#A3A3A7", strike: false };
  return { dot: done ? GREEN : ORANGE, text: done ? "#A3A3A7" : "#3A3A3E", strike: done };
}

function DayPopover({
  date,
  tasks,
  past,
  position,
  onClose,
  onOpenDay,
}: {
  date: Date;
  tasks: Task[];
  past: boolean;
  position: string;
  onClose: () => void;
  onOpenDay: () => void;
}) {
  const doneN = tasks.filter((t) => t.done).length;
  const sorted = [...tasks].sort((a, b) => (past ? Number(b.done) - Number(a.done) : Number(a.done) - Number(b.done)));
  return (
    <div
      data-cal-pop=""
      role="dialog"
      aria-label={`${MONTHS[date.getMonth()]} ${date.getDate()}`}
      // On phones the cell is too narrow to anchor a 300px card, so it centers on screen instead.
      className={`fixed inset-x-4 top-1/2 -translate-y-1/2 rounded-[20px] bg-white p-[18px] sm:absolute sm:inset-x-auto sm:top-auto sm:min-h-[calc(100%+16px)] sm:w-[300px] sm:max-w-[80vw] sm:translate-y-0 ${position}`}
      style={{ boxShadow: POPOVER_SHADOW }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-baseline gap-2.5">
          <span className="text-sm leading-none font-medium text-ink">{date.getDate()}</span>
          <span className="mono text-[11px] text-muted-2">
            {DOW_FULL[(date.getDay() + 6) % 7].slice(0, 3)}, {MONTHS[date.getMonth()].slice(0, 3)}
          </span>
        </span>
        <span className="flex items-center gap-2.5">
          <span className="font-mono text-[11px] tracking-[0.06em] text-muted-3">
            {doneN}/{tasks.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-1.5 ml-0 size-7 rounded-full bg-fill text-[15px] leading-none text-ink transition-colors duration-150 hover:bg-fill-hover-2"
          >
            ×
          </button>
        </span>
      </div>
      <div className="mt-3 flex max-h-80 flex-col gap-0.5 overflow-auto">
        {sorted.map((t) => {
          const ring = t.done ? (past ? "#1E1E21" : "#C4C4C8") : past ? "#D2D2CF" : ORANGE;
          const fill = t.done ? (past ? "#1E1E21" : "#C4C4C8") : "transparent";
          const title = past ? (t.done ? "#1E1E21" : "#A3A3A7") : t.done ? "#A3A3A7" : "#1E1E21";
          const desc = past ? (t.done ? "#6B6B70" : "#BDBDC1") : t.done ? "#BDBDC1" : "#8B8B90";
          return (
            <div key={t.id} className="flex items-start gap-2.5 py-2">
              <span
                className="mt-px flex size-4 flex-none items-center justify-center rounded-full border-[1.5px]"
                style={{ borderColor: ring, background: fill }}
              >
                {t.done && <CheckIcon size={8} strokeWidth={1.8} />}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className={`text-sm leading-[1.35] font-medium wrap-anywhere ${!past && t.done ? "line-through" : ""}`}
                  style={{ color: title }}
                >
                  {t.title}
                </div>
                {t.description && (
                  <div className="mt-0.5 truncate text-[12.5px] leading-[1.4]" style={{ color: desc }}>
                    {t.description}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onOpenDay}
        className="mono mt-3.5 flex h-11 w-full items-center justify-center gap-2.5 rounded-full bg-primary text-[11px] text-white shadow-pill-dark-flat transition-colors duration-150 hover:bg-primary-hover"
      >
        <span>Open day</span>
        <span>→</span>
      </button>
    </div>
  );
}
