"use client";

import { useState } from "react";
import { addDays, formatLong, monthGrid, MONTHS, parseYmd, plural, weekdayNames, ymd } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { useDrag } from "./drag";
import { ArrowRightIcon, PlusIcon, XIcon } from "./icons";
import { MiniMonth } from "./Sidebar";
import { Stepper, ViewHead } from "./Toolbar";
import { Button, Checkbox, IconButton, Popover } from "./ui";

export function MonthView({
  year,
  month,
  selected,
  todayKey,
  byDate,
  onShift,
  onThisMonth,
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
  onThisMonth: () => void;
  onSelectDate: (key: string) => void;
  onOpenDay: (key: string) => void;
  onToggle: (t: Task) => void;
  onCreate: (date: string, title: string) => void;
}) {
  const [pop, setPop] = useState<{ key: string; rect: DOMRect } | null>(null);
  const drag = useDrag();
  const { start, rows } = monthGrid(year, month);
  const cells = Array.from({ length: rows * 7 }, (_, i) => addDays(start, i));
  // Five-week months have taller days: room for a fourth title. A day that would show "+1 more" shows that task instead.
  const fit = rows > 5 ? 3 : 4;
  const shown = (n: number) => (n === fit + 1 ? fit + 1 : Math.min(n, fit));
  const isCurrent = ymd(new Date(year, month, 1)).slice(0, 7) === todayKey.slice(0, 7);
  const todayIndex = (parseYmd(todayKey).getDay() - start.getDay() + 7) % 7;

  return (
    <div className="mx-auto w-full max-w-[1288px] md:px-6">
      <ViewHead
        title={MONTHS[month]}
        soft={year}
        right={
          <Stepper
            prevLabel="Previous month"
            nextLabel="Next month"
            onPrev={() => {
              setPop(null);
              onShift(-1);
            }}
            onNext={() => {
              setPop(null);
              onShift(1);
            }}
            todayLabel={isCurrent ? null : "This month"}
            onToday={() => {
              setPop(null);
              onThisMonth();
            }}
          />
        }
      />

      {/* Phones: the month as numbers (dark where something is still to do), and the chosen day's tasks under it. */}
      <div className="md:hidden">
        <div className="px-2 pt-2 pb-1">
          <MiniMonth large year={year} month={month} selected={selected} todayKey={todayKey} byDate={byDate} onShift={onShift} onSelect={onSelectDate} />
        </div>
        <DayList dateKey={selected} tasks={byDate(selected)} onToggle={onToggle} onCreate={(title) => onCreate(selected, title)} onOpenDay={() => onOpenDay(selected)} />
      </div>

      {/* Computers: the whole month as a grid, the tasks written in the days. */}
      <div className="max-md:hidden">
        <div className="grid grid-cols-7">
          {weekdayNames("short").map((d, i) => (
            <div key={d} className={`flex h-8 items-center px-3 text-caption font-medium ${i ? "border-l border-line" : ""} ${isCurrent && i === todayIndex ? "text-ink" : "text-ink-3"}`}>
              {d}
            </div>
          ))}
        </div>
        {/* The weeks share the screen's height, so the month always fills the work area. */}
        <div
          key={`${year}-${month}`}
          role="grid"
          aria-label={`${MONTHS[month]} ${year}`}
          style={{ "--weeks": rows } as React.CSSProperties}
          className="grid min-h-[calc(100dvh-173px)] animate-[fade_var(--duration-fast)_var(--ease-out)_both] grid-cols-7 [grid-template-rows:repeat(var(--weeks),minmax(104px,1fr))]"
        >
          {cells.map((d, i) => {
            const key = ymd(d);
            const tasks = byDate(key);
            // What's left first, then what's done.
            const ordered = [...tasks.filter((t) => !t.done), ...tasks.filter((t) => t.done)];
            const out = d.getMonth() !== month;
            const isToday = key === todayKey;
            const isSel = key === selected;
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
                className={`flex min-w-0 flex-col gap-[3px] overflow-hidden border-t border-line px-3 py-2 text-left transition-[background-color,box-shadow] duration-(--duration-fast) ${i % 7 ? "border-l" : ""} ${
                  hot ? "bg-accent-soft outline -outline-offset-1 outline-accent" : isSel && !isToday ? "bg-surface-3" : out ? "bg-surface-2 hover:bg-surface-3" : "hover:bg-surface-2"
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
    </div>
  );
}

/** Phones: the chosen day under the month — its tasks to tick off, a line to add one, and the way into the day. */
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
  const [title, setTitle] = useState("");
  const d = parseYmd(dateKey);
  const done = tasks.filter((t) => t.done).length;
  return (
    <div>
      <div className="flex h-10 items-center justify-between bg-surface-2 px-4 shadow-[inset_0_-1px_0_var(--line),inset_0_1px_0_var(--line)]">
        <button type="button" onClick={onOpenDay} className="tap relative flex items-center gap-1.5 text-footnote font-semibold">
          {formatLong(d)}
          <ArrowRightIcon size={12} strokeWidth={2} className="text-ink-3" />
        </button>
        <span className="tabular text-caption text-ink-3">{tasks.length ? `${done} of ${tasks.length}` : ""}</span>
      </div>
      <form
        className="relative flex h-[50px] items-center gap-3 px-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onCreate(title.trim());
          setTitle("");
        }}
      >
        <span className="flex size-[18px] flex-none items-center justify-center rounded-[6px] bg-surface-2 text-ink-2 shadow-ring-line">
          <PlusIcon size={12} strokeWidth={2} />
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task"
          aria-label={`New task on ${formatLong(d)}`}
          maxLength={500}
          enterKeyHint="done"
          className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-3"
        />
        <span aria-hidden="true" className="absolute right-4 bottom-0 left-[46px] h-px bg-line" />
      </form>
      <ul>
        {tasks.map((t) => (
          <li key={t.id} className="relative flex min-h-[50px] items-center gap-3 px-4 py-2">
            <Checkbox size={18} checked={t.done} onToggle={() => onToggle(t)} label={t.done ? `Mark “${t.title}” as open` : `Mark “${t.title}” as done`} />
            <span className={`min-w-0 flex-1 text-[16px] leading-[22px] break-words transition-colors duration-(--duration-base) ${t.done ? "text-ink-3" : "text-ink"}`}>{t.title}</span>
            <span aria-hidden="true" className="absolute right-4 bottom-0 left-[46px] h-px bg-line" />
          </li>
        ))}
      </ul>
      {!tasks.length && <p className="px-4 pt-3 pl-[46px] text-body text-ink-3">Nothing planned.</p>}
    </div>
  );
}

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
  const [title, setTitle] = useState("");
  const [y, m, dd] = dateKey.split("-").map(Number);
  const d = new Date(y, m - 1, dd);
  const done = tasks.filter((t) => t.done).length;

  return (
    <Popover anchor={rect} onClose={onClose} label={formatLong(d)} className="w-[320px] max-w-[calc(100vw-16px)] p-3.5">
      <div className="flex items-start justify-between gap-3 px-1">
        <div>
          <div className="text-headline font-semibold">{formatLong(d)}</div>
          <div className="tabular text-caption text-ink-3">{tasks.length ? `${done} of ${tasks.length} done` : "No tasks"}</div>
        </div>
        <IconButton label="Close" size="sm" onClick={onClose} className="-mt-0.5 -mr-1">
          <XIcon size={13} />
        </IconButton>
      </div>
      <form
        className="mt-2 flex h-9 items-center gap-2 rounded-sm bg-surface-2 px-3 transition-shadow focus-within:bg-surface focus-within:shadow-ring-accent"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onCreate(title.trim());
          setTitle("");
        }}
      >
        <PlusIcon size={14} className="flex-none text-ink-3" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task"
          aria-label="New task title"
          maxLength={500}
          data-autofocus={tasks.length === 0 ? "" : undefined}
          className="min-w-0 flex-1 bg-transparent text-body outline-none"
        />
      </form>
      {tasks.length > 0 && (
        <ul className="mt-2 max-h-72 overflow-y-auto">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-start gap-2.5 rounded-sm px-1 py-1.5">
              <Checkbox size={18} checked={t.done} onToggle={() => onToggle(t)} label={t.done ? `Mark “${t.title}” as open` : `Mark “${t.title}” as done`} className="mt-0.5" />
              <div className="min-w-0">
                <div className={`text-body break-words transition-colors duration-(--duration-base) ${t.done ? "text-ink-3" : "text-ink"}`}>{t.title}</div>
                {t.description && <div className="truncate text-caption text-ink-3">{t.description}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 -mr-2 flex justify-end">
        <Button size="sm" variant="plain" onClick={onOpenDay} className="gap-1 text-ink!">
          Open day <ArrowRightIcon size={12} />
        </Button>
      </div>
    </Popover>
  );
}
