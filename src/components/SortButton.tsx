"use client";

import { useState } from "react";
import type { Sort } from "@/lib/tasks";
import { SortIcon } from "./icons";
import { SORTS } from "./table/TaskTable";
import { Menu } from "./ui";

/**
 * The order of the lists, in the bar beside the day's count: a quiet icon while the order is yours, which names the order
 * when it isn't (dragging is off then, and the list shouldn't look as if it were broken).
 */
export function SortButton({ sort, onSort }: { sort: Sort; onSort: (s: Sort) => void }) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const current = SORTS.find((o) => o.sort.key === sort.key && o.sort.dir === sort.dir) ?? SORTS[0];
  const mine = current === SORTS[0];
  return (
    <>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={!!menu}
        aria-label={`Task order: ${current.label}`}
        data-tip={menu ? undefined : "Task order"}
        onClick={(e) => {
          const el = e.currentTarget;
          setMenu((m) => (m ? null : el));
        }}
        className={`tap relative flex h-8 flex-none items-center gap-1.5 rounded-sm text-footnote transition-colors duration-(--duration-fast) hover:bg-surface-2 hover:text-ink ${
          mine ? "w-8 justify-center" : "pr-2.5 pl-2"
        } ${menu ? "bg-surface-2 text-ink" : mine ? "text-ink-3" : "text-ink-2"}`}
      >
        <SortIcon size={15} />
        {!mine && <span className="max-sm:hidden">{current.label}</span>}
      </button>
      {menu && (
        <Menu
          anchor={menu.getBoundingClientRect()}
          trigger={menu}
          align="end"
          label="Task order"
          className="min-w-[232px]"
          entries={[
            { heading: "Task order" },
            ...SORTS.map((o) => ({ label: o.label, checked: o === current, onSelect: () => onSort(o.sort) })),
            { separator: true },
            { heading: mine ? "Drag tasks to arrange them." : "Dragging is off while tasks are sorted." },
          ]}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}
