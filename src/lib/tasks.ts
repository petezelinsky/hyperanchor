import type { Task } from "./types";

export type SortKey = "manual" | "added" | "title";
export type Sort = { key: SortKey; dir: "asc" | "desc" };

/** The person's own order: creation order until tasks are dragged around. */
export const DEFAULT_SORT: Sort = { key: "manual", dir: "asc" };

/** Where a task sits in its day's manual order: its position once it has been moved, its creation time until then. */
export const placeOf = (t: Task) => t.position ?? Date.parse(t.createdAt);

const byAdded = (a: Task, b: Task) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/** Sorted copy. Ties always fall back to creation order so rows never shuffle. */
export function sortTasks(tasks: Task[], sort: Sort): Task[] {
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...tasks].sort((a, b) => {
    let c = 0;
    if (sort.key === "title") c = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    else if (sort.key === "manual") c = placeOf(a) - placeOf(b);
    else c = byAdded(a, b);
    return c * dir || byAdded(a, b);
  });
}

/** A position that puts a task between `before` and `after` (either may be missing) in a manually ordered list. */
export function placeBetween(before: Task | undefined, after: Task | undefined): number {
  if (before && after) return (placeOf(before) + placeOf(after)) / 2;
  if (before) return placeOf(before) + 1000;
  if (after) return placeOf(after) - 1000;
  return Date.now();
}

