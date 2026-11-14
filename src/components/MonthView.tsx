"use client";

import { useEffect, useState } from "react";
import { addDays, formatLong, monthGrid, MONTHS, parseYmd, plural, weekdayNames, ymd } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { useDrag } from "./drag";
import { ArrowRightIcon, PlusIcon, XIcon } from "./icons";
import { MiniMonth } from "./Sidebar";
import { Button, Checkbox, IconButton, Popover } from "./ui";

/**
 * The month, from edge to edge of the work area. Computers: the whole month as a grid that fills the height, the tasks
 * written in the days; a click on a day opens it in a small window. Phones: the month as numbers, and the chosen day's
 * tasks under it. Which month it is, and the way to others, is in the bar above.
 */
export function MonthView({
  year,
  month,
  selected,
  todayKey,
  byDate,
  onShift,
  onSelectDate,
  onOpenDay,
  onToggle,
  onCreate,
}: {
  year: number;
  month: number;
  selected: string;
  todayKey: string;
  byDate: (key: string) => Task[];
  onShift: (n: number) => void;
  onSelectDate: (key: string) => void;
  onOpenDay: (key: string) => void;
  onToggle: (t: Task) => void;
  onCreate: (date: string, title: string) => void;
}) {
  const [pop, setPop] = useState<{ key: string; rect: DOMRect } | null>(null);
  // Another month on screen: the day that was open belongs to the last one.
  useEffect(() => setPop(null), [year, month]);
  const drag = useDrag();
  const { start, rows } = monthGrid(year, month);
  const cells = Array.from({ length: rows * 7 }, (_, i) => addDays(start, i));
  // Five-week months have taller days: room for a fourth title. A day that would show "+1 more" shows that task instead.
  const fit = rows > 5 ? 3 : 4;
  const shown = (n: number) => (n === fit + 1 ? fit + 1 : Math.min(n, fit));
  const isCurrent = ymd(new Date(year, month, 1)).slice(0, 7) === todayKey.slice(0, 7);
  const todayIndex = (parseYmd(todayKey).getDay() - start.getDay() + 7) % 7;

  return (
    <>
      {/* Phones: the month as numbers (dark where something is still to do), and the chosen day's tasks under it. */}
      <div className="md:hidden">
        <div className="px-2 pt-2 pb-1">
          <MiniMonth large year={year} month={month} selected={selected} todayKey={todayKey} byDate={byDate} onShift={onShift} onSelect={onSelectDate} />
        </div>
        <DayList dateKey={selected} tasks={byDate(selected)} onToggle={onToggle} onCreate={(title) => onCreate(selected, title)} onOpenDay={() => onOpenDay(selected)} />
      </div>

      {/* Computers: the whole month as a grid, the tasks written in the days. */}
      <div className="@container/month flex min-h-full flex-col max-md:hidden">
        <div className="grid flex-none grid-cols-7 border-b border-line">
          {weekdayNames("short").map((d, i) => (
            <div
              key={d}
              className={`flex h-8 min-w-0 items-center px-3 text-caption font-medium @max-[640px]/month:px-1.5 ${i ? "border-l border-line" : ""} ${
                isCurrent && i === todayIndex ? "text-ink" : "text-ink-3"
              }`}
            >
              {d}
            </div>
          ))}
        </div>
        {/* The weeks share the screen's height, so the month always fills the work area, down to its last line. */}
        <div
          key={`${year}-${month}`}
          role="grid"
          aria-label={`${MONTHS[month]} ${year}`}
          style={{ "--weeks": rows } as React.CSSProperties}
          className="grid flex-1 animate-[fade_var(--duration-fast)_var(--ease-out)_both] grid-cols-7 [grid-template-rows:repeat(var(--weeks),minmax(104px,1fr))]"
        >
          {cells.map((d, i) => {
            const key = ymd(d);
            const tasks = byDate(key);
            // What's left first, then what's done.
            const ordered = [...tasks.filter((t) => !t.done), ...tasks.filter((t) => t.done)];
            const out = d.getMonth() !== month;
            const isToday = key === todayKey;
            const open = pop?.key === key;
            const hot = drag.dragging && drag.target?.zone === "month" && drag.target.date === key;
            return (
              <button
                key={key}
                type="button"
                data-drop-date={key}
                data-drop-zone="month"
                onClick={(e) => {
                  onSelectDate(key);
                  setPop({ key, rect: e.currentTarget.getBoundingClientRect() });
                }}
                onDoubleClick={() => onOpenDay(key)}
                aria-label={`${formatLong(d)}${tasks.length ? `, ${plural(tasks.length, "task")}` : ""}`}
                className={`flex min-w-0 flex-col gap-[3px] overflow-hidden border-line px-3 py-2 text-left transition-[background-color,box-shadow] duration-(--duration-fast) @max-[640px]/month:px-1.5 ${i % 7 ? "border-l" : ""} ${
                  i >= 7 ? "border-t" : ""
                } ${
                  hot
                    ? "bg-accent-soft outline -outline-offset-1 outline-accent"
                    : open
                      ? "bg-surface-3 shadow-[inset_0_0_0_1px_var(--line-2)]"
                      : out
                        ? "bg-surface-2 hover:bg-surface-3"
                        : "hover:bg-surface-2"
                }`}
              >
                <span className="mb-px flex h-6 flex-none items-center">
                  <span
                    data-day-dot={key}
                    className={`tabular flex h-6 items-center justify-center rounded-[7px] text-footnote ${
                      isToday ? "min-w-6 bg-primary px-[5px] font-semibold text-on-primary" : out ? "font-medium text-ink-4" : "font-medium text-ink"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                </span>
                {ordered.slice(0, shown(ordered.length)).map((t) => (
                  // A task can be dragged straight from here onto another day.
                  <span
                    key={t.id}
                    onPointerDown={(e) => drag.start(e, t)}
                    className={`block min-w-0 flex-none cursor-grab truncate text-caption ${drag.dragging?.id === t.id ? "opacity-35" : ""} ${t.done || out ? "text-ink-3" : "text-ink"}`}
                  >
                    {t.title}
                  </span>
                ))}
                {ordered.length > shown(ordered.length) && <span className="flex-none text-caption text-ink-3">+{ordered.length - shown(ordered.length)} more</span>}
              </button>
            );
          })}
        </div>
      </div>

      {pop && (
        <DayPopover
          key={pop.key}
          dateKey={pop.key}
          rect={pop.rect}
          tasks={byDate(pop.key)}
          onClose={() => setPop(null)}
          onToggle={onToggle}
          onCreate={(title) => onCreate(pop.key, title)}
          onOpenDay={() => {
            setPop(null);
            onOpenDay(pop.key);
          }}
        />
      )}
    </>
  );
}

/** The line a new task is written on, above a day's tasks. */
function NewTaskLine({ label, onCreate, autoFocus = false, className = "" }: { label: string; onCreate: (title: string) => void; autoFocus?: boolean; className?: string }) {
  const [title, setTitle] = useState("");
  return (
    <form
      className={`relative flex items-center gap-3 ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onCreate(title.trim());
        setTitle("");
      }}
    >
      <span className="flex size-[18px] flex-none items-center justify-center rounded-[6px] bg-surface-2 text-ink-2 shadow-ring-line">
        <PlusIcon size={12} />
      </span>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New task"
        aria-label={label}
        maxLength={500}
        enterKeyHint="done"
        data-autofocus={autoFocus ? "" : undefined}
        className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-3 md:text-body"
      />
    </form>
  );
}

/** A day's tasks to tick off, each on its own line; long titles wrap. */
function DayTasks({ tasks, onToggle, pad }: { tasks: Task[]; onToggle: (t: Task) => void; pad: string }) {
  return (
    <ul>
      {tasks.map((t) => (
        <li key={t.id} className={`relative flex items-start gap-3 py-[9px] ${pad}`}>
          <Checkbox size={18} checked={t.done} onToggle={() => onToggle(t)} label={t.done ? `Mark “${t.title}” as open` : `Mark “${t.title}” as done`} className="mt-px" />
          <span className={`min-w-0 flex-1 text-[16px] leading-5 break-words transition-colors duration-(--duration-base) md:text-body ${t.done ? "text-ink-3" : "text-ink"}`}>{t.title}</span>
        </li>
      ))}
    </ul>
  );
}

/** Phones: the chosen day under the month — a line to add a task, its tasks to tick off, and the way into the day. */
function DayList({
  dateKey,
  tasks,
  onToggle,
  onCreate,
  onOpenDay,
}: {
  dateKey: string;
  tasks: Task[];
  onToggle: (t: Task) => void;
  onCreate: (title: string) => void;
  onOpenDay: () => void;
}) {
  const d = parseYmd(dateKey);
  const done = tasks.filter((t) => t.done).length;
  return (
    <div>
      <div className="flex h-10 items-center justify-between bg-surface-2 px-4 shadow-[inset_0_-1px_0_var(--line),inset_0_1px_0_var(--line)]">
        <button type="button" onClick={onOpenDay} className="tap relative flex items-center gap-1.5 text-footnote font-semibold">
          {formatLong(d)}
          <ArrowRightIcon size={12} className="text-ink-3" />
        </button>
        <span className="tabular text-caption text-ink-3">{tasks.length ? `${done} of ${tasks.length}` : ""}</span>
      </div>
      <NewTaskLine label={`New task on ${formatLong(d)}`} onCreate={onCreate} className="h-[50px] border-b border-line px-4" />
      <DayTasks tasks={tasks} onToggle={onToggle} pad="px-4" />
      {!tasks.length && <p className="px-4 pt-3 pl-[46px] text-body text-ink-3">Nothing planned.</p>}
    </div>
  );
}

/**
 * Computers: a day of the month, opened in place — its name, a line to add a task, its tasks to tick off, and at the foot
 * how much is done and the way into the day itself.
 */
function DayPopover({
  dateKey,
  rect,
  tasks,
  onClose,
  onToggle,
  onCreate,
  onOpenDay,
}: {
  dateKey: string;
  rect: DOMRect;
  tasks: Task[];
  onClose: () => void;
  onToggle: (t: Task) => void;
  onCreate: (title: string) => void;
  onOpenDay: () => void;
}) {
  const d = parseYmd(dateKey);
  const done = tasks.filter((t) => t.done).length;
  return (
    <Popover anchor={rect} onClose={onClose} label={formatLong(d)} className="flex max-h-[min(80vh,520px)] w-[340px] max-w-[calc(100vw-16px)] flex-col overflow-hidden">
      <div className="flex h-12 flex-none items-center justify-between gap-3 pr-2 pl-4">
        <h2 className="min-w-0 truncate text-callout font-semibold">{formatLong(d)}</h2>
        <IconButton label="Close" size="sm" onClick={onClose}>
          <XIcon size={14} />
        </IconButton>
      </div>
      <NewTaskLine label={`New task on ${formatLong(d)}`} onCreate={onCreate} autoFocus={tasks.length === 0} className="h-11 flex-none border-y border-line px-4" />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
        {tasks.length ? <DayTasks tasks={tasks} onToggle={onToggle} pad="px-4" /> : <p className="px-4 py-3 text-body text-ink-3">Nothing planned.</p>}
      </div>
      <div className="flex h-12 flex-none items-center justify-between gap-3 border-t border-line pr-2.5 pl-4">
        <span className="tabular text-caption text-ink-3">{tasks.length ? `${done} of ${tasks.length} done` : "No tasks"}</span>
        <Button size="sm" onClick={onOpenDay} className="gap-1.5 pr-2">
          Open day
          <ArrowRightIcon size={12} className="text-ink-3" />
        </Button>
      </div>
    </Popover>
  );
}
