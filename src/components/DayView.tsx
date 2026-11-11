"use client";

import { useEffect, useRef, useState } from "react";
import { addDays, dayShort, formatLong, formatMedium, MONTHS, parseYmd, relativeDay, startOfWeek, ymd, dayName } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { FocusPanel } from "./FocusPanel";
import { ArrowRightIcon, ChevronDown, ChevronLeft, ChevronRight, FocusIcon, TrashIcon } from "./icons";
import { TaskTable } from "./table/TaskTable";
import type { Section, TableActions, TableState } from "./table/types";
import { NavGroup, NewTaskButton, Toolbar } from "./Toolbar";
import { Burst, Button, Checkbox, IconButton, Kbd, ProgressRing } from "./ui";

/** Focus mode for the selected day (null when off). */
export type Focus = {
  task?: Task;
  next?: Task;
  after: number;
  onDone: (t: Task) => void;
  onLater: (t: Task) => void;
  onExit: () => void;
  onCapture: (title: string) => void;
} | null;

/** First visit: a short welcome instead of an empty list. */
export type Welcome = { name: string; onExamples: () => void; onDismiss: () => void } | null;

export function DayView({
  selected,
  section,
  state,
  actions,
  completedOpen,
  onCompletedOpen,
  byDate,
  onSelectDate,
  onMoveToToday,
  carried,
  focus,
  onFocus,
  welcome,
}: {
  selected: string;
  section: Section;
  state: TableState;
  actions: TableActions;
  completedOpen: boolean;
  onCompletedOpen: (open: boolean) => void;
  byDate: (key: string) => Task[];
  onSelectDate: (key: string) => void;
  onMoveToToday: (tasks: Task[]) => void;
  /** Today only: tasks still open from earlier days. */
  carried: Task[];
  focus: Focus;
  onFocus: () => void;
  welcome: Welcome;
}) {
  const { todayKey } = state;
  const d = parseYmd(selected);
  const all = byDate(selected);
  const doneN = all.filter((t) => t.done).length;
  const open = all.filter((t) => !t.done);
  const allDone = all.length > 0 && doneN === all.length;
  const past = selected < todayKey;
  const isToday = selected === todayKey;
  const year = d.getFullYear() !== parseYmd(todayKey).getFullYear() ? `, ${d.getFullYear()}` : "";

  return (
    <>
      <Toolbar
        title={relativeDay(selected, todayKey) ?? dayName(d)}
        subtitle={
          <>
            <span>
              {/* The title already names the weekday unless it says Today / Tomorrow / Yesterday. */}
              {relativeDay(selected, todayKey) ? (
                <>
                  {/* Phones get the short date, so the count beside it is never cut off. */}
                  <span className="sm:hidden">{formatMedium(d)}</span>
                  <span className="max-sm:hidden">{formatLong(d)}</span>
                </>
              ) : (
                `${MONTHS[d.getMonth()]} ${d.getDate()}`
              )}
              {year}
            </span>
            <span className="text-ink-4">·</span>
            {all.length ? (
              <>
                <Burst active={allDone}>
                  <ProgressRing value={doneN / all.length} size={14} stroke={2.4} />
                </Burst>
                <span className={allDone ? "font-medium text-ink" : ""}>{allDone ? "All done" : `${doneN} of ${all.length} done`}</span>
              </>
            ) : (
              <span>No tasks</span>
            )}
            {/* Phones: the way back to today sits on this line, so the week strip below never changes width. */}
            {!isToday && !focus && (
              <button
                type="button"
                onClick={() => onSelectDate(todayKey)}
                className="relative ml-auto font-medium text-ink underline decoration-ink-4 underline-offset-[3px] before:absolute before:-inset-3 md:hidden"
              >
                Today
              </button>
            )}
          </>
        }
      >
        {focus ? (
          // In focus the header keeps one way out; new thoughts go into the capture field below.
          <Button onClick={onFocus} data-tip="Leave focus (Esc)" className="gap-2">
            Leave focus
            <span className="pointer-coarse:hidden">
              <Kbd>Esc</Kbd>
            </span>
          </Button>
        ) : (
          <>
            {/* Computers step through days here and jump with the sidebar calendar; phones get the week strip below. */}
            <div className="max-md:hidden">
              <NavGroup
                prevLabel="Previous day"
                nextLabel="Next day"
                onPrev={() => onSelectDate(ymd(addDays(d, -1)))}
                onNext={() => onSelectDate(ymd(addDays(d, 1)))}
                onToday={() => onSelectDate(todayKey)}
                todayDisabled={isToday}
              />
            </div>
            <Button
              onClick={onFocus}
              disabled={!open.length}
              aria-label="Focus"
              data-tip="Focus on one task at a time (F)"
              className="max-sm:w-8 max-sm:px-0 sm:pr-3.5 sm:pl-3"
            >
              <FocusIcon size={15} strokeWidth={1.7} />
              <span className="max-sm:hidden">Focus</span>
            </Button>
            <NewTaskButton onClick={() => actions.openComposer(selected)} />
          </>
        )}
      </Toolbar>

      <div className="mx-auto max-w-[1184px] px-4 pb-16 md:px-8">
        {focus ? (
          <FocusPanel
            task={focus.task}
            next={focus.next}
            after={focus.after}
            done={doneN}
            total={all.length}
            isToday={isToday}
            onDone={focus.onDone}
            onLater={focus.onLater}
            onExit={focus.onExit}
            onCapture={focus.onCapture}
          />
        ) : (
          <>
            <div className="mb-2 md:hidden">
              <WeekPills selected={selected} todayKey={todayKey} byDate={byDate} onSelect={onSelectDate} />
            </div>

            {past && open.length > 0 && (
              <Notice action={<MoveButton label="Move to today" onClick={() => onMoveToToday(open)} />}>
                {open.length} left open on this day
              </Notice>
            )}
            {isToday && carried.length > 0 && <Carried tasks={carried} todayKey={todayKey} actions={actions} onMoveAll={() => onMoveToToday(carried)} />}

            {welcome && !all.length && !carried.length ? (
              <WelcomeCard welcome={welcome} onAdd={() => actions.openComposer(selected)} />
            ) : (
              <TaskTable
                key={selected}
                sections={[section]}
                state={state}
                actions={actions}
                placeholderRow
                completedOpen={completedOpen}
                onCompletedOpen={onCompletedOpen}
                cleared={
                  <p className="flex h-11 items-center pl-[15px] text-body text-ink-3">
                    {all.length
                      ? isToday
                        ? "All done for today."
                        : "Everything on this day is done."
                      : past
                        ? "Nothing was planned."
                        : isToday
                          ? "Nothing planned yet."
                          : `Nothing planned for ${dayName(d)} yet.`}
                  </p>
                }
              />
            )}
          </>
        )}
      </div>
    </>
  );
}

