"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, dayShort, parseYmd, ymd } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { useDrag } from "../drag";
import { PlusIcon } from "../icons";
import { motion } from "../motion";
import { Menu } from "../ui";
import { taskMenu, type MenuState } from "./TaskTable";
import { TaskRow } from "./TaskRow";
import type { Composer, Section, TableActions, TableState } from "./types";

/** A one-line composer at the bottom of a column: Enter adds and stays open, Esc closes. */
function ComposerCard({ composer, actions }: { composer: Composer; actions: TableActions }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // The text lives here while it's typed, so a key press redraws this card and nothing else.
  const [title, setTitle] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setTitle("");
    ref.current?.focus();
    // The field that was here just became the task; a new one appears in its place.
    box.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: motion().fast, easing: motion().out });
  }, [composer.nonce]);
  return (
    <div ref={box} data-editing="true" className="rounded-sm bg-surface-2 px-1.5 py-1.5 shadow-ring-line-2">
      <textarea
        ref={ref}
        rows={2}
        value={title}
        onChange={(e) => {
          const next = e.target.value.replace(/\n/g, " ");
          setTitle(next);
          actions.composerChange({ title: next });
        }}
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
        placeholder="New task"
        aria-label="New task title"
        maxLength={500}
        className="block w-full resize-none bg-transparent text-footnote text-ink outline-none"
      />
    </div>
  );
}

/**
 * The week as seven lanes that run the height of the screen, split by hairlines; today's lane is shaded. Each day: its
 * name and how much is done, its date (today's in a black tile) with + beside it (not on days gone by), a thin line
 * that fills as tasks get done, then what's left, and what's finished below as quiet lines. A new task starts at the top
 * of its day. A task looks like a card only while it's dragged; a lane takes a drop anywhere.
 */
export function WeekBoard({ sections, state, actions }: { sections: Section[]; state: TableState; actions: TableActions }) {
  const [menu, setMenu] = useState<MenuState>(null);
  const openMenu = useCallback((task: Task, anchor: DOMRect | { x: number; y: number }, trigger?: HTMLElement) => setMenu({ task, anchor, trigger }), []);
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
      active={menu?.task.id === t.id}
      editingField={state.editing?.id === t.id ? state.editing.field : null}
      tomorrow={tomorrow}
      actions={actions}
      onMenu={openMenu}
    />
  );

  return (
    // Pulled out by the lanes' and rows' padding: day names and checkboxes line up with the page title, and a hovered
    // row's box hangs just outside that line, as in Day.
    <div ref={root} role="grid" aria-label="Tasks" className="grid grid-cols-7">
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
            // Lanes, not boxes: a hairline between days; only today's is shaded.
            className={`group/col flex min-h-[max(420px,calc(100dvh-56px))] min-w-0 flex-col border-l border-line px-2 pb-3 transition-colors duration-(--duration-fast) first:border-l-0 ${
              hot ? "bg-accent-soft" : isToday ? "bg-surface-2" : ""
            }`}
          >
            <div className="px-1.5 pt-4">
              <div className="flex h-[18px] items-center justify-between gap-1">
                <span className={`text-footnote font-medium ${isToday ? "text-ink" : "text-ink-3"}`}>{dayShort(d)}</span>
                <span className="tabular text-caption text-ink-3">{all ? `${doneN} of ${all}` : ""}</span>
              </div>
              <div className="mt-1.5 flex h-[30px] items-center justify-between gap-1">
                <span
                  className={`tabular flex h-[30px] items-center justify-center text-[20px] leading-[26px] font-semibold tracking-[-0.02em] ${
                    isToday ? "-ml-0.5 min-w-[30px] rounded-sm bg-primary px-1.5 text-on-primary" : past ? "text-ink-3" : "text-ink"
                  }`}
                >
                  {d.getDate()}
                </span>
                {!past && (
                  <button
                    type="button"
                    aria-label={`New task on ${dayShort(d)} ${d.getDate()}`}
                    data-tip="New task"
                    onClick={() => actions.openComposer(s.date)}
                    className="tap relative flex size-6 flex-none items-center justify-center rounded-[7px] bg-surface text-ink-2 shadow-[inset_0_0_0_1px_var(--line-2)] transition-colors duration-(--duration-fast) hover:text-ink focus-visible:opacity-100"
                  >
                    <PlusIcon size={13} />
                  </button>
                )}
              </div>
              {/* The day's progress: a thin line that fills as tasks get done. */}
              <div aria-hidden="true" className="mt-2.5 mb-2 h-[2px] overflow-hidden rounded-full bg-line-2">
                <div className="h-full origin-left rounded-full bg-ink transition-transform duration-(--duration-data) ease-out" style={{ transform: `scaleX(${all ? doneN / all : 0})` }} />
              </div>
            </div>
            <div data-list="open" className="flex flex-col gap-px">
              {composing && <ComposerCard composer={state.composer!} actions={actions} />}
              {s.tasks.map((t) => card(t, "open"))}
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
