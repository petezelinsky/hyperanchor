"use client";

import { useEffect, useRef, useState } from "react";
import type { Task } from "@/lib/types";
import { AutoTextarea } from "../AutoTextarea";
import { useDrag } from "../drag";
import { ArrowRightIcon, CheckIcon, EllipsisIcon } from "../icons";
import { Checkbox, IconButton } from "../ui";
import type { Field, TableActions } from "./types";

// Responsive columns (container queries): check | task | notes | menu. Notes sit under the title in narrow lists;
// in wide ones they take the right third, and a task without notes lets its title run across both.
export const COLS = "grid grid-cols-[40px_minmax(0,1fr)_36px] @2xl:grid-cols-[40px_minmax(0,2fr)_minmax(0,1fr)_36px]";

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

/** What sits under a row while it's swiped: Done (or Not done) on the left, Tomorrow on the right. */
function SwipeActions({ dx, done }: { dx: number; done: boolean }) {
  const past = Math.abs(dx) > SWIPE;
  const right = dx > 0;
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 flex items-center px-5 text-[13px] font-semibold ${right ? "justify-start bg-accent text-on-accent" : "justify-end bg-primary text-on-primary"}`}
    >
      <span className={`flex items-center gap-2 transition-transform duration-150 ${past ? "scale-110" : "scale-90 opacity-80"}`}>
        {right ? (
          <>
            <CheckIcon size={13} strokeWidth={2.4} />
            {done ? "Not done" : "Done"}
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

export function TaskRow({
  task,
  selected,
  editingField,
  fresh = false,
  variant = "row",
  tomorrow,
  actions,
  onMenu,
}: {
  task: Task;
  selected: boolean;
  editingField: Field | null;
  /** Just arrived in this list (added, completed or reopened): eases in. */
  fresh?: boolean;
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
  const titleText = compact ? "text-[13px] leading-[18px]" : card ? "text-[13.5px] leading-[18px]" : "text-[14px] leading-5";
  // Cards are narrow: long words hyphenate rather than break mid-word.
  // (line-clamp brings its own display, so it never goes with `block`.)
  const titleCls = `w-full ${card && !compact ? "line-clamp-3 break-words hyphens-auto" : "block truncate"} ${titleText} transition-colors duration-300 ${task.done ? "text-ink-3" : "text-ink"}`;
  const notesText = card ? "text-[12px] leading-4" : "text-[13px] leading-[19px]";
  // A selected task shows its notes in full; otherwise one quiet line (two on a card).
  const notesCls = `w-full ${notesText} text-ink-2 ${selected && !editing ? "block break-words whitespace-pre-line" : card ? "line-clamp-2 break-words hyphens-auto" : "block truncate"}`;

  const title =
    editingField === "title" ? (
      card ? (
        <AutoTextarea
          ref={titleRef}
          value={task.title}
          onChange={(e) => actions.change(task.id, { title: e.target.value.replace(/\n/g, " ") })}
          onKeyDown={keys("title")}
          aria-label="Task title"
          maxLength={500}
          className={`${titleText} text-ink`}
        />
      ) : (
        <input
          ref={titleRef}
          value={task.title}
          onChange={(e) => actions.change(task.id, { title: e.target.value })}
          onKeyDown={keys("title")}
          aria-label="Task title"
          maxLength={500}
          className={`${titleCls} m-0 bg-transparent p-0 text-ink outline-none`}
        />
      )
    ) : (
      <span className={titleCls} onClick={() => actions.startEdit(task.id, "title")}>
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
        className={`${notesText} text-ink`}
      />
    ) : task.description ? (
      <span className={notesCls} onClick={() => actions.startEdit(task.id, "description")}>
        {selected ? task.description : task.description.replace(/\s*\n\s*/g, " · ")}
      </span>
    ) : (
      <span className={`block ${notesText} cursor-text text-ink-3`} onClick={() => actions.startEdit(task.id, "description")}>
        Notes
      </span>
    );

  const checkbox = (
    <Checkbox
      size={compact ? 16 : card ? 18 : 20}
      checked={task.done}
      onToggle={() => {
        actions.select(task.id);
        actions.toggle(task);
      }}
      label={task.done ? `Mark “${task.title}” as not done` : `Mark “${task.title}” as done`}
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
      className={`${card ? "size-6 rounded-[7px] bg-surface hover:bg-surface-3 " : ""}${selected ? "opacity-100" : "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"}`}
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
        className={`group/row relative rounded-[10px] ${compact ? "py-[5px]" : "py-2"} pr-2 pl-2.5 transition-[background-color,box-shadow,opacity] duration-150 ${
          lifted ? "opacity-35" : ""
        } ${
          selected || editing
            ? "bg-surface shadow-[0_0_0_1.5px_var(--accent),0_4px_12px_-4px_rgba(0,0,0,0.12)]"
            : task.done
              ? "hover:bg-surface"
              : "bg-surface shadow-lift hover:shadow-[0_0_0_1px_var(--line-2),0_6px_16px_-6px_rgba(0,0,0,0.14)]"
        } ${fresh ? "animate-rise" : ""}`}
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
        <div role="gridcell" className="absolute top-1.5 right-1.5">
          {menu}
        </div>
      </div>
    );
  }

  return (
    <div
      {...common}
      {...swipeHandlers}
      onPointerDown={(e) => {
        if (!editing) drag.start(e, task);
        swipeHandlers.onPointerDown(e);
      }}
      style={{ touchAction: "pan-y" }}
      // Rows are divided by hairlines. A hovered or picked row becomes a rounded box outlined in the same line color: its
      // 1px ring sits over the hairlines above and below, so they turn into the box's edges instead of breaking off at
      // its corners. The first row hangs from the section's line, so its top corners stay square.
      className={`group/row relative overflow-hidden rounded-[10px] transition-[background-color,box-shadow,opacity] duration-150 first:rounded-t-none after:pointer-events-none after:absolute after:right-3 after:bottom-0 after:left-12 after:h-px after:bg-line ${
        selected || editing
          ? "bg-surface-3 shadow-[0_0_0_1px_var(--line-2)] after:opacity-0"
          : "hover:bg-surface-2 hover:shadow-[0_0_0_1px_var(--line)] hover:after:opacity-0"
      } ${lifted ? "opacity-35" : ""} ${fresh ? "animate-rise" : ""}`}
    >
      {dx !== 0 && <SwipeActions dx={dx} done={task.done} />}
      <div
        className={`relative ${COLS} min-h-11 items-start px-1 ${dx !== 0 ? "rounded-[10px] bg-surface" : ""}`}
        style={{
          transform: dx ? `translateX(${dx}px)` : undefined,
          transition: back ? "transform 0.26s var(--ease-out)" : undefined,
        }}
      >
        <div role="gridcell" className="col-start-1 row-start-1 flex h-11 items-center justify-center">
          {checkbox}
        </div>
        <div role="gridcell" className={`col-start-2 row-start-1 min-w-0 py-3 pr-3 ${showNotes ? "" : "@2xl:col-span-2"}`}>
          {title}
        </div>
        {showNotes && (
          <div role="gridcell" className="col-start-2 row-start-2 -mt-2.5 min-w-0 pr-3 pb-3 @2xl:col-start-3 @2xl:row-start-1 @2xl:mt-0 @2xl:pt-3">
            {notes}
          </div>
        )}
        <div role="gridcell" className="col-start-3 row-start-1 flex h-11 items-center justify-end pr-0.5 @2xl:col-start-4">
          {menu}
        </div>
      </div>
    </div>
  );
}
