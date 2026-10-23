"use client";

import { useEffect, useRef, useState } from "react";
import { addDays, DOW_FULL, dowIndex, formatShort, parseYmd, startOfWeek, ymd } from "@/lib/dates";
import type { SortKey } from "@/lib/tasks";
import type { Task } from "@/lib/types";
import { ChevronDown, ChevronUp, PlusIcon } from "../icons";
import { IconButton, Menu, type Anchor, type MenuEntry } from "../ui";
import { COLS, TaskRow } from "./TaskRow";
import type { Composer, Section, TableActions, TableState } from "./types";

type MenuState = { task: Task; anchor: Anchor; trigger?: HTMLElement } | null;

export function taskMenu(task: Task, todayKey: string, actions: TableActions): MenuEntry[] {
  const today = parseYmd(todayKey);
  const tomorrow = ymd(addDays(today, 1));
  const nextWeek = ymd(addDays(startOfWeek(today), 7));
  return [
    { label: task.done ? "Mark as not done" : "Mark as done", shortcut: "SPACE", onSelect: () => actions.toggle(task) },
    { label: "Edit", shortcut: "↵", onSelect: () => actions.startEdit(task.id, "title") },
    { label: "Duplicate", onSelect: () => actions.duplicate(task) },
    { separator: true },
    { heading: "Move to" },
    { label: "Today", disabled: task.date === todayKey, onSelect: () => actions.move(task, todayKey) },
    { label: "Tomorrow", disabled: task.date === tomorrow, onSelect: () => actions.move(task, tomorrow) },
    { label: "Next week", disabled: task.date === nextWeek, onSelect: () => actions.move(task, nextWeek) },
    { separator: true },
    { label: "Delete", shortcut: "⌫", onSelect: () => actions.remove(task) },
  ];
}

function SortHeader({ label, k, state, actions, className = "" }: { label: string; k: SortKey; state: TableState; actions: TableActions; className?: string }) {
  const on = state.sort.key === k && !(k === "added" && state.sort.dir === "asc");
  return (
    <button type="button" onClick={() => actions.sort(k)} className={`flex items-center gap-1 uppercase transition-colors hover:text-ink ${on ? "text-ink" : ""} ${className}`}>
      {label}
      {on && (state.sort.dir === "asc" ? <ChevronUp size={10} strokeWidth={2} /> : <ChevronDown size={10} strokeWidth={2} />)}
    </button>
  );
}

function ComposerRow({ composer, actions }: { composer: Composer; actions: TableActions }) {
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => titleRef.current?.focus(), [composer.nonce]);

  const keys = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      actions.composerSubmit(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      actions.composerCancel();
    }
  };
  const input = "m-0 block w-full bg-transparent p-0";
  const notes = (cls: string) => (
    <input
      value={composer.description}
      onChange={(e) => actions.composerChange({ description: e.target.value })}
      onKeyDown={keys}
      placeholder="Notes"
      aria-label="New task notes"
      maxLength={5000}
      className={`${input} text-[13.5px] leading-[20px] ${cls}`}
    />
  );

  return (
    <div role="row" data-editing="true" className={`relative ${COLS} min-h-[52px] animate-up items-start border-b border-line bg-fill-row`}>
      <div className="flex h-[52px] items-center justify-center">
        <span className="size-5 rounded-full border-[1.5px] border-dashed border-faint" />
      </div>
      <div className="min-w-0 py-[15px] pr-4">
        <input
          ref={titleRef}
          value={composer.title}
          onChange={(e) => actions.composerChange({ title: e.target.value })}
          onKeyDown={keys}
          placeholder="New task"
          aria-label="New task title"
          maxLength={500}
          className={`${input} text-[15px] leading-[22px]`}
        />
        {notes("mt-1 @2xl:hidden")}
      </div>
      <div className="hidden min-w-0 pt-[16px] pr-4 @2xl:block">{notes("")}</div>
      <div className="mono-label hidden pt-[18px] pr-3 text-right @4xl:block">↵ add</div>
      <div />
    </div>
  );
}

export function TaskTable({
  sections,
  state,
  actions,
  grouped = false,
  empty,
}: {
  sections: Section[];
  state: TableState;
  actions: TableActions;
  /** Week view: a header per day. */
  grouped?: boolean;
  empty?: React.ReactNode;
}) {
  const [menu, setMenu] = useState<MenuState>(null);
  const root = useRef<HTMLDivElement>(null);

  // Keep the keyboard selection in view.
  useEffect(() => {
    if (!state.selectedId) return;
    root.current?.querySelector(`[data-task-row="${state.selectedId}"]`)?.scrollIntoView({ block: "nearest" });
  }, [state.selectedId]);

  const openMenu = (task: Task, anchor: Anchor, trigger?: HTMLElement) => setMenu({ task, anchor, trigger });
  const total = sections.reduce((n, s) => n + s.tasks.length, 0);
  let index = 0;

  return (
    <div ref={root} className="@container">
      <div role="grid" aria-label="Tasks">
        <div role="row" className={`${COLS} mono-label h-9 items-center border-b border-line`}>
          <div />
          <SortHeader label="Task" k="title" state={state} actions={actions} />
          <div className="hidden @2xl:block">Notes</div>
          <SortHeader label="Added" k="added" state={state} actions={actions} className="hidden justify-end pr-3 @4xl:flex" />
          <div />
        </div>

        {sections.map((s) => {
          const d = parseYmd(s.date);
          const isToday = s.date === state.todayKey;
          const doneN = s.tasks.filter((t) => t.done).length;
          return (
            <div key={s.date} role="rowgroup" aria-label={grouped ? `${DOW_FULL[dowIndex(d)]}, ${formatShort(d)}` : undefined}>
              {grouped && (
                <div className="flex items-center gap-3 border-b border-line pt-8 pb-2 pl-1">
                  <span className="text-[15px] font-medium tracking-[-0.01em]">{DOW_FULL[dowIndex(d)]}</span>
                  <span className="mono-label">{formatShort(d)}</span>
                  {isToday && (
                    <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
                      <span className="size-1.5 rounded-full bg-signal" />
                      Today
                    </span>
                  )}
                  <span className="tabular ml-auto font-mono text-[11px] text-faint">{s.tasks.length ? `${doneN}/${s.tasks.length}` : ""}</span>
                  <IconButton label={`Add task to ${DOW_FULL[dowIndex(d)]}`} size="sm" onClick={() => actions.openComposer(s.date)} className="text-muted">
                    <PlusIcon size={14} />
                  </IconButton>
                </div>
              )}
              {s.tasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  index={index++}
                  todayKey={state.todayKey}
                  selected={state.selectedId === t.id}
                  editingField={state.editing?.id === t.id ? state.editing.field : null}
                  actions={actions}
                  onMenu={openMenu}
                />
              ))}
              {state.composer?.date === s.date ? (
                <ComposerRow composer={state.composer} actions={actions} />
              ) : (
                grouped && !s.tasks.length && <div className="border-b border-line py-3.5 pl-11 text-[13.5px] text-ghost">Nothing planned</div>
              )}
            </div>
          );
        })}
      </div>

      {!total && !state.composer && empty}

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
