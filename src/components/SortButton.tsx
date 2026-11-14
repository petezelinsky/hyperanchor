"use client";

import { useState } from "react";
import type { Sort } from "@/lib/tasks";
import { tr } from "@/lib/i18n";
import { SortIcon } from "./icons";
import { SORTS } from "./table/TaskTable";
import { Menu } from "./ui";

/**
 * The order of the list, at the end of the "New task" line: a quiet icon while the order is yours, which names the order
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
        aria-label={tr("Task order: {order}", { order: tr(current.label) })}
        data-tip={menu ? undefined : tr("Task order")}
        onClick={(e) => {
          const el = e.currentTarget;
          setMenu((m) => (m ? null : el));
        }}
        className={`tap relative flex h-7 flex-none items-center gap-1.5 rounded-sm text-footnote transition-colors duration-(--duration-fast) hover:bg-surface-3 hover:text-ink ${
          mine ? "w-7 justify-center" : "pr-2.5 pl-2"
        } ${menu ? "bg-surface-3 text-ink" : mine ? "text-ink-3" : "text-ink-2"}`}
      >
        <SortIcon size={15} />
        {!mine && <span className="max-sm:hidden">{current.label}</span>}
      </button>
      {menu && (
        <Menu
          anchor={menu.getBoundingClientRect()}
          trigger={menu}
          align="end"
          label={tr("Task order")}
          className="min-w-[232px]"
          entries={[
            { heading: tr("Task order") },
            ...SORTS.map((o) => ({ label: tr(o.label), checked: o === current, onSelect: () => onSort(o.sort) })),
            { separator: true },
            { heading: mine ? tr("Drag tasks to arrange them.") : tr("Dragging is off while tasks are sorted.") },
          ]}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}
