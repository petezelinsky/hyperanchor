import type { Task } from "./types";

export type SortKey = "added" | "title" | "status";
export type Sort = { key: SortKey; dir: "asc" | "desc" };

export const DEFAULT_SORT: Sort = { key: "added", dir: "asc" };

const byAdded = (a: Task, b: Task) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/** Sorted copy. Ties always fall back to creation order so rows never shuffle. */
export function sortTasks(tasks: Task[], sort: Sort): Task[] {
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...tasks].sort((a, b) => {
    let c = 0;
    if (sort.key === "title") c = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    else if (sort.key === "status") c = Number(a.done) - Number(b.done);
    else c = byAdded(a, b);
    return c * dir || byAdded(a, b);
  });
}

export function matchesQuery(t: Task, query: string) {
  const q = query.trim().toLowerCase();
  return !q || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
}

/** Next sort when a column header is clicked: asc → desc → back to the default order. */
export function nextSort(current: Sort, key: SortKey): Sort {
  if (current.key !== key) return { key, dir: "asc" };
  if (current.dir === "asc") return { key, dir: "desc" };
  return DEFAULT_SORT;
}
