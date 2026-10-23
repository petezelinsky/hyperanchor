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
    { label: task.done ? "Mark as Not Done" : "Mark as Done", shortcut: "Space", onSelect: () => actions.toggle(task) },
    { label: "Edit", shortcut: "↩", onSelect: () => actions.startEdit(task.id, "title") },
    { separator: true },
    { label: "Move to Today", disabled: task.date === todayKey, onSelect: () => actions.move(task, todayKey) },
    { label: "Move to Tomorrow", disabled: task.date === tomorrow, onSelect: () => actions.move(task, tomorrow) },
    { label: "Move to Next Week", disabled: task.date === nextWeek, onSelect: () => actions.move(task, nextWeek) },
    { separator: true },
    { label: "Delete", shortcut: "⌫", destructive: true, onSelect: () => actions.remove(task) },
  ];
}

function SortHeader({ label, k, state, actions, className = "" }: { label: string; k: SortKey; state: TableState; actions: TableActions; className?: string }) {
  const on = state.sort.key === k && !(k === "added" && state.sort.dir === "asc");
  return (
    <button
      type="button"
      onClick={() => actions.sort(k)}
      className={`flex items-center gap-1 text-left transition-colors hover:text-ink ${on ? "text-ink" : ""} ${className}`}
    >
      {label}
      {on && (state.sort.dir === "asc" ? <ChevronUp size={11} strokeWidth={2} /> : <ChevronDown size={11} strokeWidth={2} />)}
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
  const input = "m-0 block w-full bg-transparent p-0 outline-none";

  return (
    <div role="row" data-editing="true" className={`relative ${COLS} min-h-11 animate-rise items-start rounded-[10px] bg-accent-soft px-1`}>
      <div className="flex h-11 items-center justify-center">
        <span className="size-5 rounded-full border-[1.5px] border-dashed border-accent/60" />
      </div>
      <div className="min-w-0 py-3 pr-3">
        <input
          ref={titleRef}
          value={composer.title}
          onChange={(e) => actions.composerChange({ title: e.target.value })}
          onKeyDown={keys}
          placeholder="New Task"
          aria-label="New task title"
          maxLength={500}
          className={`${input} text-[14px] leading-5`}
        />
        <input
          value={composer.description}
          onChange={(e) => actions.composerChange({ description: e.target.value })}
          onKeyDown={keys}
          placeholder="Notes"
          aria-label="New task notes"
          maxLength={5000}
          className={`${input} mt-0.5 text-[13px] leading-[19px] @2xl:hidden`}
        />
      </div>
      <div className="hidden min-w-0 py-3 pr-3 @2xl:block">
        <input
          value={composer.description}
          onChange={(e) => actions.composerChange({ description: e.target.value })}
          onKeyDown={keys}
          placeholder="Notes"
          aria-label="New task notes"
          maxLength={5000}
          className={`${input} text-[13px] leading-[19px]`}
        />
      </div>
      <div className="hidden py-[13px] pr-2 text-right text-[12px] leading-[18px] text-ink-3 @4xl:block">↩ to add</div>
      <div />
    </div>
  );
}

function NewTaskRow({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${COLS} h-11 w-full items-center rounded-[10px] px-1 text-left text-[14px] text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-accent-ink`}
    >
      <span className="flex justify-center">
        <PlusIcon size={15} />
      </span>
      <span>New Task</span>
    </button>
  );
}

export function TaskTable({
  sections,
  state,
  actions,
  grouped = false,
  placeholderRow = false,
  empty,
}: {
  sections: Section[];
  state: TableState;
  actions: TableActions;
  /** Week view: a header row per day. */
  grouped?: boolean;
  /** Day view: an always-visible "New Task" row. */
  placeholderRow?: boolean;
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
  // Nothing to list: the empty state alone, without an empty header and placeholder row above it.
  if (!total && !state.composer && empty) return <div ref={root}>{empty}</div>;

  return (
    <div ref={root} className="@container">
      <div role="grid" aria-label="Tasks">
        <div role="row" className={`${COLS} h-9 items-center border-b border-line px-1 text-[12px] font-medium text-ink-3`}>
          <div />
          <SortHeader label="Task" k="title" state={state} actions={actions} />
          <div className="hidden @2xl:block">Notes</div>
          <SortHeader label="Added" k="added" state={state} actions={actions} className="hidden justify-end pr-2 @4xl:flex" />
          <div />
        </div>

        {sections.map((s) => {
          const d = parseYmd(s.date);
          const isToday = s.date === state.todayKey;
          const doneN = s.tasks.filter((t) => t.done).length;
          return (
            <div key={s.date} role="rowgroup" aria-label={grouped ? `${DOW_FULL[dowIndex(d)]}, ${formatShort(d)}` : undefined}>
              {grouped && (
                <div className="flex items-center gap-2.5 border-b border-line pt-7 pr-1 pb-2 pl-3">
                  <span className="text-[15px] font-semibold tracking-[-0.015em] text-ink">{DOW_FULL[dowIndex(d)]}</span>
                  <span className="text-[13px] text-ink-3">{formatShort(d)}</span>
                  {isToday && <span className="rounded-full bg-accent px-2 py-px text-[10.5px] font-semibold text-on-accent">Today</span>}
                  <span className={`tabular ml-auto text-[12px] ${s.tasks.length && doneN === s.tasks.length ? "font-medium text-green-ink" : "text-ink-3"}`}>
                    {s.tasks.length ? `${doneN} of ${s.tasks.length}` : ""}
                  </span>
                  <IconButton label={`Add task to ${DOW_FULL[dowIndex(d)]}`} size="sm" variant="secondary" onClick={() => actions.openComposer(s.date)}>
                    <PlusIcon size={13} strokeWidth={2} />
                  </IconButton>
                </div>
              )}
              <div className="py-1">
                {s.tasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    todayKey={state.todayKey}
                    selected={state.selectedId === t.id}
                    editingField={state.editing?.id === t.id ? state.editing.field : null}
                    actions={actions}
                    onMenu={openMenu}
                  />
                ))}
                {state.composer?.date === s.date ? (
                  <ComposerRow composer={state.composer} actions={actions} />
                ) : placeholderRow ? (
                  <NewTaskRow onClick={() => actions.openComposer(s.date)} />
                ) : (
                  grouped && !s.tasks.length && <div className="py-3 pl-12 text-[13px] text-ink-4">No tasks</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
