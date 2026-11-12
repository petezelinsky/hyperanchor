import type { Sort } from "@/lib/tasks";
import type { Task } from "@/lib/types";

export type Field = "title" | "description";

export type Editing = { id: string; field: Field; snapshot: Pick<Task, "title" | "description"> };

/**
 * A new task being written on `date`; its text lives in the composer until Enter. A new nonce starts it afresh. New
 * tasks land at the top of the day, in the order they're written: each one after the one added just before (`after`).
 */
export type Composer = { date: string; nonce: number; after?: string };

/** A day's tasks; in the Day view `tasks` holds what's left and `completed` what's done. */
export type Section = { date: string; tasks: Task[]; completed?: Task[] };

/** Everything a table can ask the app to do. Implemented once in TaskApp. */
export type TableActions = {
  select: (id: string | null) => void;
  startEdit: (id: string, field: Field) => void;
  finishEdit: () => void;
  cancelEdit: () => void;
  change: (id: string, patch: Partial<Pick<Task, "title" | "description">>) => void;
  toggle: (task: Task) => void;
  move: (task: Task, date: string) => void;
  remove: (task: Task) => void;
  openComposer: (date: string) => void;
  composerChange: (patch: Partial<Pick<Task, "title" | "description">>) => void;
  composerSubmit: (keepOpen: boolean) => void;
  composerCancel: () => void;
  sort: (sort: Sort) => void;
};

export type TableState = {
  todayKey: string;
  selectedId: string | null;
  editing: Editing | null;
  composer: Composer | null;
  sort: Sort;
};
