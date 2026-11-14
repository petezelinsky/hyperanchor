"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, dayName, formatShort, parseYmd, startOfWeek, ymd } from "@/lib/dates";
import { DEFAULT_SORT, type Sort } from "@/lib/tasks";
import type { Task } from "@/lib/types";
import { m, tr } from "@/lib/i18n";
import { ChevronRight, PlusIcon } from "../icons";
import { motion } from "../motion";
import { SpeakChip } from "../Toolbar";
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
    { label: task.done ? tr("Mark as open") : tr("Mark as done"), shortcut: tr("Space"), onSelect: () => actions.toggle(task) },
    { label: tr("Edit"), shortcut: "↩", onSelect: () => actions.startEdit(task.id, "title") },
    { separator: true },
    { label: tr("Move to today"), disabled: task.date === todayKey, onSelect: () => actions.move(task, todayKey) },
    { label: tr("Move to tomorrow"), disabled: task.date === tomorrow, onSelect: () => actions.move(task, tomorrow) },
    { label: tr("Move to next week"), disabled: task.date === nextWeek, onSelect: () => actions.move(task, nextWeek) },
    { separator: true },
    { label: tr("Delete"), shortcut: "⌫", destructive: true, onSelect: () => actions.remove(task) },
  ];
}

/** The orders a list can be in (the order button in the bar of Day and Week). */
export const SORTS: { label: string; sort: Sort }[] = [
  { label: m("My order"), sort: DEFAULT_SORT },
  { label: m("Newest first"), sort: { key: "added", dir: "desc" } },
  { label: m("Name A–Z"), sort: { key: "title", dir: "asc" } },
  { label: m("Name Z–A"), sort: { key: "title", dir: "desc" } },
];

function ComposerRow({ composer, actions }: { composer: Composer; actions: TableActions }) {
  const titleRef = useRef<HTMLInputElement>(null);
  // The text lives here while it's typed, so a key press redraws this row and nothing else.
  const [title, setTitle] = useState("");
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setTitle("");
    titleRef.current?.focus();
    // The field that was here just became the task; a new one appears in its place.
    rowRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: motion().fast, easing: motion().out });
  }, [composer.nonce]);

  return (
    <div ref={rowRef} role="row" data-editing="true" className={`relative ${COLS} min-h-[50px] items-center rounded-[10px] bg-surface shadow-[0_0_0_1px_var(--ink-4)] md:min-h-12`}>
      <div className="flex h-[50px] items-center md:h-12">
        <span className="size-[18px] rounded-[6px] border-[1.5px] border-check-ring bg-surface" />
      </div>
      <input
        ref={titleRef}
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          actions.composerChange({ title: e.target.value });
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
        placeholder={tr("New task")}
        aria-label={tr("New task title")}
        maxLength={500}
        enterKeyHint="done"
        className="m-0 block h-full w-full min-w-0 bg-transparent p-0 pr-2 text-[16px] leading-[22px] outline-none md:text-callout"
      />
      <div className="flex h-[50px] items-center justify-end pr-1.5 md:h-12" data-tip={tr("Enter to add")}>
        <span className="pointer-coarse:hidden">
          <Kbd>↵</Kbd>
        </span>
      </div>
    </div>
  );
}

/** The first row of the list: a new task starts here, at the top; speaking them is the small button at its other end. */
export function NewTaskRow({
  onClick,
  onSpeak,
  tools,
  className = "pr-6 pl-6 md:pr-3 md:pl-3",
}: {
  onClick: () => void;
  onSpeak?: () => void;
  /** Quiet controls of the list at the end of the line, before Speak (the order of tasks). */
  tools?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative flex h-[50px] items-center md:h-12 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        data-tip={tr("New task (N)")}
        className="flex h-full min-w-0 flex-1 items-center text-left text-ink-3 transition-colors duration-(--duration-fast) hover:text-ink"
      >
        <span className="flex w-[30px] flex-none">
          <span className="flex size-[18px] items-center justify-center rounded-[6px] bg-surface-2 text-ink-2 shadow-ring-line">
            <PlusIcon size={12} />
          </span>
        </span>
        <span className="text-[16px] leading-[22px] md:text-callout">{tr("New task")}</span>
      </button>
      {(tools || onSpeak) && (
        <span className="flex flex-none items-center gap-1.5">
          {tools}
          {onSpeak && <SpeakChip onClick={onSpeak} />}
        </span>
      )}
    </div>
  );
}

