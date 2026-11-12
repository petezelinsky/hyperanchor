"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, dayName, formatShort, parseYmd, startOfWeek, ymd } from "@/lib/dates";
import { DEFAULT_SORT, type Sort } from "@/lib/tasks";
import type { Task } from "@/lib/types";
import { ChevronRight, PlusIcon, SortIcon } from "../icons";
import { motion } from "../motion";
import { Accordion, Kbd, Menu, type Anchor, type MenuEntry } from "../ui";
import { useDrag } from "../drag";
import { COLS, TaskRow } from "./TaskRow";
import type { Composer, Section, TableActions, TableState } from "./types";

export type MenuState = { task: Task; anchor: Anchor; trigger?: HTMLElement } | null;

export function taskMenu(task: Task, todayKey: string, actions: TableActions): MenuEntry[] {
  const today = parseYmd(todayKey);
  const tomorrow = ymd(addDays(today, 1));
  const nextWeek = ymd(addDays(startOfWeek(today), 7));
  return [
    { label: task.done ? "Mark as open" : "Mark as done", shortcut: "Space", onSelect: () => actions.toggle(task) },
    { label: "Edit", shortcut: "↩", onSelect: () => actions.startEdit(task.id, "title") },
    { label: task.description ? "Edit notes" : "Add notes", onSelect: () => actions.startEdit(task.id, "description") },
    { separator: true },
    { label: "Move to today", disabled: task.date === todayKey, onSelect: () => actions.move(task, todayKey) },
    { label: "Move to tomorrow", disabled: task.date === tomorrow, onSelect: () => actions.move(task, tomorrow) },
    { label: "Move to next week", disabled: task.date === nextWeek, onSelect: () => actions.move(task, nextWeek) },
    { separator: true },
    { label: "Delete", shortcut: "⌫", destructive: true, onSelect: () => actions.remove(task) },
  ];
}

const SORTS: { label: string; sort: Sort }[] = [
  { label: "My order", sort: DEFAULT_SORT },
  { label: "Newest first", sort: { key: "added", dir: "desc" } },
  { label: "Name A–Z", sort: { key: "title", dir: "asc" } },
  { label: "Name Z–A", sort: { key: "title", dir: "desc" } },
];

/** A quiet "⇅ My order" button that opens the sort options. */
export function SortMenu({ sort, onSort, compact = false }: { sort: Sort; onSort: (s: Sort) => void; compact?: boolean }) {
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
        data-tip={`Sort: ${current.label}`}
        className="tap relative flex h-7 items-center gap-1.5 rounded-sm px-2 text-footnote text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
      >
        <SortIcon size={13} />
        <span className={compact ? "sr-only" : ""}>
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
  // The text lives here while it's typed, so a key press redraws this row and nothing else.
  const [text, setText] = useState({ title: "", description: "" });
  const change = (patch: Partial<typeof text>) => {
    setText((t) => ({ ...t, ...patch }));
    actions.composerChange(patch);
  };
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setText({ title: "", description: "" });
    titleRef.current?.focus();
    // The field that was here just became the task; a new one appears in its place.
    rowRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: motion().fast, easing: motion().out });
  }, [composer.nonce]);

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
    <div ref={rowRef} role="row" data-editing="true" className={`relative ${COLS} min-h-[50px] items-start bg-surface-2 md:min-h-12 md:rounded-sm`}>
      <div className="flex h-[50px] items-center md:h-12">
        <span className="size-[18px] rounded-[6px] border-[1.5px] border-check-ring bg-surface" />
      </div>
      <div className="min-w-0 py-[14px] pr-2 md:py-[13px]">
        <input
          ref={titleRef}
          value={text.title}
          onChange={(e) => change({ title: e.target.value })}
          onKeyDown={keys}
          placeholder="New task"
          aria-label="New task title"
          maxLength={500}
          className={`${input} text-[16px] leading-[22px] md:text-callout`}
        />
        <input
          value={text.description}
          onChange={(e) => change({ description: e.target.value })}
          onKeyDown={keys}
          placeholder="Notes"
          aria-label="New task notes"
          maxLength={5000}
          className={`${input} mt-0.5 text-[16px] leading-5 text-ink-2 md:text-body`}
        />
      </div>
      <div className="flex h-[50px] items-center justify-end pr-1.5 md:h-12" data-tip="Enter to add">
        <span className="pointer-coarse:hidden">
          <Kbd>↵</Kbd>
        </span>
      </div>
    </div>
  );
}

/** The first row of the list: a new task starts here, at the top. Sorting sits at its other end, above the list it sorts. */
function NewTaskRow({ onClick, sort }: { onClick: () => void; sort?: React.ReactNode }) {
  return (
    <div className="group/new relative flex h-[50px] items-center pr-2 pl-4 md:h-12 md:pr-1 md:pl-3">
      <button type="button" onClick={onClick} className="flex h-full min-w-0 flex-1 items-center text-left text-ink-3 transition-colors duration-(--duration-fast) hover:text-ink">
        <span className="flex w-[30px] flex-none">
          <span className="flex size-[18px] items-center justify-center rounded-[6px] bg-surface-2 text-ink-2 shadow-ring-line">
            <PlusIcon size={12} strokeWidth={2} />
          </span>
        </span>
        <span className="text-[16px] leading-[22px] md:text-callout">New task</span>
      </button>
      <span className="flex flex-none items-center gap-1">
        {sort}
        <span className="pr-1.5 pointer-coarse:hidden">
          <Kbd>N</Kbd>
        </span>
      </span>
      <span aria-hidden="true" className="pointer-events-none absolute right-4 bottom-0 left-[46px] h-px bg-line md:right-3 md:left-[42px]" />
    </div>
  );
}

