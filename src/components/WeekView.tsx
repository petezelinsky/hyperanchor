"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { addDays, dayDiff, formatShort, parseYmd, rangeLabel, startOfWeek, ymd } from "@/lib/dates";
import { SortMenu, TaskTable } from "./table/TaskTable";
import type { Section, TableActions, TableState } from "./table/types";
import { WeekBoard } from "./table/WeekBoard";
import { NavGroup, NewTaskButton, SpeakButton, Toolbar } from "./Toolbar";
import { ProgressRing } from "./ui";

const BOARD_MIN = 1040; // px of sheet below which seven columns get too narrow and the week becomes a list

export function WeekView({
  selected,
  sections,
  state,
  actions,
  onSelectDate,
  onSpeak,
}: {
  selected: string;
  sections: Section[];
  state: TableState;
  actions: TableActions;
  onSelectDate: (key: string) => void;
  /** Opens the voice screen; absent where the server can't sort speech into tasks. */
  onSpeak?: () => void;
}) {
  const { todayKey } = state;
  const start = startOfWeek(parseYmd(selected));
  const weeks = Math.round(dayDiff(start, startOfWeek(parseYmd(todayKey))) / 7);
  const title = weeks === 0 ? "This week" : weeks === -1 ? "Last week" : weeks === 1 ? "Next week" : `Week of ${formatShort(start)}`;
  const tasks = sections.flatMap((s) => [...s.tasks, ...(s.completed ?? [])]);
  const done = tasks.filter((t) => t.done).length;

  // Seven columns side by side where they fit; a list of days on smaller screens. Measured before the first paint,
  // so the week never flashes up in the wrong layout.
  const box = useRef<HTMLDivElement>(null);
  const [board, setBoard] = useState(false);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const style = getComputedStyle(el);
    setBoard(el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) >= BOARD_MIN);
    const ro = new ResizeObserver(([entry]) => setBoard(entry.contentRect.width >= BOARD_MIN));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      <Toolbar
        title={title}
        subtitle={
          <>
            <span>{rangeLabel(start, addDays(start, 6))}</span>
            <span className="text-ink-4">·</span>
            {tasks.length > 0 && <ProgressRing value={done / tasks.length} size={14} stroke={2.4} />}
            <span>{tasks.length ? `${done} of ${tasks.length} done` : "No tasks"}</span>
          </>
        }
        wide={board}
      >
        {board && <SortMenu sort={state.sort} onSort={actions.sort} />}
        <NavGroup
          prevLabel="Previous week"
          nextLabel="Next week"
          todayLabel="This week"
          onPrev={() => onSelectDate(ymd(addDays(parseYmd(selected), -7)))}
          onNext={() => onSelectDate(ymd(addDays(parseYmd(selected), 7)))}
          onToday={() => onSelectDate(todayKey)}
          todayDisabled={weeks === 0}
        />
        {onSpeak && <SpeakButton onClick={onSpeak} />}
        <NewTaskButton onClick={() => actions.openComposer(selected)} />
      </Toolbar>

      <div ref={box} className={`px-3 md:px-8 ${board ? "pb-6" : "pb-16"}`}>
        {board ? (
          <WeekBoard sections={sections} state={state} actions={actions} />
        ) : (
          <div className="mx-auto max-w-[1120px]">
            <TaskTable sections={sections} state={state} actions={actions} grouped />
          </div>
        )}
      </div>
    </>
  );
}
