"use client";

import { addDays, dayDiff, formatShort, parseYmd, rangeLabel, startOfWeek, ymd } from "@/lib/dates";
import { ListIcon } from "./icons";
import { TaskTable } from "./table/TaskTable";
import type { Section, TableActions, TableState } from "./table/types";
import { EmptyState, NavGroup, NewTaskButton, SearchField, Toolbar } from "./Toolbar";

export function WeekView({
  selected,
  sections,
  state,
  actions,
  query,
  onQuery,
  onSelectDate,
}: {
  selected: string;
  sections: Section[];
  state: TableState;
  actions: TableActions;
  query: string;
  onQuery: (q: string) => void;
  onSelectDate: (key: string) => void;
}) {
  const { todayKey } = state;
  const start = startOfWeek(parseYmd(selected));
  const weeks = Math.round(dayDiff(start, startOfWeek(parseYmd(todayKey))) / 7);
  const title = weeks === 0 ? "This Week" : weeks === -1 ? "Last Week" : weeks === 1 ? "Next Week" : `Week of ${formatShort(start)}`;
  const tasks = sections.flatMap((s) => s.tasks);
  const done = tasks.filter((t) => t.done).length;

  return (
    <>
      <Toolbar title={title} subtitle={`${rangeLabel(start, addDays(start, 6))} · ${tasks.length ? `${done} of ${tasks.length} done` : "No tasks"}`}>
        <SearchField value={query} onChange={onQuery} />
        <NavGroup
          prevLabel="Previous week"
          nextLabel="Next week"
          todayLabel="This Week"
          onPrev={() => onSelectDate(ymd(addDays(parseYmd(selected), -7)))}
          onNext={() => onSelectDate(ymd(addDays(parseYmd(selected), 7)))}
          onToday={() => onSelectDate(todayKey)}
          todayDisabled={weeks === 0}
        />
        <NewTaskButton onClick={() => actions.openComposer(selected)} />
      </Toolbar>

      <div className="px-3 pt-1 pb-16 md:px-6">
        <TaskTable
          sections={sections}
          state={state}
          actions={actions}
          grouped
          empty={
            query ? (
              <EmptyState icon={<ListIcon size={22} />} title="No matching tasks">
                Nothing this week matches “{query}”.
              </EmptyState>
            ) : null
          }
        />
      </div>
    </>
  );
}
