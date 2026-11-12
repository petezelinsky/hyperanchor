"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { Task } from "@/lib/types";
import { AutoTextarea } from "../AutoTextarea";
import { useDrag } from "../drag";
import { ArrowRightIcon, CheckIcon, EllipsisIcon } from "../icons";
import { Checkbox, IconButton } from "../ui";
import type { Field, TableActions } from "./types";

// A row's columns: check | task (the title, its notes beside it on the same line) | menu. The box and its gap make 30px,
// so text starts 12px + 30px in (16px + 30px on phones), where the hairline under the row starts too.
export const COLS = "grid grid-cols-[30px_minmax(0,1fr)_36px] pr-2 pl-4 md:pr-1 md:pl-3";

const SWIPE = 72; // px a finger has to travel for a swipe to count

/** Moves the caret to the end once the field mounts. */
function useFocusEnd(active: boolean) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [active]);
  return ref;
}

/**
 * Touch only: a sideways swipe slides the row over its action — right finishes the task (or reopens it),
 * left moves it to tomorrow. Vertical movement is left to the page so scrolling stays natural.
 */
function useSwipe(onRight: () => void, onLeft: () => void) {
  const [dx, setDx] = useState(0);
  const [back, setBack] = useState(false);
  const gesture = useRef<{ x: number; y: number; id: number; mode: "idle" | "swipe" | "scroll" } | null>(null);
  const moved = useRef(0);
  const swipedAt = useRef(0);

  const reset = () => {
    gesture.current = null;
    setBack(true);
    setDx(0);
    setTimeout(() => setBack(false), 260);
  };
  return {
    dx,
    back,
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== "touch") return;
      gesture.current = { x: e.clientX, y: e.clientY, id: e.pointerId, mode: "idle" };
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const g = gesture.current;
      if (!g || e.pointerId !== g.id) return;
      const mx = e.clientX - g.x;
      const my = e.clientY - g.y;
      if (g.mode === "idle") {
        if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) g.mode = "scroll";
        else if (Math.abs(mx) > 10) {
          g.mode = "swipe";
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      }
      if (g.mode !== "swipe") return;
      // A little give past the commit point, then resistance.
      const limit = 150;
      const v = Math.abs(mx) > limit ? Math.sign(mx) * (limit + (Math.abs(mx) - limit) * 0.2) : mx;
      moved.current = v;
      setDx(v);
    },
    onPointerUp: () => {
      const g = gesture.current;
      if (!g || g.mode !== "swipe") {
        gesture.current = null;
        return;
      }
      swipedAt.current = performance.now();
      const v = moved.current;
      moved.current = 0;
      if (v > SWIPE || v < -SWIPE) navigator.vibrate?.(8);
      if (v > SWIPE) onRight();
      else if (v < -SWIPE) onLeft();
      reset();
    },
    onPointerCancel: () => {
      moved.current = 0;
      reset();
    },
    /** A click that comes right out of a swipe isn't a tap on the row (later taps are). */
    onClickCapture: (e: React.MouseEvent) => {
      if (performance.now() - swipedAt.current > 400) return;
      swipedAt.current = 0;
      e.stopPropagation();
      e.preventDefault();
    },
  };
}

