"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Task } from "@/lib/types";
import { flyIntoDay } from "./motion";

/** Where a dragged task would land: a day, in an ordered list the index it would take there, and which kind of zone it's over. */
export type DropTarget = { date: string; index: number | null; zone: string };

type DragApi = {
  /** onPointerDown of a draggable task: a mouse or pen drags at once, a finger after resting on the task for a moment. */
  start: (e: React.PointerEvent<HTMLElement>, task: Task) => void;
  dragging: Task | null;
  target: DropTarget | null;
};

const Ctx = createContext<DragApi>({ start: () => {}, dragging: null, target: null });
export const useDrag = () => useContext(Ctx);

const THRESHOLD = 5; // px of movement before a press becomes a drag
const EDGE = 56; // px from the scroller's edge where dragging scrolls it
const HOLD = 320; // ms a finger rests on a task before it lifts (a finger that moves sooner is scrolling or swiping)
const SLOP = 8; // px a resting finger may wander

/**
 * Drag and drop for tasks. Drop zones are plain markup: `data-drop-date` on anything that takes a task
 * (a list, a calendar day, a week column), and `data-drop-zone` naming its kind so only the zone under the pointer
 * lights up; with `data-drop-list` its `[data-task-row]` children set the order and a line shows where the task would
 * go. The task follows the pointer as a lifted card; Esc cancels. On touch screens a task lifts after the finger has
 * rested on it for a moment (with a short buzz); from then on the page holds still under it.
 */
