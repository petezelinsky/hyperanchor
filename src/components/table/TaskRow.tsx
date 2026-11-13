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
            <CheckIcon size={13} />
            {done ? "Open" : "Done"}
          </>
        ) : (
          <>
            Tomorrow
            <ArrowRightIcon size={14} />
          </>
        )}
      </span>
    </div>
  );
}

/**
 * A task in a list or on the week board: its box and its title (notes aren't shown on the web for now; they stay with
 * the task). Memoized: a change to one task redraws its row, not the whole list.
 */
export const TaskRow = memo(function TaskRow({
  task,
  selected,
  active = false,
  editingField,
  variant = "row",
  tomorrow,
  actions,
  onMenu,
}: {
  task: Task;
  selected: boolean;
  /** Its menu is open: the row looks picked, without opening up its title (so nothing moves under the menu). */
  active?: boolean;
  editingField: Field | null;
  /** A list row, or a card in a week column. */
  variant?: "row" | "card";
  /** The date a left swipe moves the task to. */
  tomorrow: string;
  actions: TableActions;
  onMenu: (task: Task, anchor: DOMRect | { x: number; y: number }, trigger?: HTMLElement) => void;
}) {
  const editing = editingField !== null;
  const titleRef = useFocusEnd(editing);
  const drag = useDrag();
  const lifted = drag.dragging?.id === task.id;
  const card = variant === "card";
  const { dx, back, ...swipeHandlers } = useSwipe(
    () => actions.toggle(task),
    () => actions.move(task, tomorrow),
  );

  const keys = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      actions.cancelEdit();
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      actions.finishEdit();
    }
  };

  // A finished task on the week board steps back to one quiet line (picking it shows it whole again).
  const compact = card && task.done && !selected && !editing;
  // Lists: 15px titles (16px on phones, which also keeps them from zooming in on a field). Cards: 13px.
  const titleText = card ? "text-footnote" : "text-[16px] leading-[22px] md:text-callout";
  // Cards are narrow: long words hyphenate rather than break mid-word.
  // (line-clamp brings its own display, so it never goes with `block`.)
  // A picked task shows its title whole; otherwise one line in lists, two on cards.
  const titleFit = selected ? "block w-full break-words hyphens-calm" : card && !compact ? "line-clamp-2 w-full break-words hyphens-calm" : "block w-full truncate";
  const titleCls = `${titleFit} ${titleText} transition-colors duration-(--duration-base) ${task.done ? "text-ink-3" : "text-ink"}`;

  // The first click picks a task and shows it whole; a click on the picked task, Enter or a double click edits it.
  const title = editing ? (
    <AutoTextarea
      ref={titleRef}
      value={task.title}
      onChange={(e) => actions.change(task.id, { title: e.target.value.replace(/\n/g, " ") })}
      onKeyDown={keys}
      aria-label="Task title"
      maxLength={500}
      dir="auto"
      className={`${titleText} text-ink`}
    />
  ) : (
    <span dir="auto" className={titleCls} onClick={() => selected && actions.startEdit(task.id, "title")} onDoubleClick={() => actions.startEdit(task.id, "title")}>
      {task.title}
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
  // ⋯ waits for the pointer; under it, it becomes a white tile with an edge, so it shows on any row (done ones too).
  const menu = (
    <IconButton
      label="More actions"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        onMenu(task, e.currentTarget.getBoundingClientRect(), e.currentTarget);
      }}
      className={`text-ink-2! hover:bg-surface! hover:text-ink! hover:shadow-[inset_0_0_0_1px_var(--line-2)] ${card ? "size-6 bg-(--row-bg) " : ""}${
        active ? "bg-surface! text-ink! shadow-[inset_0_0_0_1px_var(--line-2)] opacity-100" : selected ? "opacity-100" : "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
      }`}
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
      onMenu(task, { x: e.clientX, y: e.clientY });
    },
  } as const;

  if (card) {
    return (
      <div
        {...common}
        onPointerDown={(e) => !editing && drag.start(e, task)}
        // A line of the day, like a row in the Day list: no card until it's picked up. --row-bg is its shade right now,
        // which the ⋯ button and the fade under it take on.
        className={`group/row relative rounded-sm ${compact ? "py-[5px]" : "py-1.5"} px-1.5 transition-[background-color,box-shadow,opacity] duration-(--duration-fast) ${
          lifted ? "opacity-35" : ""
        } ${
          selected || editing || active
            ? "bg-surface-3 shadow-ring-line-2 [--row-bg:var(--surface-3)]"
            : "[--row-bg:var(--surface-2)] hover:bg-surface-2 hover:shadow-ring-line-2"
        }`}
      >
        <div className="flex items-start gap-2">
          <div role="gridcell" className="flex-none">
            {checkbox}
          </div>
          {/* The ⋯ button shows over the corner on hover, so titles keep the card's full width (touch keeps room for it). */}
          <div role="gridcell" className="min-w-0 flex-1 pointer-coarse:pr-5">
            {title}
          </div>
        </div>
        <div role="gridcell" className="absolute top-1 right-1 flex">
          {/* Under the pointer the title fades out before the ⋯, rather than running under it. */}
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-0 right-full w-5 bg-[linear-gradient(to_right,transparent,var(--row-bg))] transition-opacity duration-(--duration-fast) pointer-coarse:hidden ${
              selected || active ? "opacity-100" : "opacity-0 group-hover/row:opacity-100"
            }`}
          />
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
      // Rows are divided by hairlines that start where the text starts. Under the pointer a row becomes a soft box with
      // an edge (its ring covers the hairlines around it); a picked one is a shade darker. It clips only while swiped (so
      // the menu button's touch area can reach past its edge).
      className={`group/row relative transition-[background-color,box-shadow,opacity] duration-(--duration-fast) md:rounded-sm ${dx !== 0 ? "overflow-hidden" : ""} after:pointer-events-none after:absolute after:right-4 after:bottom-0 after:left-[46px] after:h-px after:bg-line md:after:right-3 md:after:left-[42px] ${
        selected || editing || active
          ? "z-[1] bg-surface-3 shadow-ring-line-2 after:opacity-0"
          : "pointer-fine:hover:z-[1] pointer-fine:hover:bg-surface-2 pointer-fine:hover:shadow-ring-line-2 pointer-fine:hover:after:opacity-0"
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
          {title}
        </div>
        <div role="gridcell" className="col-start-3 row-start-1 flex h-[50px] items-center justify-end md:h-12">
          {menu}
        </div>
      </div>
    </div>
  );
});
