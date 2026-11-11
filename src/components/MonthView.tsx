"use client";

import { useState } from "react";
import { addDays, formatLong, isWeekend, monthGrid, MONTHS, plural, weekdayNames, ymd } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { useDrag } from "./drag";
import { ArrowRightIcon, PlusIcon, XIcon } from "./icons";
import { NavGroup, Toolbar } from "./Toolbar";
import { Button, Checkbox, IconButton, Popover, ProgressRing } from "./ui";

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
  const inMonth = cells.filter((d) => d.getMonth() === month).flatMap((d) => byDate(ymd(d)));
  const done = inMonth.filter((t) => t.done).length;
  const isCurrent = ymd(new Date(year, month, 1)).slice(0, 7) === todayKey.slice(0, 7);

  return (
    <>
      <Toolbar
        title={
          <>
            {MONTHS[month]} <span className="font-normal text-ink-3">{year}</span>
          </>
        }
        subtitle={
          inMonth.length ? (
            <>
              <ProgressRing value={done / inMonth.length} size={14} stroke={2.4} />
              <span>
                {done} of {inMonth.length} done
              </span>
            </>
          ) : (
            "No tasks this month"
          )
        }
        wide
      >
        <NavGroup
          prevLabel="Previous month"
          nextLabel="Next month"
          todayLabel="This month"
          onPrev={() => {
            setPop(null);
            onShift(-1);
          }}
          onNext={() => {
            setPop(null);
            onShift(1);
          }}
          onToday={() => {
            setPop(null);
            onThisMonth();
          }}
          todayDisabled={isCurrent}
        />
      </Toolbar>

      <div className="pb-6">
        <div className="grid grid-cols-7 border-y border-line bg-surface-2">
          {weekdayNames("short").map((d, i) => (
            <div key={d} className={`px-2 py-2 text-right text-caption font-medium md:px-3 ${isWeekend(cells[i]) ? "text-ink-3" : "text-ink-2"}`}>
              <span className="sm:hidden">{d[0]}</span>
              <span className="max-sm:hidden">{d}</span>
            </div>
          ))}
        </div>
        {/* On computers the weeks share the screen's height, so the month always fills the sheet. */}
        <div
          key={`${year}-${month}`}
          style={{ "--weeks": rows } as React.CSSProperties}
          className="grid animate-[fade_var(--duration-fast)_var(--ease-out)_both] grid-cols-7 [grid-auto-rows:minmax(76px,auto)] md:min-h-[calc(100dvh-10.5rem)] md:[grid-template-rows:repeat(var(--weeks),minmax(112px,1fr))]"
        >
          {cells.map((d, i) => {
            const key = ymd(d);
            const tasks = byDate(key);
            const out = d.getMonth() !== month;
            const isToday = key === todayKey;
            const isSel = key === selected;
            const weekend = isWeekend(d);
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
                className={`flex min-w-0 flex-col gap-1 border-line p-1.5 text-left transition-[background-color,box-shadow] duration-(--duration-fast) md:p-2 ${i % 7 < 6 ? "border-r" : ""} ${
                  i < cells.length - 7 ? "border-b" : ""
                } ${hot ? "bg-accent-soft outline -outline-offset-1 outline-accent" : isSel ? "bg-surface-3" : weekend ? "bg-surface-2 hover:bg-surface-3" : "hover:bg-surface-2"}`}
              >
                <span className="flex justify-end">
                  {/* Today is the accent; another selected day is black (as in Calendar). */}
                  <span
                    className={`tabular flex size-[26px] items-center justify-center rounded-full text-footnote transition-colors duration-(--duration-fast) ${
                      isToday ? "bg-accent-solid font-semibold text-on-accent" : isSel ? "bg-primary font-semibold text-on-primary" : out ? "text-ink-4" : "text-ink"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                </span>
                <span className="flex min-w-0 flex-col gap-[3px] max-lg:hidden">
                  {tasks.slice(0, shown(tasks.length)).map((t) => (
                    // A task can be dragged straight from here onto another day.
                    <span
                      key={t.id}
                      onPointerDown={(e) => drag.start(e, t)}
                      className={`flex min-w-0 cursor-grab items-center gap-1.5 rounded-xs text-caption ${drag.dragging?.id === t.id ? "opacity-35" : ""} ${
                        t.done ? "text-ink-3" : out ? "text-ink-3" : "text-ink"
                      }`}
                    >
                      <span className={`size-[7px] flex-none rounded-full ${t.done ? "bg-accent" : "border-[1.5px] border-check-ring"}`} />
                      <span className="truncate">{t.title}</span>
                    </span>
                  ))}
                  {tasks.length > shown(tasks.length) && (
                    <span className="pl-3 text-caption font-medium text-ink-3">+{tasks.length - shown(tasks.length)} more</span>
                  )}
                </span>
                {tasks.length > 0 && (
                  <span className="flex flex-wrap justify-end gap-[3px] lg:hidden">
                    {tasks.slice(0, 4).map((t) => (
                      <span key={t.id} className={`size-[5px] rounded-full ${t.done ? "bg-accent" : "bg-ink-4"}`} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {/* Phones and tablets show dots, not titles: say what they mean. */}
        <div className="mt-3 flex items-center justify-center gap-4 text-caption text-ink-3 lg:hidden">
          <span className="flex items-center gap-1.5">
            <span className="size-[6px] rounded-full bg-accent" />
            Done
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-[6px] rounded-full bg-ink-4" />
            Open
          </span>
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
      <div className="mt-2 -mr-2 flex justify-end">
        <Button size="sm" variant="plain" onClick={onOpenDay} className="gap-1 text-ink!">
          Open day <ArrowRightIcon size={12} />
        </Button>
      </div>
    </Popover>
  );
}