export function DragProvider({
  scroller,
  onDrop,
  children,
}: {
  scroller: React.RefObject<HTMLElement | null>;
  onDrop: (task: Task, target: DropTarget) => void;
  children: React.ReactNode;
}) {
  const [dragging, setDragging] = useState<Task | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const press = useRef<{ task: Task; x: number; y: number; dx: number; dy: number; width: number; touch: boolean } | null>(null);
  const hold = useRef(0);
  const lift = useRef<() => void>(() => {});
  const active = useRef(false);
  const point = useRef({ x: 0, y: 0 });
  const targetRef = useRef<DropTarget | null>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const latest = useRef({ onDrop });
  latest.current = { onDrop };

  const start = useCallback((e: React.PointerEvent<HTMLElement>, task: Task) => {
    if (e.button !== 0 || e.altKey || e.metaKey || e.ctrlKey || !e.isPrimary) return;
    const blocker = (e.target as HTMLElement).closest("button, input, textarea, a, [data-no-drag]");
    if (blocker && e.currentTarget.contains(blocker)) return;
    const box = e.currentTarget.getBoundingClientRect();
    const touch = e.pointerType === "touch";
    press.current = { task, x: e.clientX, y: e.clientY, dx: e.clientX - box.left, dy: e.clientY - box.top, width: box.width, touch };
    point.current = { x: e.clientX, y: e.clientY };
    clearTimeout(hold.current);
    // A finger lifts the task by resting on it; a mouse by moving (below).
    if (touch) hold.current = window.setTimeout(() => press.current?.touch && lift.current(), HOLD);
  }, []);

  useEffect(() => {
    const placeGhost = () => {
      const p = press.current;
      if (!p || !ghost.current) return;
      ghost.current.style.transform = `translate(${point.current.x - Math.min(p.dx, 40)}px, ${point.current.y - p.dy}px)`;
    };
    const hideLine = () => {
      if (line.current) line.current.style.opacity = "0";
    };
    const hitTest = () => {
      const p = press.current;
      if (!p) return;
      const { x, y } = point.current;
      const zone = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-drop-date]");
      let next: DropTarget | null = null;
      if (zone) {
        const date = zone.dataset.dropDate!;
        let index: number | null = null;
        if (zone.hasAttribute("data-drop-list")) {
          const rows = [...zone.querySelectorAll<HTMLElement>("[data-task-row]")].filter(
            (r) => r.dataset.taskRow !== p.task.id && r.dataset.done !== "true" && r.closest("[data-drop-date]") === zone,
          );
          index = rows.findIndex((r) => {
            const b = r.getBoundingClientRect();
            return y < b.top + b.height / 2;
          });
          if (index < 0) index = rows.length;
          // The line sits in the gap the task would fill.
          const z = zone.getBoundingClientRect();
          const above = rows[index - 1]?.getBoundingClientRect();
          const below = rows[index]?.getBoundingClientRect();
          const at = above && below ? (above.bottom + below.top) / 2 : above ? above.bottom + 2 : below ? below.top - 2 : z.top + 8;
          if (line.current) {
            line.current.style.opacity = "1";
            line.current.style.transform = `translate(${z.left + 8}px, ${at - 1}px)`;
            line.current.style.width = `${Math.max(0, z.width - 16)}px`;
          }
        } else hideLine();
        next = { date, index, zone: zone.dataset.dropZone ?? "" };
      } else hideLine();
      const cur = targetRef.current;
      if (cur?.date !== next?.date || cur?.index !== next?.index || cur?.zone !== next?.zone) {
        targetRef.current = next;
        setTarget(next);
      }
    };
    // Near the top or bottom of the scrolling sheet, keep scrolling while the pointer rests there.
    const autoScroll = () => {
      frame.current = 0;
      if (!active.current) return;
      const el = scroller.current;
      const box = el && el.scrollHeight > el.clientHeight ? el.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
      const { y } = point.current;
      const speed = y < box.top + EDGE ? -(box.top + EDGE - y) : y > box.bottom - EDGE ? y - (box.bottom - EDGE) : 0;
      if (speed) {
        const step = Math.max(-18, Math.min(18, speed / 3));
        if (el && el.scrollHeight > el.clientHeight) el.scrollTop += step;
        else window.scrollBy(0, step);
        hitTest();
        frame.current = requestAnimationFrame(autoScroll);
      }
    };
    const end = (drop: boolean) => {
      const p = press.current;
      press.current = null;
      clearTimeout(hold.current);
      if (!active.current) return;
      active.current = false;
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      delete document.documentElement.dataset.dragging;
      const t = targetRef.current;
      targetRef.current = null;
      hideLine();
      // Dropped on the calendar: the card flies into the day (before it's taken away below).
      if (drop && p && t?.zone === "calendar") flyIntoDay(ghost.current, t.date);
      setDragging(null);
      setTarget(null);
      if (drop && p && t) latest.current.onDrop(p.task, t);
      // The release isn't a click on whatever is under it.
      const swallow = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
      };
      window.addEventListener("click", swallow, true);
      setTimeout(() => window.removeEventListener("click", swallow, true), 0);
    };
    // The press becomes a drag: the task lifts.
    lift.current = () => {
      const p = press.current;
      if (!p || active.current) return;
      active.current = true;
      document.documentElement.dataset.dragging = "";
      window.getSelection()?.removeAllRanges();
      if (p.touch) navigator.vibrate?.(8);
      setDragging(p.task);
      hitTest();
    };
    const onMove = (e: PointerEvent) => {
      const p = press.current;
      if (!p) return;
      if (!active.current) {
        if (p.touch) {
          // A finger that moves before the task has lifted is scrolling the page or swiping the row.
          if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLOP) {
            clearTimeout(hold.current);
            press.current = null;
          }
          return;
        }
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < THRESHOLD) return;
        point.current = { x: e.clientX, y: e.clientY };
        lift.current();
      }
      point.current = { x: e.clientX, y: e.clientY };
      placeGhost();
      hitTest();
      if (!frame.current) frame.current = requestAnimationFrame(autoScroll);
    };
    // While a finger carries a task, the page under it doesn't scroll.
    const onTouchMove = (e: TouchEvent) => {
      if (active.current && e.cancelable) e.preventDefault();
    };
    const onUp = () => end(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && active.current) {
        e.stopPropagation();
        e.preventDefault();
        end(false);
      }
    };
    const onBlur = () => end(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onBlur);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("pointerup", onUp);
      clearTimeout(hold.current);
      window.removeEventListener("pointercancel", onBlur);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", onBlur);
      cancelAnimationFrame(frame.current);
    };
  }, [scroller]);

  // The same object until a drag changes something, so rows that don't take part needn't redraw.
  const api = useMemo(() => ({ start, dragging, target }), [start, dragging, target]);

  // Place the card under the pointer as soon as it mounts.
  useEffect(() => {
    if (!dragging || !ghost.current || !press.current) return;
    const p = press.current;
    ghost.current.style.transform = `translate(${point.current.x - Math.min(p.dx, 40)}px, ${point.current.y - p.dy}px)`;
  }, [dragging]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {dragging &&
        createPortal(
          <>
            <div ref={ghost} aria-hidden="true" className="pointer-events-none fixed top-0 left-0 z-[200]" style={{ width: Math.min(press.current?.width ?? 320, 360) }}>
              <div className="flex animate-[lift_var(--duration-fast)_var(--ease-out)_both] items-center gap-3 rounded-lg bg-elevated px-3 py-2.5 shadow-float">
                <span className={`size-[18px] flex-none rounded-full ${dragging.done ? "bg-accent" : "border-[1.5px] border-check-ring"}`} />
                <span className={`truncate text-body ${dragging.done ? "text-ink-3" : "text-ink"}`}>{dragging.title}</span>
              </div>
            </div>
            <div
              ref={line}
              aria-hidden="true"
              className="pointer-events-none fixed top-0 left-0 z-[190] h-[2px] rounded-full bg-accent opacity-0 transition-opacity duration-(--duration-press) before:absolute before:-top-[3px] before:-left-1 before:size-2 before:rounded-full before:border-2 before:border-accent before:bg-surface"
            />
          </>,
          document.body,
        )}
    </Ctx.Provider>
  );
}