const CHUNK = 50;

/** A quiet line above the list, with its actions after the words; what it opens appears below it. */
function Notice({ children, action, more }: { children: React.ReactNode; action: React.ReactNode; more?: React.ReactNode }) {
  return (
    <div className="mt-1 mb-3 text-footnote text-ink-2">
      <div className="flex min-h-8 flex-wrap items-center gap-x-1 gap-y-1">
        <span className="min-w-0">{children}</span>
        {action}
      </div>
      {more}
    </div>
  );
}

function MoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant="plain" onClick={onClick} className="gap-1 text-ink!">
      {label}
      <ArrowRightIcon size={12} strokeWidth={2} />
    </Button>
  );
}

/** Two labels sharing one spot: the box keeps the size of the larger, so swapping them never shifts the layout. */
function Swap({ on, a, b, className = "" }: { on: boolean; a: React.ReactNode; b: React.ReactNode; className?: string }) {
  return (
    <span className={`grid ${className}`}>
      <span className={`col-start-1 row-start-1 transition-opacity duration-200 ${on ? "invisible opacity-0" : ""}`}>{a}</span>
      <span aria-hidden={!on} className={`col-start-1 row-start-1 transition-opacity duration-200 ${on ? "" : "invisible opacity-0"}`}>
        {b}
      </span>
    </span>
  );
}

