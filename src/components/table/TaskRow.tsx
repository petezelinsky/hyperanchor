"use client";

import { useEffect, useRef } from "react";
import { formatStamp } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { AutoTextarea } from "../AutoTextarea";
import { EllipsisIcon } from "../icons";
import { Checkbox, IconButton } from "../ui";
import type { Field, TableActions } from "./types";

// Responsive columns (container queries): check | task | notes | added | menu.
export const COLS =
  "grid grid-cols-[36px_minmax(0,1fr)_32px] @2xl:grid-cols-[36px_minmax(180px,2fr)_minmax(0,3fr)_32px] @4xl:grid-cols-[36px_minmax(200px,2fr)_minmax(0,3fr)_88px_32px]";

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

export function TaskRow({
  task,
  todayKey,
  selected,
  editingField,
  actions,
  onMenu,
}: {
  task: Task;
  todayKey: string;
  selected: boolean;
  editingField: Field | null;
  actions: TableActions;
  onMenu: (task: Task, anchor: DOMRect | { x: number; y: number }, trigger?: HTMLElement) => void;
}) {
  const titleRef = useFocusEnd(editingField === "title");
  const notesRef = useFocusEnd(editingField === "description");
  const editing = editingField !== null;

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

  const titleCls = `block w-full truncate text-[14px] leading-5 ${task.done ? "text-label-3" : "text-label"}`;
  const notesCls = "block w-full truncate text-[13px] leading-[19px] text-label-2";

  const title = editingField === "title" ? (
    <input
      ref={titleRef}
      value={task.title}
      onChange={(e) => actions.change(task.id, { title: e.target.value })}
      onKeyDown={keys("title")}
      aria-label="Task title"
      maxLength={500}
      className={`${titleCls} m-0 bg-transparent p-0 text-label outline-none`}
    />
  ) : (
    <span className={titleCls} onClick={() => actions.startEdit(task.id, "title")}>
      {task.title}
    </span>
  );

  // One notes element: under the title in narrow tables, in its own column from @2xl (grid placement below).
  const hasNotes = !!task.description || editingField === "description";
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
        className="text-[13px] leading-[19px] text-label"
      />
    ) : task.description ? (
      <span className={notesCls} onClick={() => actions.startEdit(task.id, "description")}>
        {task.description.replace(/\s*\n\s*/g, " · ")}
      </span>
    ) : (
      <span
        className={`${notesCls} text-label-3 transition-opacity duration-150 ${selected ? "opacity-100" : "opacity-0 group-hover/row:opacity-100"}`}
        onClick={() => actions.startEdit(task.id, "description")}
      >
        Add note
      </span>
    );

  return (
    <div
      role="row"
      aria-selected={selected}
      data-task-row={task.id}
      data-editing={editing ? "true" : "false"}
      onClick={() => actions.select(task.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        actions.select(task.id);
        onMenu(task, { x: e.clientX, y: e.clientY });
      }}
      className={`group/row relative ${COLS} min-h-10 items-start rounded-[7px] px-1 transition-colors duration-100 after:pointer-events-none after:absolute after:right-2 after:bottom-0 after:left-11 after:h-px after:bg-separator ${
        selected || editing ? "bg-accent-soft after:opacity-0" : "hover:bg-fill-3"
      }`}
    >
      <div role="gridcell" className="col-start-1 row-start-1 flex h-10 items-center justify-center">
        <Checkbox
          checked={task.done}
          onToggle={() => {
            actions.select(task.id);
            actions.toggle(task);
          }}
          label={task.done ? `Mark “${task.title}” as not done` : `Mark “${task.title}” as done`}
        />
      </div>
      <div role="gridcell" className="col-start-2 row-start-1 min-w-0 py-[10px] pr-3">
        {title}
      </div>
      <div
        role="gridcell"
        className={`col-start-2 row-start-2 -mt-2 min-w-0 pr-3 pb-[10px] @2xl:col-start-3 @2xl:row-start-1 @2xl:mt-0 @2xl:pt-[10px] ${hasNotes ? "" : "@max-2xl:hidden"}`}
      >
        {notes}
      </div>
      <div role="gridcell" className="tabular hidden py-[11px] pr-2 text-right text-[12.5px] leading-[18px] text-label-3 @4xl:col-start-4 @4xl:row-start-1 @4xl:block">
        {formatStamp(task.createdAt, todayKey)}
      </div>
      <div role="gridcell" className="col-start-3 row-start-1 flex h-10 items-center justify-end @2xl:col-start-4 @4xl:col-start-5">
        <IconButton
          label="More actions"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            actions.select(task.id);
            onMenu(task, e.currentTarget.getBoundingClientRect(), e.currentTarget);
          }}
          className={selected ? "opacity-100" : "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"}
        >
          <EllipsisIcon />
        </IconButton>
      </div>
    </div>
  );
}
