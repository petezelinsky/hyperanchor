"use client";

import { addDays, DOW_FULL, DOW_SHORT, dowIndex, formatLong, parseYmd, relativeDay, startOfWeek, ymd } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { SunIcon } from "./icons";
import { TaskTable } from "./table/TaskTable";
import type { Section, TableActions, TableState } from "./table/types";
import { EmptyState, NavGroup, NewTaskButton, SearchField, Toolbar } from "./Toolbar";
import { Button, Kbd } from "./ui";

export function DayView({
  selected,
  section,
  state,
  actions,
  byDate,
  query,
  onQuery,
  onSelectDate,
  onMoveToToday,
}: {
  selected: string;
  section: Section;
  state: TableState;
  actions: TableActions;
  byDate: (key: string) => Task[];
  query: string;
  onQuery: (q: string) => void;
  onSelectDate: (key: string) => void;
  onMoveToToday: (tasks: Task[]) => void;
}) {
  const { todayKey } = state;
  const d = parseYmd(selected);
  const all = byDate(selected);
  const doneN = all.filter((t) => t.done).length;
  const open = all.filter((t) => !t.done);
  const past = selected < todayKey;
  const year = d.getFullYear() !== parseYmd(todayKey).getFullYear() ? `, ${d.getFullYear()}` : "";

  return (
    <>
      <Toolbar
        title={relativeDay(selected, todayKey) ?? DOW_FULL[dowIndex(d)]}
        subtitle={`${formatLong(d)}${year} · ${all.length ? `${doneN} of ${all.length} done` : "No tasks"}`}
      >
        <SearchField value={query} onChange={onQuery} />
        <NavGroup
          prevLabel="Previous day"
          nextLabel="Next day"
          onPrev={() => onSelectDate(ymd(addDays(d, -1)))}
          onNext={() => onSelectDate(ymd(addDays(d, 1)))}
          onToday={() => onSelectDate(todayKey)}
          todayDisabled={selected === todayKey}
        />
        <NewTaskButton onClick={() => actions.openComposer(selected)} />
      </Toolbar>

      <div className="px-3 pb-16 md:px-6">
        <WeekStrip selected={selected} todayKey={todayKey} byDate={byDate} onSelect={onSelectDate} />

        {past && open.length > 0 && !query && (
          <div className="card mt-4 flex animate-rise flex-wrap items-center gap-x-3 gap-y-2 rounded-[18px] py-2.5 pr-2.5 pl-4 text-[13px] text-label-2">
            <span className="flex-1">
              {open.length === 1 ? "1 task wasn’t completed on this day." : `${open.length} tasks weren’t completed on this day.`}
            </span>
            <Button size="sm" onClick={() => onMoveToToday(open)}>
              Move to Today
            </Button>
          </div>
        )}

        <div className="mt-3">
          <TaskTable
            sections={[section]}
            state={state}
            actions={actions}
            placeholderRow
            empty={
              query ? (
                <EmptyState icon={<SunIcon size={22} />} title="No matching tasks">
                  Nothing on this day matches “{query}”.
                </EmptyState>
              ) : (
                <EmptyState icon={<SunIcon size={22} />} title={past ? "Nothing was planned" : "Nothing planned yet"}>
                  Press <Kbd>N</Kbd> or click New Task to add one.
                </EmptyState>
              )
            }
          />
        </div>
      </div>
    </>
  );
}

function WeekStrip({ selected, todayKey, byDate, onSelect }: { selected: string; todayKey: string; byDate: (key: string) => Task[]; onSelect: (key: string) => void }) {
  const start = startOfWeek(parseYmd(selected));
  const index = dowIndex(parseYmd(selected));
  return (
    <div className="relative mt-1 grid grid-cols-7">
      {/* The selection is a glass lens that slides between days; today is the ink circle. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[calc(100%/7)] px-0.5 transition-transform duration-500 ease-liquid sm:px-1"
        style={{ transform: `translateX(${index * 100}%)` }}
      >
        <span className="lens block h-full rounded-[20px]" />
      </span>
      {Array.from({ length: 7 }, (_, i) => {
        const day = addDays(start, i);
        const key = ymd(day);
        const sel = key === selected;
        const tasks = byDate(key);
        const done = tasks.filter((t) => t.done).length;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            aria-pressed={sel}
            aria-label={`${formatLong(day)}: ${tasks.length ? `${done} of ${tasks.length} done` : "no tasks"}`}
            className="group relative px-0.5 sm:px-1"
          >
            <span
              className={`flex flex-col items-center gap-1.5 rounded-[20px] pt-2.5 pb-3 transition-colors duration-200 ${sel ? "" : "group-hover:bg-fill-3"}`}
            >
              <span className={`text-[11px] font-medium ${sel ? "text-label" : "text-label-2"}`}>{DOW_SHORT[i]}</span>
              <span
                className={`tabular flex size-9 items-center justify-center rounded-full text-[17px] font-semibold tracking-[-0.01em] ${
                  key === todayKey ? "ink" : key < todayKey ? "text-label-2" : "text-label"
                }`}
              >
                {day.getDate()}
              </span>
              <span className={`h-[3px] w-7 overflow-hidden rounded-full ${tasks.length ? "bg-fill" : ""}`}>
                {tasks.length > 0 && (
                  <span className="block h-full rounded-full bg-ink transition-[width] duration-500 ease-glass" style={{ width: `${(done / tasks.length) * 100}%` }} />
                )}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
