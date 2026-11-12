"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { addDays, dayDiff, formatShort, MONTHS_SHORT, parseYmd, startOfWeek, ymd } from "@/lib/dates";
import { SortMenu, TaskTable } from "./table/TaskTable";
import type { Section, TableActions, TableState } from "./table/types";
import { WeekBoard } from "./table/WeekBoard";
import { Stepper, ViewHead } from "./Toolbar";

const BOARD_MIN = 1000; // px of column below which seven lanes get too narrow and the week becomes a list of days

/** "Nov 9 – 15", "Nov 30 – Dec 6" (and the year when it isn't this one). */
export function shortRange(start: Date, end: Date, thisYear: number) {
  const span =
    start.getMonth() === end.getMonth() ? `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()} – ${end.getDate()}` : `${formatShort(start)} – ${formatShort(end)}`;
  return end.getFullYear() !== thisYear ? `${span}, ${end.getFullYear()}` : span;
}

export function WeekView({
  selected,
  sections,
  state,
  actions,
  onSelectDate,
}: {
  selected: string;
  sections: Section[];
  state: TableState;
  actions: TableActions;
  onSelectDate: (key: string) => void;
}) {
  const { todayKey } = state;
  const start = startOfWeek(parseYmd(selected));
  const weeks = Math.round(dayDiff(start, startOfWeek(parseYmd(todayKey))) / 7);
  const title = weeks === 0 ? "This week" : weeks === -1 ? "Last week" : weeks === 1 ? "Next week" : `Week of ${formatShort(start)}`;

  // Seven lanes side by side where they fit; a list of days on smaller screens. Measured before the first paint,
  // so the week never flashes up in the wrong layout.
  const box = useRef<HTMLDivElement>(null);
  const [board, setBoard] = useState(false);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    setBoard(el.clientWidth >= BOARD_MIN);
    const ro = new ResizeObserver(([entry]) => setBoard(entry.contentRect.width >= BOARD_MIN));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1288px] md:px-6">
      <ViewHead
        title={title}
        soft={shortRange(start, addDays(start, 6), parseYmd(todayKey).getFullYear())}
        right={
          <>
            <SortMenu sort={state.sort} onSort={actions.sort} compact />
            <Stepper
              prevLabel="Previous week"
              nextLabel="Next week"
              onPrev={() => onSelectDate(ymd(addDays(parseYmd(selected), -7)))}
              onNext={() => onSelectDate(ymd(addDays(parseYmd(selected), 7)))}
              todayLabel={weeks === 0 ? null : "This week"}
              onToday={() => onSelectDate(todayKey)}
            />
          </>
        }
      />
      <div ref={box} className={board ? "" : "pb-6 md:pb-16"}>
        {board ? <WeekBoard sections={sections} state={state} actions={actions} /> : <TaskTable sections={sections} state={state} actions={actions} grouped />}
      </div>
    </div>
  );
}
