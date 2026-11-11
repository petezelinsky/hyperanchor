"use client";

import { useEffect, useRef, useState } from "react";
import { addDays, dayShort, isWeekend, parseYmd, ymd } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { useDrag } from "../drag";
import { PlusIcon } from "../icons";
import { IconButton, Menu } from "../ui";
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
 * The week as seven columns that run the height of the screen. Each day: its name and date, a thin line that fills
 * with the accent as tasks get done, what's left as cards, Add right where a new card would appear, and what's
 * finished below as quiet single lines. Cards drag between days and within a day; a column takes a drop anywhere.
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
        const past = s.date < state.todayKey;
        const done = s.completed ?? [];
        const all = s.tasks.length + done.length;
        const doneN = done.length + s.tasks.filter((t) => t.done).length;
        const hot = drag.target?.zone === "list" && drag.target.date === s.date;
        const composing = state.composer?.date === s.date;
        return (
          <div
            key={s.date}
            role="rowgroup"
            aria-label={`${dayShort(d)}, ${d.getDate()}`}
            data-drop-date={s.date}
            data-drop-zone="list"
            data-drop-list=""
            // A double click on a column's free space adds a task to that day.
            onDoubleClick={(e) => {
              if (!(e.target as HTMLElement).closest("[data-task-row], [data-editing], button, textarea, input")) actions.openComposer(s.date);
            }}
            className={`group/col flex min-h-[max(420px,calc(100dvh-8.5rem))] min-w-0 flex-col rounded-[14px] p-1.5 transition-[background-color,box-shadow] duration-150 ${
              hot ? "bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--accent)]" : isWeekend(d) ? "bg-surface-2" : "bg-surface-2/60"
            }`}
          >
            <div className="px-1.5 pt-1">
              <div className="flex items-end justify-between gap-1">
                <span className="flex min-w-0 flex-col">
                  <span className={`text-[11.5px] leading-4 font-medium ${isToday ? "text-accent-ink" : "text-ink-3"}`}>{dayShort(d)}</span>
                  <span className="flex h-9 items-center">
                    <span
                      className={`tabular flex items-center justify-center font-semibold tracking-[-0.02em] ${
                        isToday
                          ? "-ml-0.5 size-[30px] rounded-full bg-accent-solid text-[15px] text-on-accent"
                          : `text-[22px] ${past ? "text-ink-2" : "text-ink"}`
                      }`}
                    >
                      {d.getDate()}
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-0.5 pb-1">
                  <span className="tabular text-[11.5px] text-ink-3">{all ? `${doneN}/${all}` : ""}</span>
                  {/* With a mouse, + waits for the pointer on a busy day (seven of them are noise); an empty day always offers it. */}
                  <IconButton
                    label={`Add task to ${dayShort(d)} ${d.getDate()}`}
                    tip="Add a task"
                    size="sm"
                    onClick={() => actions.openComposer(s.date)}
                    className={`-mr-1 focus-visible:opacity-100 ${all && !composing ? "pointer-fine:opacity-0 pointer-fine:group-hover/col:opacity-100" : ""}`}
                  >
                    <PlusIcon size={14} strokeWidth={2} />
                  </IconButton>
                </span>
              </div>
              {/* The day's progress is its divider: a hairline that fills with the accent as tasks get done. */}
              <div aria-hidden="true" className="mt-1 mb-2 h-[2px] overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: all ? `${(doneN / all) * 100}%` : "0%" }} />
              </div>
            </div>
            <div data-list="open" className="flex flex-col gap-1.5">
              {s.tasks.map((t) => card(t, "open"))}
              {composing && <ComposerCard composer={state.composer!} actions={actions} />}
            </div>
            {done.length > 0 && (
              <div data-list="done" className={`${s.tasks.length || composing ? "mt-2.5" : ""} flex flex-col gap-px`}>
                {done.map((t) => card(t, "done"))}
              </div>
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