/**
 * Every task left open on an earlier day, as one quiet line. Review opens them most recent first, to tick off, bring to
 * today or let go one by one, and only then offers to move them all. The line keeps its size, so nothing jumps; a long
 * list scrolls inside.
 */
function Carried({ tasks, todayKey, actions, onMoveAll }: { tasks: Task[]; todayKey: string; actions: TableActions; onMoveAll: () => void }) {
  const [open, setOpen] = useState(false);
  // The list exists only while it's open (and while it closes), and grows by 50 as it's scrolled: hundreds of old tasks
  // cost nothing until someone looks at them.
  const [mounted, setMounted] = useState(false);
  const [limit, setLimit] = useState(CHUNK);
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (open) setMounted(true);
    else setLimit(CHUNK);
  }, [open]);
  useEffect(() => {
    const el = end.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setLimit((l) => l + CHUNK), { root: el.parentElement, rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [mounted, limit, tasks.length]);
  const n = tasks.length;
  const thisYear = parseYmd(todayKey).getFullYear();
  const when = (date: string) => {
    const d = parseYmd(date);
    return relativeDay(date, todayKey) ?? `${formatMedium(d)}${d.getFullYear() !== thisYear ? `, ${d.getFullYear()}` : ""}`;
  };
  return (
    <Notice
      action={
        <>
          <Button size="sm" variant="plain" onClick={() => setOpen(!open)} aria-expanded={open} className="gap-1">
            <Swap on={open} a="Review" b="Hide" className="justify-items-end" />
            <ChevronDown size={12} strokeWidth={2} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </Button>
          {/* Bringing everything along is a choice made while looking at the list, not a button that's always there. */}
          {open && (
            <span className="ml-auto">
              <MoveButton label={n === 1 ? "Move to today" : "Move all to today"} onClick={onMoveAll} />
            </span>
          )}
        </>
      }
      more={
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
          onTransitionEnd={(e) => e.target === e.currentTarget && !open && setMounted(false)}
        >
          <div className="min-h-0 overflow-hidden" inert={!open}>
            {(open || mounted) && (
              <ul className="mt-1.5 max-h-[min(52vh,440px)] overflow-y-auto overscroll-contain rounded-lg border border-line">
                {tasks.slice(0, limit).map((t, i) => (
                  <li key={t.id} className={`flex items-center gap-3 py-1.5 pr-2 pl-3.5 ${i ? "border-t border-line" : ""}`}>
                    <Checkbox size={18} checked={t.done} onToggle={() => actions.toggle(t)} label={`Mark “${t.title}” as done`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body text-ink">{t.title}</span>
                      <span className="block text-caption text-ink-3">{when(t.date)}</span>
                    </span>
                    <Button size="sm" variant="plain" onClick={() => actions.move(t, todayKey)} className="gap-1 text-ink!">
                      Today
                      <ArrowRightIcon size={12} strokeWidth={2} />
                    </Button>
                    <IconButton label={`Delete “${t.title}”`} tip="Delete" size="sm" onClick={() => actions.remove(t)} className="hover:text-red-ink!">
                      <TrashIcon size={14} />
                    </IconButton>
                  </li>
                ))}
                {limit < n && <li ref={end} aria-hidden="true" className="h-px" />}
              </ul>
            )}
          </div>
        </div>
      }
    >
      {n} open from earlier days
    </Notice>
  );
}

/** First visit: what Hyperanchor is for, the four moves that matter (keys on the left, as a legend), and a way to try them. */
function WelcomeCard({ welcome, onAdd }: { welcome: NonNullable<Welcome>; onAdd: () => void }) {
  const steps: { title: string; key: string; touch: string }[] = [
    { title: "Add what’s on your mind", key: "N", touch: "Tap +" },
    { title: "Tick tasks off as you go", key: "Space", touch: "Tap the circle, or swipe right" },
    { title: "Stuck? Do one thing at a time", key: "F", touch: "Tap the focus button" },
    { title: "Plans change: move a task to another day", key: "Drag it", touch: "Swipe left for tomorrow" },
  ];
  return (
    // A note on the page, not a card over it: the same left edge as the list it stands in for.
    <div className="mt-4 max-w-[520px]">
      <h2 className="font-display text-title-2 font-semibold">Welcome, {welcome.name}.</h2>
      <p className="mt-1 text-body text-ink-2">Hyperanchor keeps your day calm: one list, one clear next step. Four things are enough to start.</p>
      <dl className="mt-5 border-t border-line">
        {steps.map((s) => (
          <div key={s.title} className="flex min-h-11 items-center gap-4 border-b border-line py-2">
            <dt className="w-14 flex-none pointer-coarse:hidden">{s.key === "Drag it" ? <span className="text-caption text-ink-3">Drag</span> : <Kbd>{s.key}</Kbd>}</dt>
            <dd className="min-w-0 flex-1">
              <span className="block text-body text-ink">{s.title}</span>
              {/* Phones: the gesture under the step. */}
              <span className="hidden text-caption text-ink-3 pointer-coarse:block">{s.touch}</span>
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="primary" onClick={welcome.onExamples}>
          Try it with three examples
        </Button>
        <Button
          variant="plain"
          onClick={() => {
            welcome.onDismiss();
            onAdd();
          }}
        >
          Start with my own
        </Button>
      </div>
    </div>
  );
}

/** Phones: the week around the selected day, compact — weekday, date and a dot for how the day went. */
function WeekPills({ selected, todayKey, byDate, onSelect }: { selected: string; todayKey: string; byDate: (key: string) => Task[]; onSelect: (key: string) => void }) {
  const sel = parseYmd(selected);
  const start = startOfWeek(sel);
  return (
    <div className="flex items-center gap-0.5">
      <IconButton label="Previous week" size="sm" onClick={() => onSelect(ymd(addDays(sel, -7)))}>
        <ChevronLeft size={14} strokeWidth={2} />
      </IconButton>
      <div className="flex min-w-0 flex-1 items-center gap-0.5">
        {Array.from({ length: 7 }, (_, i) => {
          const day = addDays(start, i);
          const key = ymd(day);
          const on = key === selected;
          const isToday = key === todayKey;
          const tasks = byDate(key);
          const done = tasks.filter((t) => t.done).length;
          // Accent: everything done. Gray: something still open.
          const dot = !tasks.length ? "" : done === tasks.length ? "bg-accent" : "bg-ink-4";
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-pressed={on}
              aria-label={`${formatLong(day)}: ${tasks.length ? `${done} of ${tasks.length} done` : "no tasks"}`}
              className={`flex h-[46px] min-w-0 flex-1 flex-col items-center justify-center rounded-lg transition-colors duration-150 ${
                on && isToday ? "bg-accent-solid text-on-accent" : on ? "bg-primary text-on-primary" : "hover:bg-surface-3"
              }`}
            >
              {/* Today is the accent; another selected day is black (as in Calendar). */}
              <span className={`text-caption-2 font-medium ${on ? "opacity-75" : isToday ? "text-accent-ink" : "text-ink-3"}`}>{dayShort(day)}</span>
              <span className={`tabular text-callout font-semibold ${on ? "" : isToday ? "text-accent-ink" : key < todayKey ? "text-ink-2" : "text-ink"}`}>
                {day.getDate()}
              </span>
              <span className={`mt-px size-1 rounded-full ${dot ? (on ? "bg-current opacity-60" : dot) : ""}`} />
            </button>
          );
        })}
      </div>
      <IconButton label="Next week" size="sm" onClick={() => onSelect(ymd(addDays(sel, 7)))}>
        <ChevronRight size={14} strokeWidth={2} />
      </IconButton>
    </div>
  );
}
