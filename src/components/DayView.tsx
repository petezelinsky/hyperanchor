"use client";

import { useState } from "react";
import { addDays, dayShort, formatLong, formatMedium, MONTHS, parseYmd, relativeDay, startOfWeek, ymd, dayName } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { Mark } from "./Brand";
import { FocusPanel } from "./FocusPanel";
import { ArrowRightIcon, CheckIcon, ChevronDown, ChevronLeft, ChevronRight, FocusIcon, PlusIcon, SunIcon, TrashIcon } from "./icons";
import { TaskTable } from "./table/TaskTable";
import type { Section, TableActions, TableState } from "./table/types";
import { EmptyState, NavGroup, NewTaskButton, SearchButton, Toolbar } from "./Toolbar";
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
  onSearch,
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
  onSearch: () => void;
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
              {relativeDay(selected, todayKey) ? formatLong(d) : `${MONTHS[d.getMonth()]} ${d.getDate()}`}
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
          </>
        }
      >
        {focus ? (
          // In focus the header keeps one way out; new thoughts go into the capture field below.
          <Button onClick={onFocus} data-tip="Leave focus (Esc)" className="gap-2">
            Exit focus
            <span className="pointer-coarse:hidden">
              <Kbd>Esc</Kbd>
            </span>
          </Button>
        ) : (
          <>
            <SearchButton onClick={onSearch} />
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

      <div className="mx-auto max-w-[1184px] px-3 pb-16 md:px-8">
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
            <div className="mb-2 flex items-center gap-2 md:hidden">
              <div className="min-w-0 flex-1">
                <WeekPills selected={selected} todayKey={todayKey} byDate={byDate} onSelect={onSelectDate} />
              </div>
              {!isToday && (
                <Button size="sm" onClick={() => onSelectDate(todayKey)}>
                  Today
                </Button>
              )}
            </div>

            {past && open.length > 0 && (
              <Notice action={<MoveButton label="Move to Today" onClick={() => onMoveToToday(open)} />}>
                {open.length === 1 ? "1 task was left open on this day." : `${open.length} tasks were left open on this day.`}
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
                  <p className="flex h-11 animate-rise items-center gap-[11px] pl-[15px] text-[14px] text-ink-2">
                    <span className="flex size-[18px] items-center justify-center rounded-full bg-accent text-on-accent">
                      <CheckIcon size={10} strokeWidth={2.6} />
                    </span>
                    {isToday ? "All done for today. Nice work!" : "Everything on this day is done."}
                  </p>
                }
                empty={
                  <EmptyState
                    icon={<SunIcon size={22} />}
                    title={past ? "Nothing was planned" : "Nothing planned yet"}
                    action={
                      <Button onClick={() => actions.openComposer(selected)} className="pl-2.5">
                        <PlusIcon size={14} strokeWidth={2.2} />
                        Add a task
                      </Button>
                    }
                  >
                    <span className="pointer-coarse:hidden">
                      Press <Kbd>N</Kbd> anywhere to add one in a second.
                    </span>
                    <span className="hidden pointer-coarse:inline">Tap + to add one.</span>
                  </EmptyState>
                }
              />
            )}
          </>
        )}
      </div>
    </>
  );
}

/** A quiet notice above the list, with its actions. */
function Notice({ children, action, more }: { children: React.ReactNode; action: React.ReactNode; more?: React.ReactNode }) {
  return (
    <div className="mt-1 mb-4 animate-rise rounded-[12px] bg-surface-2 text-[13px] text-ink-2 shadow-[inset_0_0_0_1px_var(--line)]">
      <div className="flex flex-col gap-x-3 gap-y-2 py-2.5 pr-2 pl-3.5 sm:flex-row sm:items-center sm:py-2">
        <span className="min-w-0 flex-1">{children}</span>
        <span className="flex flex-none items-center gap-1.5 self-start sm:self-auto">{action}</span>
      </div>
      {more}
    </div>
  );
}

function MoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" onClick={onClick} className="gap-1">
      {label}
      <ArrowRightIcon size={13} strokeWidth={2} />
    </Button>
  );
}

