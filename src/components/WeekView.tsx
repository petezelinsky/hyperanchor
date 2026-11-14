"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { TaskTable } from "./table/TaskTable";
import type { Section, TableActions, TableState } from "./table/types";
import { WeekBoard } from "./table/WeekBoard";

const BOARD_MIN = 1000; // px of work area below which seven lanes get too narrow and the week becomes a list of days

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
    <div ref={box} data-week={selected}>
      {board ? (
        <WeekBoard sections={sections} state={state} actions={actions} />
      ) : (
        // Narrower screens: the days one under another, in the same column as Day.
        <div className="mx-auto w-full max-w-[792px] pt-1 pb-6 md:px-6 md:pb-16">
          <TaskTable sections={sections} state={state} actions={actions} grouped />
        </div>
      )}
    </div>
  );
}
