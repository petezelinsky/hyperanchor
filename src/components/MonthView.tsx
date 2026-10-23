"use client";

import { useState } from "react";
import { addDays, DOW_SHORT, dowIndex, formatLong, monthGrid, MONTHS, MONTHS_SHORT, parseYmd, ymd } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { ArrowUpIcon, ArrowUpRightIcon, XIcon } from "./icons";
import { Checkbox, IconButton, Popover } from "./ui";
import { NavControls, Page, ViewHeader } from "./ViewHeader";

const plural = (n: number, w: string) => `${n} ${n === 1 ? w : w + "s"}`;

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
  const isCurrent = `${year}-${String(month + 1).padStart(2, "0")}` === todayKey.slice(0, 7);
  const close = (fn: () => void) => () => {
    setPop(null);
    fn();
  };

  return (
    <>
      <Page>
        <ViewHeader
          label={`${MONTHS[month]} ${year}`}
          title={`${MONTHS[month]}.`}
          rest={inMonth.length ? `${plural(inMonth.length, "task")}, ${done} done.` : "Nothing planned yet."}
          animKey={`${year}-${month}`}
        >
          <NavControls
            prevLabel="Previous month"
            nextLabel="Next month"
            onPrev={close(() => onShift(-1))}
            onNext={close(() => onShift(1))}
            onToday={close(onThisMonth)}
            showToday={!isCurrent}
          />
        </ViewHeader>
      </Page>

      <Page className="mt-8 pb-16">
        <div className="grid grid-cols-7 border-b border-line">
          {DOW_SHORT.map((d) => (
            <div key={d} className="mono-label px-2 pb-2 text-right md:px-3">
              <span className="sm:hidden">{d[0]}</span>
              <span className="max-sm:hidden">{d}</span>
            </div>
          ))}
        </div>
        <div key={`${year}-${month}`} className="grid animate-fade grid-cols-7 [grid-auto-rows:minmax(74px,auto)] md:[grid-auto-rows:minmax(118px,auto)]">
          {cells.map((d, i) => {
            const key = ymd(d);
            const tasks = byDate(key);
            const out = d.getMonth() !== month;
            const isToday = key === todayKey;
            const isSel = key === selected;
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
                className={`flex min-w-0 flex-col gap-1.5 border-b border-line p-1.5 text-left transition-colors duration-150 md:p-2.5 ${i % 7 < 6 ? "border-r" : ""} ${
                  isSel ? "bg-fill-row" : i % 7 >= 5 ? "bg-fill-row/50 hover:bg-fill-row" : "hover:bg-fill-row"
                }`}
              >
                <span className="flex justify-end">
                  <span
                    className={`tabular flex size-[26px] items-center justify-center rounded-full text-[13px] transition-colors ${
                      isSel ? "bg-ink font-medium text-on-ink" : isToday ? "font-medium text-ink ring-[1.5px] ring-signal ring-inset" : out ? "text-ghost" : "text-ink-2"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                </span>
                <span className="flex min-w-0 flex-col gap-1 max-md:hidden">
                  {tasks.slice(0, 3).map((t) => (
                    <span key={t.id} className={`flex min-w-0 items-center gap-2 text-[12.5px] leading-4 ${t.done ? "text-faint" : out ? "text-muted" : "text-ink"}`}>
                      <span className={`size-[6px] flex-none rounded-full ${t.done ? "bg-faint" : "shadow-[inset_0_0_0_1.3px_currentColor]"}`} />
                      <span className="truncate">{t.title}</span>
                    </span>
                  ))}
                  {tasks.length > 3 && <span className="pl-3.5 font-mono text-[10.5px] text-faint">+{tasks.length - 3}</span>}
                </span>
                {tasks.length > 0 && (
                  <span className="flex flex-wrap justify-end gap-[3px] md:hidden">
                    {tasks.slice(0, 4).map((t) => (
                      <span key={t.id} className={`size-[5px] rounded-full ${t.done ? "bg-ghost" : "bg-ink"}`} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Page>

      {pop && (
        <DayPopover
          key={pop.key}
          dateKey={pop.key}
          todayKey={todayKey}
          rect={pop.rect}
          tasks={byDate(pop.key)}
          onClose={() => setPop(null)}
          onToggle={onToggle}
          onCreate={(title) => onCreate(pop.key, title)}
          onOpenDay={close(() => onOpenDay(pop.key))}
        />
      )}
    </>
  );
}

function DayPopover({
  dateKey,
  todayKey,
  rect,
  tasks,
  onClose,
  onToggle,
  onCreate,
  onOpenDay,
}: {
  dateKey: string;
  todayKey: string;
  rect: DOMRect;
  tasks: Task[];
  onClose: () => void;
  onToggle: (t: Task) => void;
  onCreate: (title: string) => void;
  onOpenDay: () => void;
}) {
  const [title, setTitle] = useState("");
  const d = parseYmd(dateKey);
  const done = tasks.filter((t) => t.done).length;

  return (
    <Popover anchor={rect} onClose={onClose} label={formatLong(d)} className="w-[330px] max-w-[calc(100vw-16px)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mono-label flex items-center gap-2">
            {dateKey === todayKey && <span className="size-1.5 rounded-full bg-signal" />}
            {DOW_SHORT[dowIndex(d)]} · {d.getDate()} {MONTHS_SHORT[d.getMonth()]} · {tasks.length ? `${done}/${tasks.length} done` : "Free"}
          </div>
          <div className="mt-1.5 text-[17px] leading-tight font-medium tracking-[-0.015em]">{formatLong(d)}</div>
        </div>
        <IconButton label="Close" size="sm" onClick={onClose} className="-mt-1 -mr-1.5 text-muted">
          <XIcon size={14} />
        </IconButton>
      </div>
      {tasks.length > 0 && (
        <ul className="mt-4 max-h-72 overflow-y-auto">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-start gap-3 border-t border-line py-2.5">
              <Checkbox size={18} checked={t.done} onToggle={() => onToggle(t)} label={t.done ? `Mark “${t.title}” as not done` : `Mark “${t.title}” as done`} />
              <div className="min-w-0 pt-px">
                <div className={`text-[14px] leading-5 break-words transition-colors ${t.done ? "text-faint" : "text-ink"}`}>{t.title}</div>
                {t.description && <div className="truncate text-[12.5px] text-muted">{t.description}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-3 flex h-11 items-center gap-2 rounded-[14px] border border-edge pr-1.5 pl-3.5 transition-colors focus-within:border-ink"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onCreate(title.trim());
          setTitle("");
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task to this day"
          aria-label="New task title"
          maxLength={500}
          autoFocus={tasks.length === 0}
          className="min-w-0 flex-1 bg-transparent text-[14px]"
        />
        <button
          type="submit"
          aria-label="Add task"
          className={`flex size-8 flex-none items-center justify-center rounded-full transition-colors ${title.trim() ? "bg-ink text-on-ink" : "bg-fill-on text-faint"}`}
        >
          <ArrowUpIcon size={14} />
        </button>
      </form>
      <button
        type="button"
        onClick={onOpenDay}
        className="group mt-3 flex h-10 w-full items-center justify-between border-t border-line pt-1 text-[14px] text-ink"
      >
        Open day
        <ArrowUpRightIcon size={15} className="text-ghost transition-[color,transform] duration-200 ease-quiet group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink" />
      </button>
    </Popover>
  );
}
