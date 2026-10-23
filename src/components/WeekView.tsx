"use client";

import { addDays, dayDiff, formatShort, isoWeek, parseYmd, spanLabel, startOfWeek, ymd } from "@/lib/dates";
import { TaskTable } from "./table/TaskTable";
import type { Section, TableActions, TableState } from "./table/types";
import { ProgressLine } from "./ui";
import { EmptyState, NavControls, NewTaskButton, Page, SearchField, ViewHeader } from "./ViewHeader";

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
  const end = addDays(start, 6);
  const weeks = Math.round(dayDiff(start, startOfWeek(parseYmd(todayKey))) / 7);
  const title = weeks === 0 ? "This week." : weeks === -1 ? "Last week." : weeks === 1 ? "Next week." : `The week of ${formatShort(start)}.`;
  const tasks = sections.flatMap((s) => s.tasks);
  const done = tasks.filter((t) => t.done).length;

  return (
    <Page className="pb-20">
      <ViewHeader
        label={`Week ${isoWeek(start)} · ${spanLabel(start, end)}`}
        title={title}
        rest={tasks.length ? `${done} of ${tasks.length} done.` : "Nothing planned yet."}
        animKey={ymd(start)}
      >
        <SearchField value={query} onChange={onQuery} />
        <NavControls
          prevLabel="Previous week"
          nextLabel="Next week"
          todayLabel="This week"
          onPrev={() => onSelectDate(ymd(addDays(parseYmd(selected), -7)))}
          onNext={() => onSelectDate(ymd(addDays(parseYmd(selected), 7)))}
          onToday={() => onSelectDate(todayKey)}
          showToday={weeks !== 0}
        />
        <NewTaskButton onClick={() => actions.openComposer(selected)} />
      </ViewHeader>

      {tasks.length > 0 && (
        <div className="mt-5 flex items-center gap-3">
          <ProgressLine value={done / tasks.length} className="flex-1" />
          <span className="tabular font-mono text-[11px] text-muted">
            {done}/{tasks.length}
          </span>
        </div>
      )}

      <div className="mt-6">
        <TaskTable
          sections={sections}
          state={state}
          actions={actions}
          grouped
          empty={query ? <EmptyState title="No matches">Nothing this week matches “{query}”.</EmptyState> : null}
        />
      </div>
    </Page>
  );
}