/** A folded group under the list (earlier days, done): a square with a chevron, the name, how many. */
export function FoldRow({ label, count, open, onToggle }: { label: string; count: number; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" aria-expanded={open} onClick={onToggle} className="group/fold relative flex h-[46px] w-full items-center pr-4 pl-4 text-left md:h-11 md:pr-3 md:pl-3">
      <span className="flex w-[30px] flex-none">
        <span className="flex size-[18px] items-center justify-center rounded-[6px] bg-surface-2 text-ink-2 shadow-ring-line transition-colors duration-(--duration-fast) group-hover/fold:text-ink">
          <ChevronRight size={12} strokeWidth={2} className={`transition-transform duration-(--duration-fast) ${open ? "rotate-90" : ""}`} />
        </span>
      </span>
      <span className="flex-1 text-footnote font-medium text-ink-2 transition-colors duration-(--duration-fast) group-hover/fold:text-ink">{label}</span>
      <span className="tabular text-caption text-ink-3">{count}</span>
      <span aria-hidden="true" className="pointer-events-none absolute right-4 bottom-0 left-[46px] h-px bg-line md:right-3 md:left-[42px]" />
    </button>
  );
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
  between,
}: {
  sections: Section[];
  state: TableState;
  actions: TableActions;
  /** Week view: a header per day. */
  grouped?: boolean;
  /** Day view: an always-visible "New task" row. */
  placeholderRow?: boolean;
  /** Day view: whether the Done group is expanded. */
  completedOpen?: boolean;
  onCompletedOpen?: (open: boolean) => void;
  /** Day view: one quiet line under "New task" when nothing is left to do (or nothing was planned). */
  cleared?: React.ReactNode;
  /** Day view: what goes between the open tasks and Done (the tasks still open from earlier days). */
  between?: React.ReactNode;
}) {
  const [menu, setMenu] = useState<MenuState>(null);
  const root = useRef<HTMLDivElement>(null);
  const drag = useDrag();

  // Keep the keyboard selection in view.
  useEffect(() => {
    if (!state.selectedId) return;
    root.current?.querySelector(`[data-task-row="${state.selectedId}"]`)?.scrollIntoView({ block: "nearest" });
  }, [state.selectedId]);

  const openMenu = useCallback((task: Task, anchor: Anchor, trigger?: HTMLElement) => setMenu({ task, anchor, trigger }), []);

  const tomorrow = ymd(addDays(parseYmd(state.todayKey), 1));
  const row = (t: Task, list: string) => (
    <TaskRow
      key={t.id}
      task={t}
      selected={state.selectedId === t.id}
      editingField={state.editing?.id === t.id ? state.editing.field : null}
      tomorrow={tomorrow}
      actions={actions}
      onMenu={openMenu}
    />
  );
  const sort = <SortMenu sort={state.sort} onSort={actions.sort} compact />;

  return (
    <div ref={root}>
      <div role="grid" aria-label="Tasks">
        {sections.map((s) => {
          const d = parseYmd(s.date);
          const isToday = s.date === state.todayKey;
          const past = s.date < state.todayKey;
          const all = s.tasks.length + (s.completed?.length ?? 0);
          const doneN = s.tasks.filter((t) => t.done).length + (s.completed?.length ?? 0);
          const composing = state.composer?.date === s.date;
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
              className={`transition-colors duration-(--duration-fast) ${hot ? "bg-accent-soft" : ""}`}
            >
              {grouped && (
                // A band per day: its name and date, how much is done, and + to add to it (not to days gone by).
                <div className="-mt-px flex h-10 items-center justify-between gap-3 bg-surface-2 pr-3 pl-4 shadow-[inset_0_-1px_0_var(--line),inset_0_1px_0_var(--line)] md:pl-3">
                  <span className={`flex min-w-0 items-center gap-2 text-footnote font-semibold ${past ? "text-ink-3" : "text-ink"}`}>
                    {isToday && <span className="rounded-[5px] bg-primary px-1.5 text-caption-2 leading-4 font-semibold text-on-primary">Today</span>}
                    {dayName(d)}
                    <span className="font-normal text-ink-3">{formatShort(d)}</span>
                  </span>
                  <span className="flex flex-none items-center gap-2.5">
                    <span className="tabular text-caption text-ink-3">{all ? `${doneN} of ${all}` : ""}</span>
                    {!past && (
                      <button
                        type="button"
                        aria-label={`New task on ${dayName(d)}`}
                        data-tip="New task"
                        onClick={() => actions.openComposer(s.date)}
                        className="tap relative flex size-6 items-center justify-center rounded-[7px] bg-surface text-ink-2 shadow-[inset_0_0_0_1px_var(--line-2)] transition-colors hover:text-ink"
                      >
                        <PlusIcon size={13} strokeWidth={1.9} />
                      </button>
                    )}
                  </span>
                </div>
              )}
              {/* A new task starts at the top of its day, and lands there. */}
              {composing ? (
                <ComposerRow composer={state.composer!} actions={actions} />
              ) : placeholderRow ? (
                <NewTaskRow onClick={() => actions.openComposer(s.date)} sort={sort} />
              ) : null}
              <div data-list="open">
                {s.tasks.map((t) => row(t, "open"))}
                {!s.tasks.length && !composing && cleared}
              </div>
              {grouped && !!s.completed?.length && <div data-list="done">{s.completed.map((t) => row(t, "done"))}</div>}
              {!grouped && between}
              {!grouped && !!s.completed?.length && (
                <>
                  <FoldRow label="Done" count={s.completed.length} open={completedOpen} onToggle={() => onCompletedOpen?.(!completedOpen)} />
                  <Accordion open={completedOpen}>
                    <div data-list="done">{s.completed.map((t) => row(t, "done"))}</div>
                  </Accordion>
                </>
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
