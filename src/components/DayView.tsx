"use client";

import { addDays, DOW_FULL, DOW_SHORT, dowIndex, formatLong, MONTHS, parseYmd, relativeDay, startOfWeek, ymd } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { FocusPanel } from "./FocusPanel";
import { ArrowRightIcon, CheckIcon, ChevronLeft, ChevronRight, FocusIcon, PlusIcon, SunIcon } from "./icons";
import { TaskTable } from "./table/TaskTable";
import type { Section, TableActions, TableState } from "./table/types";
import { EmptyState, NewTaskButton, SearchField, Toolbar } from "./Toolbar";
import { Burst, Button, IconButton, Kbd, ProgressRing } from "./ui";

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

export function DayView({
  selected,
  section,
  state,
  actions,
  completedOpen,
  onCompletedOpen,
  byDate,
  query,
  onQuery,
  onSelectDate,
  onMoveToToday,
  carried,
  focus,
  onFocus,
}: {
  selected: string;
  section: Section;
  state: TableState;
  actions: TableActions;
  completedOpen: boolean;
  onCompletedOpen: (open: boolean) => void;
  byDate: (key: string) => Task[];
  query: string;
  onQuery: (q: string) => void;
  onSelectDate: (key: string) => void;
  onMoveToToday: (tasks: Task[]) => void;
  /** Today only: tasks still open from earlier days. */
  carried: Task[];
  focus: Focus;
  onFocus: () => void;
}) {
  const { todayKey } = state;
  const d = parseYmd(selected);
  const all = byDate(selected);
  const doneN = all.filter((t) => t.done).length;
  const open = all.filter((t) => !t.done);
  const allDone = all.length > 0 && doneN === all.length;
  const past = selected < todayKey;
  const year = d.getFullYear() !== parseYmd(todayKey).getFullYear() ? `, ${d.getFullYear()}` : "";
  const pills = <WeekPills selected={selected} todayKey={todayKey} byDate={byDate} onSelect={onSelectDate} />;

  return (
    <>
      <Toolbar
        title={relativeDay(selected, todayKey) ?? DOW_FULL[dowIndex(d)]}
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
        {!focus && <SearchField value={query} onChange={onQuery} />}
        {selected !== todayKey && !focus && (
          <Button onClick={() => onSelectDate(todayKey)} className="max-xl:hidden">
            Today
          </Button>
        )}
        {!focus && <div className="max-xl:hidden">{pills}</div>}
        <Button
          onClick={onFocus}
          aria-pressed={!!focus}
          disabled={!focus && !open.length}
          title={focus ? "Exit focus (Esc)" : "Focus on one task at a time (F)"}
          className={`max-sm:w-8 max-sm:px-0 sm:pl-2.5 ${focus ? "bg-surface-3 shadow-[inset_0_0_0_1px_var(--line-2)]" : ""}`}
        >
          <FocusIcon size={14} strokeWidth={1.8} />
          <span className="max-sm:sr-only">{focus ? "Exit Focus" : "Focus"}</span>
        </Button>
        <NewTaskButton onClick={() => (focus ? document.getElementById("focus-capture")?.focus() : actions.openComposer(selected))} />
      </Toolbar>

      <div className="mx-auto max-w-[1184px] px-3 pb-16 md:px-8">
        {focus ? (
          <FocusPanel
            task={focus.task}
            next={focus.next}
            after={focus.after}
            done={doneN}
            total={all.length}
            isToday={selected === todayKey}
            onDone={focus.onDone}
            onLater={focus.onLater}
            onExit={focus.onExit}
            onCapture={focus.onCapture}
          />
        ) : (
          <>
        <div className="mb-2 flex items-center gap-2 xl:hidden">
          <div className="min-w-0 flex-1">{pills}</div>
          {selected !== todayKey && (
            <Button size="sm" onClick={() => onSelectDate(todayKey)}>
              Today
            </Button>
          )}
        </div>

        {past && open.length > 0 && !query && (
          <Notice action={<MoveButton onClick={() => onMoveToToday(open)} />}>
            {open.length === 1 ? "1 task was left open on this day." : `${open.length} tasks were left open on this day.`}
          </Notice>
        )}
        {selected === todayKey && carried.length > 0 && !query && (
          <Notice action={<MoveButton onClick={() => onMoveToToday(carried)} />}>
            <span className="block text-ink">{carried.length === 1 ? "1 task is still open from earlier days" : `${carried.length} tasks are still open from earlier days`}</span>
            <span className="block truncate text-[12px] text-ink-3">{carried.map((t) => t.title).join(", ")}</span>
          </Notice>
        )}

        <TaskTable
          key={selected}
          sections={[section]}
          state={state}
          actions={actions}
          placeholderRow
          completedOpen={completedOpen}
          onCompletedOpen={onCompletedOpen}
          cleared={
            !query && (
              <p className="flex h-11 animate-rise items-center gap-[11px] pl-[15px] text-[14px] text-ink-2">
                <span className="flex size-[18px] items-center justify-center rounded-full bg-accent text-on-accent">
                  <CheckIcon size={10} strokeWidth={2.6} />
                </span>
                {selected === todayKey ? "All done for today. Nice work!" : "Everything on this day is done."}
              </p>
            )
          }
          empty={
            query ? (
              <EmptyState icon={<SunIcon size={22} />} title="No matching tasks">
                Nothing on this day matches “{query}”.
              </EmptyState>
            ) : (
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
            )
          }
        />
          </>
        )}
      </div>
    </>
  );
}

/** A quiet one-line notice above the list, with one action. */
function Notice({ children, action }: { children: React.ReactNode; action: React.ReactNode }) {
  return (
    <div className="mt-1 mb-4 flex animate-rise flex-col gap-x-3 gap-y-2 rounded-[12px] bg-surface-2 py-2.5 pr-2 pl-3.5 text-[13px] text-ink-2 shadow-[inset_0_0_0_1px_var(--line)] sm:flex-row sm:items-center sm:py-2">
      <span className="min-w-0 flex-1">{children}</span>
      <span className="flex-none self-start sm:self-auto">{action}</span>
    </div>
  );
}

function MoveButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" onClick={onClick} className="gap-1">
      Move to Today
      <ArrowRightIcon size={13} strokeWidth={2} />
    </Button>
  );
}

/** The week around the selected day, compact: weekday, date and a dot for how the day went. */
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
              className={`flex h-[46px] min-w-0 flex-1 flex-col items-center justify-center rounded-[11px] transition-colors duration-150 xl:w-10 xl:flex-none ${
                on && isToday ? "bg-accent text-on-accent" : on ? "bg-primary text-on-primary" : "hover:bg-surface-3"
              }`}
            >
              {/* Today is the accent; another selected day is black (as in Calendar). */}
              <span className={`text-[10.5px] leading-[13px] font-medium ${on ? "opacity-75" : isToday ? "text-accent-ink" : "text-ink-3"}`}>{DOW_SHORT[i]}</span>
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