/** Tasks left open on earlier days: move them all, or go through them one by one. */
function Carried({ tasks, todayKey, actions, onMoveAll }: { tasks: Task[]; todayKey: string; actions: TableActions; onMoveAll: () => void }) {
  const [open, setOpen] = useState(false);
  const n = tasks.length;
  return (
    <Notice
      action={
        <>
          <Button size="sm" variant="plain" onClick={() => setOpen(!open)} aria-expanded={open} className="gap-1">
            {open ? "Hide" : "Review"}
            <ChevronDown size={12} strokeWidth={2} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </Button>
          <MoveButton label={n === 1 ? "Move to Today" : "Move all to Today"} onClick={onMoveAll} />
        </>
      }
      more={
        <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
          <ul className="min-h-0 overflow-hidden" inert={!open}>
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 border-t border-line py-1.5 pr-2 pl-3.5">
                <Checkbox size={18} checked={t.done} onToggle={() => actions.toggle(t)} label={`Mark “${t.title}” as done`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] text-ink">{t.title}</span>
                  <span className="block text-[11.5px] text-ink-3">{relativeDay(t.date, todayKey) ?? formatMedium(parseYmd(t.date))}</span>
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
          </ul>
        </div>
      }
    >
      <span className="block text-ink">{n === 1 ? "1 task is still open from earlier days" : `${n} tasks are still open from earlier days`}</span>
      {!open && <span className="block truncate text-[12px] text-ink-3">{tasks.map((t) => t.title).join(", ")}</span>}
    </Notice>
  );
}

/** First visit: what Hyperanchor is for, the four moves that matter, and a way to try them on examples. */
function WelcomeCard({ welcome, onAdd }: { welcome: NonNullable<Welcome>; onAdd: () => void }) {
  const steps: { title: string; key: string; touch: string }[] = [
    { title: "Add what’s on your mind", key: "N", touch: "Tap +" },
    { title: "Tick tasks off as you go", key: "Space", touch: "Tap the circle, or swipe right" },
    { title: "Stuck? Do one thing at a time", key: "F", touch: "Tap the focus button" },
    { title: "Plans change: move a task to another day", key: "Drag it", touch: "Swipe left for tomorrow" },
  ];
  return (
    <div className="mx-auto mt-6 max-w-[540px] animate-rise rounded-[22px] bg-surface p-7 shadow-float max-sm:p-5">
      <Mark size={40} />
      <h2 className="mt-5 font-display text-[24px] leading-8 font-semibold tracking-[-0.02em]">Welcome, {welcome.name}</h2>
      <p className="mt-1 text-[15px] leading-relaxed text-ink-2">Hyperanchor keeps your day calm: one list, one clear next step.</p>
      <ol className="mt-6 space-y-1">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-center gap-3 rounded-[12px] px-1 py-2">
            <span className="tabular flex size-7 flex-none items-center justify-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent-ink">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] text-ink">{s.title}</span>
              {/* Phones: the gesture under the step, so the step keeps its line. */}
              <span className="hidden text-[12.5px] text-ink-3 pointer-coarse:block">{s.touch}</span>
            </span>
            <span className="pointer-coarse:hidden">{s.key === "Drag it" ? <span className="text-[12.5px] text-ink-3">Drag it</span> : <Kbd>{s.key}</Kbd>}</span>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="primary" size="lg" onClick={welcome.onExamples} className="h-10 px-4 text-[14px]">
          Try it with examples
        </Button>
        <Button
          size="lg"
          onClick={() => {
            welcome.onDismiss();
            onAdd();
          }}
          className="h-10 px-4 text-[14px]"
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
              className={`flex h-[46px] min-w-0 flex-1 flex-col items-center justify-center rounded-[11px] transition-colors duration-150 ${
                on && isToday ? "bg-accent text-on-accent" : on ? "bg-primary text-on-primary" : "hover:bg-surface-3"
              }`}
            >
              {/* Today is the accent; another selected day is black (as in Calendar). */}
              <span className={`text-[10.5px] leading-[13px] font-medium ${on ? "opacity-75" : isToday ? "text-accent-ink" : "text-ink-3"}`}>{dayShort(day)}</span>
              <span className={`tabular text-[15px] leading-5 font-semibold ${on ? "" : isToday ? "text-accent-ink" : key < todayKey ? "text-ink-2" : "text-ink"}`}>
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
