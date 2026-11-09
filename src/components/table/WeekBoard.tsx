"use client";

import { useEffect, useRef, useState } from "react";
import { addDays, dayShort, isWeekend, parseYmd, ymd } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { useDrag } from "../drag";
import { PlusIcon } from "../icons";
import { Menu } from "../ui";
import { taskMenu, useFresh, type MenuState } from "./TaskTable";
import { TaskRow } from "./TaskRow";
import type { Composer, Section, TableActions, TableState } from "./types";

/** A one-line composer at the bottom of a column: Enter adds and stays open, Esc closes. */
function ComposerCard({ composer, actions }: { composer: Composer; actions: TableActions }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), [composer.nonce]);
  return (
    <div data-editing="true" className="animate-rise rounded-[10px] bg-surface px-2.5 py-2 shadow-[0_0_0_1.5px_var(--accent),0_4px_12px_-4px_rgba(0,0,0,0.12)]">
      <textarea
        ref={ref}
        rows={2}
        value={composer.title}
        onChange={(e) => actions.composerChange({ title: e.target.value.replace(/\n/g, " ") })}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") {
            e.preventDefault();
            actions.composerSubmit(true);
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            actions.composerCancel();
          }
        }}
        placeholder="New Task"
        aria-label="New task title"
        maxLength={500}
        className="block w-full resize-none bg-transparent text-[13.5px] leading-[18px] text-ink outline-none"
      />
    </div>
  );
}

/**
 * The week as seven columns side by side, each day's tasks as cards: what's left first, finished ones below.
 * Cards drag between days and within a day; a column takes a dropped task anywhere along it.
 */
export function WeekBoard({ sections, state, actions }: { sections: Section[]; state: TableState; actions: TableActions }) {
  const [menu, setMenu] = useState<MenuState>(null);
  const isFresh = useFresh();
  const drag = useDrag();
  const root = useRef<HTMLDivElement>(null);
  const tomorrow = ymd(addDays(parseYmd(state.todayKey), 1));

  useEffect(() => {
    if (!state.selectedId) return;
    root.current?.querySelector(`[data-task-row="${state.selectedId}"]`)?.scrollIntoView({ block: "nearest" });
  }, [state.selectedId]);

  const card = (t: Task, list: string) => (
    <TaskRow
      key={t.id}
      variant="card"
      task={t}
      selected={state.selectedId === t.id}
      editingField={state.editing?.id === t.id ? state.editing.field : null}
      fresh={isFresh(list, t.id)}
      tomorrow={tomorrow}
      actions={actions}
      onMenu={(task, anchor, trigger) => setMenu({ task, anchor, trigger })}
    />
  );

  return (
    <div ref={root} role="grid" aria-label="Tasks" className="grid grid-cols-7 gap-2">
      {sections.map((s) => {
        const d = parseYmd(s.date);
        const isToday = s.date === state.todayKey;
        const done = s.completed ?? [];
        const all = s.tasks.length + done.length;
        const doneN = done.length + s.tasks.filter((t) => t.done).length;
        const hot = drag.target?.zone === "list" && drag.target.date === s.date;
        return (
          <div
            key={s.date}
            role="rowgroup"
            aria-label={`${dayShort(d)}, ${d.getDate()}`}
            data-drop-date={s.date}
            data-drop-zone="list"
            data-drop-list=""
            className={`flex min-h-[420px] min-w-0 flex-col rounded-[14px] p-1.5 transition-[background-color,box-shadow] duration-150 ${
              hot ? "bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--accent)]" : isWeekend(d) ? "bg-surface-2" : "bg-surface-2/60"
            }`}
          >
            <div className="flex items-end justify-between gap-1 px-1.5 pt-1 pb-2">
              <span className="flex flex-col">
                <span className={`text-[11.5px] leading-4 font-medium ${isToday ? "text-accent-ink" : "text-ink-3"}`}>{dayShort(d)}</span>
                <span
                  className={`tabular flex h-8 items-center text-[22px] font-semibold tracking-[-0.02em] ${
                    isToday ? "-ml-0.5 w-fit rounded-full bg-accent px-2 text-[17px] text-on-accent" : s.date < state.todayKey ? "text-ink-2" : "text-ink"
                  }`}
                >
                  {d.getDate()}
                </span>
              </span>
              <span className="tabular pb-1 text-[11.5px] text-ink-3">{all ? `${doneN}/${all}` : ""}</span>
            </div>
            <div data-list="open" className="flex flex-col gap-1.5">
              {s.tasks.map((t) => card(t, "open"))}
              {state.composer?.date === s.date && <ComposerCard composer={state.composer} actions={actions} />}
            </div>
            {done.length > 0 && (
              <div data-list="done" className="mt-2 flex flex-col gap-0.5 border-t border-line pt-2">
                {done.map((t) => card(t, "done"))}
              </div>
            )}
            {state.composer?.date !== s.date && (
              <button
                type="button"
                onClick={() => actions.openComposer(s.date)}
                aria-label={`Add task to ${dayShort(d)} ${d.getDate()}`}
                className="mt-1.5 flex h-8 items-center gap-1.5 rounded-[9px] px-2 text-[12.5px] text-ink-3 opacity-70 transition-[background-color,color,opacity] duration-150 hover:bg-surface hover:text-ink hover:opacity-100 focus-visible:opacity-100"
              >
                <PlusIcon size={13} strokeWidth={2} />
                Add
              </button>
            )}
          </div>
        );
      })}
      {menu && (
        <Menu
          anchor={menu.anchor}
          trigger={menu.trigger}
          align="end"
          label={`Actions for ${menu.task.title}`}
          entries={taskMenu(menu.task, state.todayKey, actions)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