/** What sits under a row while it's swiped: Done (or Open) on the left, Tomorrow on the right. */
function SwipeActions({ dx, done }: { dx: number; done: boolean }) {
  const past = Math.abs(dx) > SWIPE;
  const right = dx > 0;
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 flex items-center px-5 text-footnote font-semibold ${right ? "justify-start bg-accent-solid text-on-accent" : "justify-end bg-primary text-on-primary"}`}
    >
      <span className={`flex items-center gap-2 transition-transform duration-(--duration-fast) ${past ? "scale-110" : "scale-90 opacity-80"}`}>
        {right ? (
          <>
            <CheckIcon size={13} strokeWidth={2.4} />
            {done ? "Open" : "Done"}
          </>
        ) : (
          <>
            Tomorrow
            <ArrowRightIcon size={14} strokeWidth={2.2} />
          </>
        )}
      </span>
    </div>
  );
}

/** A task in a list or on the week board. Memoized: a change to one task redraws its row, not the whole list. */
export const TaskRow = memo(function TaskRow({
  task,
  selected,
  editingField,
  variant = "row",
  tomorrow,
  actions,
  onMenu,
}: {
  task: Task;
  selected: boolean;
  editingField: Field | null;
  /** A list row, or a card in a week column. */
  variant?: "row" | "card";
  /** The date a left swipe moves the task to. */
  tomorrow: string;
  actions: TableActions;
  onMenu: (task: Task, anchor: DOMRect | { x: number; y: number }, trigger?: HTMLElement) => void;
}) {
  const titleRef = useFocusEnd(editingField === "title");
  const notesRef = useFocusEnd(editingField === "description");
  const editing = editingField !== null;
  const drag = useDrag();
  const lifted = drag.dragging?.id === task.id;
  const card = variant === "card";
  const { dx, back, ...swipeHandlers } = useSwipe(
    () => actions.toggle(task),
    () => actions.move(task, tomorrow),
  );

  const keys = (field: Field) => (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      actions.cancelEdit();
    } else if (e.key === "Enter" && (field === "title" || !e.shiftKey)) {
      e.preventDefault();
      actions.finishEdit();
    } else if (e.key === "Tab") {
      e.preventDefault();
      actions.startEdit(task.id, field === "title" ? "description" : "title");
    }
  };

  // A finished task on the week board steps back to one quiet line (picking it shows it whole again).
  const compact = card && task.done && !selected && !editing;
  // Lists: 15px titles (16px on phones, which also keeps them from zooming in on a field). Cards: 13px.
  const titleText = card ? "text-footnote" : "text-[16px] leading-[22px] md:text-callout";
  // Cards are narrow: long words hyphenate rather than break mid-word.
  // (line-clamp brings its own display, so it never goes with `block`.)
  // A picked task shows its title whole; otherwise one line in lists (its notes beside it), two on cards.
  const titleFit = selected ? "block w-full break-words hyphens-calm" : card && !compact ? "line-clamp-2 w-full break-words hyphens-calm" : card ? "block w-full truncate" : "min-w-0 flex-[0_1_auto] truncate";
  const titleCls = `${titleFit} ${titleText} transition-colors duration-(--duration-base) ${task.done ? "text-ink-3" : "text-ink"}`;
  const notesText = card ? "text-caption" : "text-body";
  // A picked task shows its notes in full (while its title is edited too); otherwise one quiet line.
  const notesCls = `${notesText} ${selected ? "block w-full break-words whitespace-pre-line text-ink-2" : card ? "block w-full truncate text-ink-3" : "min-w-0 flex-[1_1_0] truncate text-ink-3"}`;

  // The first click picks a task and shows it whole; a click on the picked task, Enter or a double click edits it.
  const editOnClick = (field: Field) => () => {
    if (selected) actions.startEdit(task.id, field);
  };
  const title =
    editingField === "title" ? (
      <AutoTextarea
        ref={titleRef}
        value={task.title}
        onChange={(e) => actions.change(task.id, { title: e.target.value.replace(/\n/g, " ") })}
        onKeyDown={keys("title")}
        aria-label="Task title"
        maxLength={500}
        dir="auto"
        className={`${titleText} text-ink`}
      />
    ) : (
      <span dir="auto" className={titleCls} onClick={editOnClick("title")} onDoubleClick={() => actions.startEdit(task.id, "title")}>
        {task.title}
      </span>
    );

  // One notes element: under the title in narrow tables and cards, in its own column from @2xl.
  // A task without notes shows none; while it's being edited, a quiet "Notes" invites one (Tab gets there too).
  const showNotes = (!!task.description || editing) && !compact;
  const notes =
    editingField === "description" ? (
      <AutoTextarea
        ref={notesRef}
        value={task.description}
        onChange={(e) => actions.change(task.id, { description: e.target.value })}
        onKeyDown={keys("description")}
        placeholder="Notes"
        aria-label="Notes"
        maxLength={5000}
        dir="auto"
        className={`${notesText} text-ink`}
      />
    ) : task.description ? (
      <span dir="auto" className={notesCls} onClick={editOnClick("description")} onDoubleClick={() => actions.startEdit(task.id, "description")}>
        {selected ? task.description : task.description.replace(/\s*\n\s*/g, " · ")}
      </span>
    ) : (
      <span className={`block ${notesText} cursor-text text-ink-3`} onClick={() => actions.startEdit(task.id, "description")}>
        Notes
      </span>
    );

  const checkbox = (
    <Checkbox
      size={card ? 16 : 18}
      checked={task.done}
      onToggle={() => {
        actions.select(task.id);
        actions.toggle(task);
      }}
      label={task.done ? `Mark “${task.title}” as open` : `Mark “${task.title}” as done`}
      className={card ? "mt-px" : ""}
    />
  );
  const menu = (
    <IconButton
      label="More actions"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        actions.select(task.id);
        onMenu(task, e.currentTarget.getBoundingClientRect(), e.currentTarget);
      }}
      className={`${card ? "size-6 rounded-sm bg-surface-2 group-aria-selected/row:bg-surface-3 hover:bg-surface-3 after:pointer-events-none after:absolute after:inset-y-0 after:right-full after:w-3 after:bg-linear-to-l after:from-surface-2 after:to-transparent group-aria-selected/row:after:from-surface-3 " : ""}${selected ? "opacity-100" : "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"}`}
    >
      <EllipsisIcon size={card ? 14 : 16} />
    </IconButton>
  );
  const common = {
    role: "row",
    "aria-selected": selected,
    "data-task-row": task.id,
    "data-done": task.done ? "true" : "false",
    "data-editing": editing ? "true" : "false",
    onClick: () => actions.select(task.id),
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      actions.select(task.id);
      onMenu(task, { x: e.clientX, y: e.clientY });
    },
  } as const;

  if (card) {
    return (
      <div
        {...common}
        onPointerDown={(e) => !editing && drag.start(e, task)}
        // A line of the day, like a row in the Day list: no card until it's picked up.
        className={`group/row relative rounded-sm ${compact ? "py-[5px]" : "py-1.5"} px-1.5 transition-[background-color,box-shadow,opacity] duration-(--duration-fast) ${
          lifted ? "opacity-35" : ""
        } ${selected || editing ? "bg-surface-3 shadow-ring-line-2" : "hover:bg-surface-2 hover:shadow-ring-line"}`}
      >
        <div className="flex items-start gap-2">
          <div role="gridcell" className="flex-none">
            {checkbox}
          </div>
          {/* The ⋯ button shows over the corner on hover, so titles keep the card's full width (touch keeps room for it). */}
          <div role="gridcell" className="min-w-0 flex-1 pointer-coarse:pr-5">
            {title}
            {showNotes && <div className="mt-0.5">{notes}</div>}
          </div>
        </div>
        <div role="gridcell" className="absolute top-1 right-1">
          {menu}
        </div>
      </div>
    );
  }

  const inline = !selected && !editing;
  return (
    <div
      {...common}
      {...swipeHandlers}
      onPointerDown={(e) => {
        if (!editing) drag.start(e, task);
        swipeHandlers.onPointerDown(e);
      }}
      style={{ touchAction: "pan-y" }}
      // Rows are divided by hairlines that start where the text starts. A hovered row turns into a soft box (no line),
      // a picked one into a box outlined in the line color. It clips only while swiped (so the menu button's touch area
      // can reach past its edge).
      className={`group/row relative transition-[background-color,box-shadow,opacity] duration-(--duration-fast) md:rounded-sm ${dx !== 0 ? "overflow-hidden" : ""} after:pointer-events-none after:absolute after:right-4 after:bottom-0 after:left-[46px] after:h-px after:bg-line md:after:right-3 md:after:left-[42px] ${
        selected || editing ? "bg-surface-3 shadow-ring-line-2 after:opacity-0" : "pointer-fine:hover:bg-surface-2 pointer-fine:hover:after:opacity-0"
      } ${lifted ? "opacity-35" : ""}`}
    >
      {dx !== 0 && <SwipeActions dx={dx} done={task.done} />}
      <div
        className={`relative ${COLS} min-h-[50px] items-start md:min-h-12 ${dx !== 0 ? "bg-surface" : ""}`}
        style={{
          transform: dx ? `translateX(${dx}px)` : undefined,
          transition: back ? "transform var(--duration-base) var(--ease-out)" : undefined,
        }}
      >
        <div role="gridcell" className="col-start-1 row-start-1 flex h-[50px] items-center md:h-12">
          {checkbox}
        </div>
        <div role="gridcell" className="col-start-2 row-start-1 min-w-0 py-[14px] pr-2 md:py-[13px]">
          {inline ? (
            <div className="flex min-w-0 items-baseline gap-2.5">
              {title}
              {task.description && notes}
            </div>
          ) : (
            <>
              {title}
              {showNotes && <div className="mt-1">{notes}</div>}
            </>
          )}
        </div>
        <div role="gridcell" className="col-start-3 row-start-1 flex h-[50px] items-center justify-end md:h-12">
          {menu}
        </div>
      </div>
    </div>
  );
});
