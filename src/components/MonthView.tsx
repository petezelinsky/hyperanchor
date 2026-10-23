"use client";

import { useState } from "react";
import { addDays, DOW_SHORT, formatLong, monthGrid, MONTHS, plural, ymd } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { ArrowRightIcon, PlusIcon, XIcon } from "./icons";
import { NavGroup, Toolbar } from "./Toolbar";
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
  const { start, rows } = monthGrid(year, month);
  const cells = Array.from({ length: rows * 7 }, (_, i) => addDays(start, i));
  const inMonth = cells.filter((d) => d.getMonth() === month).flatMap((d) => byDate(ymd(d)));
  const done = inMonth.filter((t) => t.done).length;
  const isCurrent = ymd(new Date(year, month, 1)).slice(0, 7) === todayKey.slice(0, 7);

  return (
    <>
      <Toolbar
        title={
          <>
            {MONTHS[month]} <span className="font-normal text-label-2">{year}</span>
          </>
        }
        subtitle={inMonth.length ? `${plural(inMonth.length, "task")} · ${done} done` : "No tasks this month"}
      >
        <NavGroup
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
          onToday={() => {
            setPop(null);
            onThisMonth();
          }}
          todayDisabled={isCurrent}
        />
      </Toolbar>

      <div className="pb-6">
        <div className="grid grid-cols-7 border-b border-separator">
          {DOW_SHORT.map((d) => (
            <div key={d} className="px-2 py-2 text-right text-[11px] font-semibold tracking-[0.06em] text-label-3 uppercase md:px-3">
              <span className="sm:hidden">{d[0]}</span>
              <span className="max-sm:hidden">{d}</span>
            </div>
          ))}
        </div>
        <div key={`${year}-${month}`} className="grid animate-rise grid-cols-7 [grid-auto-rows:minmax(76px,auto)] md:[grid-auto-rows:minmax(118px,auto)]">
          {cells.map((d, i) => {
            const key = ymd(d);
            const tasks = byDate(key);
            const out = d.getMonth() !== month;
            const isToday = key === todayKey;
            const isSel = key === selected;
            const weekend = i % 7 >= 5;
            return (
              <button
                key={key}
                type="button"
                onClick={(e) => {
                  onSelectDate(key);
                  setPop({ key, rect: e.currentTarget.getBoundingClientRect() });
                }}
                onDoubleClick={() => onOpenDay(key)}
                aria-label={`${formatLong(d)}${tasks.length ? `, ${plural(tasks.length, "task")}` : ""}`}
                className={`flex min-w-0 flex-col gap-1 border-separator p-1.5 text-left transition-[background-color,box-shadow] duration-200 md:p-2 ${i % 7 < 6 ? "border-r" : ""} ${
                  i < cells.length - 7 ? "border-b" : ""
                } ${isSel ? "bg-fill-2 shadow-[inset_0_0_0_1px_var(--separator-strong)]" : weekend ? "bg-fill-3 hover:bg-fill-2" : "hover:bg-fill-3"}`}
              >
                <span className="flex justify-end">
                  <span
                    className={`tabular flex size-[26px] items-center justify-center rounded-full text-[13px] ${
                      isToday ? "ink font-semibold" : isSel ? "font-semibold text-label" : out ? "text-label-3" : "text-label"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                </span>
                <span className="flex min-w-0 flex-col gap-[3px] max-md:hidden">
                  {tasks.slice(0, 3).map((t) => (
                    <span key={t.id} className={`flex min-w-0 items-center gap-1.5 text-[12px] leading-4 ${t.done ? "text-label-3" : out ? "text-label-2" : "text-label"}`}>
                      <span className={`size-[7px] flex-none rounded-full ${t.done ? "bg-label-4" : "shadow-[inset_0_0_0_1.5px_currentColor]"}`} />
                      <span className="truncate">{t.title}</span>
                    </span>
                  ))}
                  {tasks.length > 3 && <span className="pl-3 text-[11.5px] text-label-2">{tasks.length - 3} more</span>}
                </span>
                {tasks.length > 0 && (
                  <span className="flex flex-wrap justify-end gap-[3px] md:hidden">
                    {tasks.slice(0, 4).map((t) => (
                      <span key={t.id} className={`size-[5px] rounded-full ${t.done ? "bg-label-4" : "bg-label"}`} />
                    ))}
                  </span>
                )}
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
          <div className="text-[16px] font-semibold tracking-[-0.015em]">{formatLong(d)}</div>
          <div className="tabular text-[12px] text-label-2">{tasks.length ? `${done} of ${tasks.length} done` : "No tasks"}</div>
        </div>
        <IconButton label="Close" size="sm" onClick={onClose} className="-mt-0.5 -mr-1">
          <XIcon size={13} />
        </IconButton>
      </div>
      {tasks.length > 0 && (
        <ul className="mt-2 max-h-72 overflow-y-auto">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-start gap-2.5 rounded-[10px] px-1 py-1.5">
              <Checkbox size={18} checked={t.done} onToggle={() => onToggle(t)} label={t.done ? `Mark “${t.title}” as not done` : `Mark “${t.title}” as done`} className="mt-0.5" />
              <div className="min-w-0">
                <div className={`text-[13.5px] leading-5 break-words ${t.done ? "text-label-3" : "text-label"}`}>{t.title}</div>
                {t.description && <div className="truncate text-[12px] text-label-2">{t.description}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <form
        className="control mt-2 flex h-10 items-center gap-2 rounded-full pr-3 pl-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onCreate(title.trim());
          setTitle("");
        }}
      >
        <PlusIcon size={15} className="flex-none text-label-3" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New Task"
          aria-label="New task title"
          maxLength={500}
          autoFocus={tasks.length === 0}
          className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none"
        />
      </form>
      <div className="mt-3 flex justify-end">
        <Button variant="primary" onClick={onOpenDay} className="pr-3">
          Open Day <ArrowRightIcon size={12} strokeWidth={2.2} />
        </Button>
      </div>
    </Popover>
  );
}