/** A folded group under the list (earlier days, done): a square with a chevron, the name, how many. */
export function FoldRow({ label, count, open, onToggle }: { label: string; count: number; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" aria-expanded={open} onClick={onToggle} className="group/fold relative mt-2 flex h-[42px] w-full items-center pr-6 pl-6 text-left md:h-10 md:pr-3 md:pl-3">
      <span className="flex w-[30px] flex-none">
        <span className="flex size-[18px] items-center justify-center rounded-[6px] bg-surface-2 text-ink-2 shadow-ring-line transition-colors duration-(--duration-fast) group-hover/fold:text-ink">
          <ChevronRight size={12} className={`transition-transform duration-(--duration-fast) ${open ? "rotate-90" : ""}`} />
        </span>
      </span>
      <span className="flex-1 text-footnote font-medium text-ink-2 transition-colors duration-(--duration-fast) group-hover/fold:text-ink">{label}</span>
      <span className="tabular text-caption text-ink-3">{count}</span>
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
  onSpeak,
  tools,
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
  /** Day view: opens the voice screen (the small Speak button beside "New task"). */
  onSpeak?: () => void;
  /** Day view: quiet controls at the end of the "New task" line (the order of tasks). */
  tools?: React.ReactNode;
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
      active={menu?.task.id === t.id}
      editingField={state.editing?.id === t.id ? state.editing.field : null}
      tomorrow={tomorrow}
      actions={actions}
      onMenu={openMenu}
    />
  );
  return (
    <div ref={root}>
      <div role="grid" aria-label={tr("Tasks")}>
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
                // A head per day, over its cards: its name and date (today's name in the accent, nothing heavier), how much
                // is done, and + to add to it (not to days gone by).
                <div className="flex h-11 items-end justify-between gap-3 pr-4 pb-1.5 pl-6 md:pr-1 md:pl-3">
                  <span className="flex min-w-0 items-baseline gap-2 text-footnote">
                    <span className={`font-semibold ${isToday ? "text-accent-ink" : past ? "text-ink-3" : "text-ink"}`}>{isToday ? tr("Today") : dayName(d)}</span>
                    <span className="truncate text-ink-3">{isToday ? `${dayName(d)}, ${formatShort(d)}` : formatShort(d)}</span>
                  </span>
                  <span className="flex flex-none items-center gap-2.5">
                    <span className="tabular text-caption text-ink-3">{all ? tr("{done} of {total}", { done: doneN, total: all }) : ""}</span>
                    {!past && (
                      <button
                        type="button"
                        aria-label={tr("New task on {day}", { day: dayName(d) })}
                        data-tip={tr("New task")}
                        onClick={() => actions.openComposer(s.date)}
                        className="tap relative flex size-6 items-center justify-center rounded-[7px] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                      >
                        <PlusIcon size={13} />
                      </button>
                    )}
                  </span>
                </div>
              )}
              {/* A new task starts at the top of its day, and lands there. */}
              {composing ? (
                <div className={`px-3 md:px-0 ${grouped ? "pt-2" : "pt-1 pb-0.5"}`}>
                  <ComposerRow composer={state.composer!} actions={actions} />
                </div>
              ) : placeholderRow ? (
                <NewTaskRow onClick={() => actions.openComposer(s.date)} onSpeak={onSpeak} tools={s.tasks.length + (s.completed?.length ?? 0) > 1 ? tools : undefined} />
              ) : null}
              <div data-list="open" className={`flex flex-col gap-1.5 px-3 md:px-0 ${grouped ? (s.tasks.length ? "pt-1 pb-2" : "") : s.tasks.length ? "pt-1" : ""}`}>
                {s.tasks.map((t) => row(t, "open"))}
                {!s.tasks.length && !composing && cleared}
              </div>
              {grouped && !!s.completed?.length && <div data-list="done" className="flex flex-col gap-1.5 px-3 pb-2 md:px-0">{s.completed.map((t) => row(t, "done"))}</div>}
              {!grouped && between}
              {!grouped && !!s.completed?.length && (
                <>
                  <FoldRow label={tr("Done")} count={s.completed.length} open={completedOpen} onToggle={() => onCompletedOpen?.(!completedOpen)} />
                  <Accordion open={completedOpen}>
                    <div data-list="done" className="flex flex-col gap-1.5 px-3 pb-1 md:px-0">
                      {s.completed.map((t) => row(t, "done"))}
                    </div>
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
          label={tr("Actions for {title}", { title: menu.task.title })}
          entries={taskMenu(menu.task, state.todayKey, actions)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
