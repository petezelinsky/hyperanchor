"use client";

import { useEffect, useRef, useState } from "react";
import { addDays, dayName, formatShort, parseYmd, startOfWeek, ymd } from "@/lib/dates";
import { DEFAULT_SORT, type Sort } from "@/lib/tasks";
import type { Task } from "@/lib/types";
import { ChevronDown, PlusIcon, SortIcon } from "../icons";
import { IconButton, Menu, type Anchor, type MenuEntry } from "../ui";
import { useDrag } from "../drag";
import { COLS, TaskRow } from "./TaskRow";
import type { Composer, Section, TableActions, TableState } from "./types";

export type MenuState = { task: Task; anchor: Anchor; trigger?: HTMLElement } | null;

export function taskMenu(task: Task, todayKey: string, actions: TableActions): MenuEntry[] {
  const today = parseYmd(todayKey);
  const tomorrow = ymd(addDays(today, 1));
  const nextWeek = ymd(addDays(startOfWeek(today), 7));
  return [
    { label: task.done ? "Mark as Not Done" : "Mark as Done", shortcut: "Space", onSelect: () => actions.toggle(task) },
    { label: "Edit", shortcut: "↩", onSelect: () => actions.startEdit(task.id, "title") },
    { label: task.description ? "Edit Note" : "Add Note", onSelect: () => actions.startEdit(task.id, "description") },
    { separator: true },
    { label: "Move to Today", disabled: task.date === todayKey, onSelect: () => actions.move(task, todayKey) },
    { label: "Move to Tomorrow", disabled: task.date === tomorrow, onSelect: () => actions.move(task, tomorrow) },
    { label: "Move to Next Week", disabled: task.date === nextWeek, onSelect: () => actions.move(task, nextWeek) },
    { separator: true },
    { label: "Delete", shortcut: "⌫", destructive: true, onSelect: () => actions.remove(task) },
  ];
}

const SORTS: { label: string; sort: Sort }[] = [
  { label: "My Order", sort: DEFAULT_SORT },
  { label: "Newest First", sort: { key: "added", dir: "desc" } },
  { label: "Name A–Z", sort: { key: "title", dir: "asc" } },
  { label: "Name Z–A", sort: { key: "title", dir: "desc" } },
];

/** A quiet "⇅ My Order" button that opens the sort options. */
export function SortMenu({ sort, onSort }: { sort: Sort; onSort: (s: Sort) => void }) {
  const [anchor, setAnchor] = useState<{ rect: Anchor; el: HTMLElement } | null>(null);
  const current = SORTS.find((s) => s.sort.key === sort.key && s.sort.dir === sort.dir) ?? SORTS[0];
  return (
    <>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onClick={(e) => {
          const el = e.currentTarget;
          setAnchor((a) => (a ? null : { rect: el.getBoundingClientRect(), el }));
        }}
        className="flex h-7 items-center gap-1.5 rounded-[8px] px-2 text-[12.5px] text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
      >
        <SortIcon size={13} />
        <span>
          <span className="sr-only">Sort: </span>
          {current.label}
        </span>
      </button>
      {anchor && (
        <Menu
          anchor={anchor.rect}
          trigger={anchor.el}
          align="end"
          label="Sort tasks"
          onClose={() => setAnchor(null)}
          entries={[
            { heading: "Sort by" },
            ...SORTS.map((s) => ({ label: s.label, checked: s === current, onSelect: () => onSort(s.sort) })),
          ]}
        />
      )}
    </>
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
    <div role="row" data-editing="true" className={`relative ${COLS} min-h-11 animate-rise items-start rounded-[10px] bg-surface-3 px-1 shadow-[0_0_0_1px_var(--line-2)] first:rounded-t-none`}>
      <div className="flex h-11 items-center justify-center">
        <span className="size-5 rounded-full border-[1.5px] border-dashed border-ink-4" />
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
      <div className="flex h-11 items-center justify-center text-[13px] text-ink-3" data-tip="Press Return to add">
        ↩
      </div>
    </div>
  );
}

