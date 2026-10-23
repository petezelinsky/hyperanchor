import type { Sort, SortKey } from "@/lib/tasks";
import type { Task } from "@/lib/types";

export type Field = "title" | "description";

export type Editing = { id: string; field: Field; snapshot: Pick<Task, "title" | "description"> };

export type Composer = { date: string; title: string; description: string; nonce: number };

export type Section = { date: string; tasks: Task[] };

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
  composerChange: (patch: Partial<Composer>) => void;
  composerSubmit: (keepOpen: boolean) => void;
  composerCancel: () => void;
  sort: (key: SortKey) => void;
};

export type TableState = {
  todayKey: string;
  selectedId: string | null;
  editing: Editing | null;
  composer: Composer | null;
  sort: Sort;
};
