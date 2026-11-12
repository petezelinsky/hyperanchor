"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { formatShort, MONTHS_SHORT } from "@/lib/dates";
import { TaskTable } from "./table/TaskTable";
import type { Section, TableActions, TableState } from "./table/types";
import { WeekBoard } from "./table/WeekBoard";

const BOARD_MIN = 1000; // px of work area below which seven lanes get too narrow and the week becomes a list of days

/** "Nov 9 – 15", "Nov 30 – Dec 6" (and the year when it isn't this one). */
export function shortRange(start: Date, end: Date, thisYear: number) {
  const span =
    start.getMonth() === end.getMonth() ? `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()} – ${end.getDate()}` : `${formatShort(start)} – ${formatShort(end)}`;
  return end.getFullYear() !== thisYear ? `${span}, ${end.getFullYear()}` : span;
}

/**
 * The week, from edge to edge of the work area: seven lanes side by side where they fit, a list of days on smaller
 * screens. Which week it is, and the way to others, is in the bar above.
 */
export function WeekView({ selected, sections, state, actions }: { selected: string; sections: Section[]; state: TableState; actions: TableActions }) {
  // Measured before the first paint, so the week never flashes up in the wrong layout.
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
    <div ref={box} data-week={selected} className={board ? "" : "pb-6 md:pb-16"}>
      {board ? <WeekBoard sections={sections} state={state} actions={actions} /> : <TaskTable sections={sections} state={state} actions={actions} grouped />}
    </div>
  );
}