function NewTaskRow({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${COLS} h-11 w-full items-center rounded-[10px] px-1 text-left text-[14px] text-ink-3 transition-[background-color,box-shadow,color] duration-150 first:rounded-t-none hover:bg-surface-2 hover:text-ink hover:shadow-[0_0_0_1px_var(--line)]`}
    >
      <span className="flex justify-center">
        <PlusIcon size={15} />
      </span>
      <span>Add a task</span>
    </button>
  );
}

/** Remembers which task ids each list showed last time, so rows that just arrived can ease in. */
export function useFresh() {
  const seen = useRef<Map<string, Set<string>> | null>(null);
  const next = new Map<string, Set<string>>();
  const isFresh = (list: string, id: string) => {
    let ids = next.get(list);
    if (!ids) next.set(list, (ids = new Set()));
    ids.add(id);
    return seen.current != null && !seen.current.get(list)?.has(id);
  };
  useEffect(() => {
    seen.current = next;
  });
  return isFresh;
}

export function TaskTable({
  sections,
  state,
  actions,
  grouped = false,
  placeholderRow = false,
  completedOpen = true,
  onCompletedOpen,
  cleared,
}: {
  sections: Section[];
  state: TableState;
  actions: TableActions;
  /** Week view: a header per day. */
  grouped?: boolean;
  /** Day view: an always-visible "Add a task" row. */
  placeholderRow?: boolean;
  /** Day view: whether the Completed group is expanded. */
  completedOpen?: boolean;
  onCompletedOpen?: (open: boolean) => void;
  /** Day view: one quiet line under "To do" when nothing is left to do (or nothing was planned). */
  cleared?: React.ReactNode;
}) {
  const [menu, setMenu] = useState<MenuState>(null);
  const root = useRef<HTMLDivElement>(null);
  const isFresh = useFresh();
  const drag = useDrag();

  // Keep the keyboard selection in view.
  useEffect(() => {
    if (!state.selectedId) return;
    root.current?.querySelector(`[data-task-row="${state.selectedId}"]`)?.scrollIntoView({ block: "nearest" });
  }, [state.selectedId]);

  const openMenu = (task: Task, anchor: Anchor, trigger?: HTMLElement) => setMenu({ task, anchor, trigger });

  const tomorrow = ymd(addDays(parseYmd(state.todayKey), 1));
  const row = (t: Task, list: string) => (
    <TaskRow
      key={t.id}
      task={t}
      selected={state.selectedId === t.id}
      editingField={state.editing?.id === t.id ? state.editing.field : null}
      fresh={isFresh(list, t.id)}
      tomorrow={tomorrow}
      actions={actions}
      onMenu={openMenu}
    />
  );
  const sort = <SortMenu sort={state.sort} onSort={actions.sort} />;

  return (
    // The Day list reaches 15px past the column on each side, so its checkboxes and headings line up with the page title
    // and a hovered row's box sits just outside that line.
    <div ref={root} className={grouped ? "@container" : "@container -mx-[15px]"}>
      <div role="grid" aria-label="Tasks">
        {grouped && <div className="flex justify-end">{sort}</div>}
        {sections.map((s, i) => {
          const d = parseYmd(s.date);
          const isToday = s.date === state.todayKey;
          const all = s.tasks.length + (s.completed?.length ?? 0);
          const doneN = s.tasks.filter((t) => t.done).length + (s.completed?.length ?? 0);
          const free = grouped && !all && state.composer?.date !== s.date;
          // Each day is a drop zone; its open rows set the order a dragged task lands in.
          const hot = drag.target?.zone === "list" && drag.target.date === s.date && drag.dragging?.date !== s.date;
          return (
            <div
              key={s.date}
              role="rowgroup"
              aria-label={grouped ? `${dayName(d)}, ${formatShort(d)}` : undefined}
              data-drop-date={s.date}
              data-drop-zone="list"
              data-drop-list=""
              className={`rounded-[12px] transition-colors duration-150 ${hot ? "bg-accent-soft" : ""}`}
            >
              {grouped ? (
                <div className={`flex items-center gap-2.5 pr-1 pl-3 ${free ? "" : "border-b border-line"} ${i === 0 ? "pt-2" : free ? "pt-4" : "pt-7"} pb-2`}>
                  <span className={`text-[15px] font-semibold tracking-[-0.015em] ${free ? "text-ink-2" : "text-ink"}`}>{dayName(d)}</span>
                  <span className="text-[13px] text-ink-3">{formatShort(d)}</span>
                  {isToday && <span className="text-[12px] font-medium text-accent-ink">Today</span>}
                  <span className="tabular ml-auto text-[12px] text-ink-3">{all ? `${doneN} of ${all}` : "Free"}</span>
                  <IconButton label={`Add task to ${dayName(d)}`} size="sm" onClick={() => actions.openComposer(s.date)}>
                    <PlusIcon size={14} strokeWidth={2} />
                  </IconButton>
                </div>
              ) : (
                <div className="mx-[15px] flex h-9 items-center justify-between border-b border-line">
                  <span className="text-[13px] font-semibold text-ink">
                    To do <span className="tabular ml-1 font-normal text-ink-3">{s.tasks.filter((t) => !t.done).length || ""}</span>
                  </span>
                  {sort}
                </div>
              )}
              {/* Flush with the section's line: the first row's hover box hangs right from it. */}
              {/* 1px in from the sides, so a hovered row's 1px outline stays inside the list. */}
              <div data-list="open" className="mx-px pb-1">
                {s.tasks.map((t) => row(t, "open"))}
                {!s.tasks.length && state.composer?.date !== s.date && cleared}
                {state.composer?.date === s.date ? (
                  <ComposerRow composer={state.composer} actions={actions} />
                ) : placeholderRow ? (
                  <NewTaskRow onClick={() => actions.openComposer(s.date)} />
                ) : null}
                {grouped && !!s.completed?.length && <div data-list="done">{s.completed.map((t) => row(t, "done"))}</div>}
              </div>
              {!grouped && !!s.completed?.length && (
                <div className="mt-5">
                  <button
                    type="button"
                    aria-expanded={completedOpen}
                    onClick={() => onCompletedOpen?.(!completedOpen)}
                    className="group mx-[15px] flex h-9 w-[calc(100%-30px)] items-center gap-1.5 border-b border-line text-left text-[13px] font-semibold text-ink"
                  >
                    Completed <span className="tabular ml-1 font-normal text-ink-3">{s.completed.length}</span>
                    <ChevronDown
                      size={12}
                      strokeWidth={2}
                      className={`ml-0.5 text-ink-3 transition-transform duration-200 group-hover:text-ink ${completedOpen ? "" : "-rotate-90"}`}
                    />
                  </button>
                  {completedOpen && (
                    <div data-list="done" className="mx-px pb-1">
                      {s.completed.map((t) => row(t, "done"))}
                    </div>
                  )}
                </div>
              )}
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
