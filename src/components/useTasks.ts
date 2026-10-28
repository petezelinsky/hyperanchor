"use client";

import { useCallback, useRef, useState } from "react";
import type { Task } from "@/lib/types";

type Fields = Pick<Task, "title" | "description" | "date" | "done">;

async function request(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 401) {
    // Session expired: back to the sign-in screen.
    window.location.reload();
    throw new Error("Signed out");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

/**
 * Client-side task cache. Local state is authoritative while editing: mutations apply immediately,
 * requests for the same task run in order, and typing is batched into debounced PATCHes.
 * On any failure the visible range is re-fetched so the screen matches the server again.
 */
export function useTasks(onError: (message: string) => void) {
  const [tasks, setTasks] = useState<Record<string, Task>>({});
  // Ranges loaded recently (main view, mini calendar, analytics…); all are re-fetched after a failure.
  const ranges = useRef(new Map<string, [string, string]>());
  const chains = useRef(new Map<string, Promise<unknown>>());
  const pendingPatch = useRef(new Map<string, Partial<Fields>>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const busy = useRef(new Map<string, number>()); // in-flight or scheduled work per task

  const isBusy = (id: string) => (busy.current.get(id) ?? 0) > 0 || timers.current.has(id);

  const load = useCallback(
    async (from: string, to: string) => {
      ranges.current.delete(`${from}|${to}`);
      ranges.current.set(`${from}|${to}`, [from, to]);
      while (ranges.current.size > 4) ranges.current.delete(ranges.current.keys().next().value!);
      try {
        const { tasks: fetched } = (await request(`/api/tasks?from=${from}&to=${to}`)) as { tasks: Task[] };
        setTasks((prev) => {
          const next: Record<string, Task> = {};
          for (const t of Object.values(prev)) {
            if (t.date < from || t.date > to || isBusy(t.id)) next[t.id] = t;
          }
          for (const t of fetched) if (!isBusy(t.id)) next[t.id] = t;
          return next;
        });
      } catch (e) {
        onError(e instanceof Error ? e.message : "Couldn’t load tasks");
      }
    },
    [onError],
  );

  /** Runs `req` after earlier requests for the same task. */
  const enqueue = useCallback(
    (id: string, req: () => Promise<unknown>) => {
      busy.current.set(id, (busy.current.get(id) ?? 0) + 1);
      const run = (chains.current.get(id) ?? Promise.resolve()).then(req).catch((e) => {
        onError(e instanceof Error ? e.message : "Something went wrong");
        busy.current.set(id, 0);
        // Copy first: load() moves its range to the end of the map, which would keep a live iteration going forever.
        for (const [from, to] of [...ranges.current.values()]) load(from, to);
      });
      const tail = run.finally(() => {
        busy.current.set(id, Math.max(0, (busy.current.get(id) ?? 1) - 1));
        if (chains.current.get(id) === tail) chains.current.delete(id);
      });
      chains.current.set(id, tail);
    },
    [onError, load],
  );

  const flush = useCallback(
    (id: string) => {
      clearTimeout(timers.current.get(id));
      timers.current.delete(id);
      const patch = pendingPatch.current.get(id);
      pendingPatch.current.delete(id);
      if (!patch || !Object.keys(patch).length) return;
      enqueue(id, () => request(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }));
    },
    [enqueue],
  );

  const create = useCallback(
    (input: Fields) => {
      const now = new Date().toISOString();
      const task: Task = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
      setTasks((prev) => ({ ...prev, [task.id]: task }));
      enqueue(task.id, () => request("/api/tasks", { method: "POST", body: JSON.stringify(task) }));
      return task.id;
    },
    [enqueue],
  );

  /** Applies `patch` locally and saves it — now, or after `delay` ms of inactivity (for typing). */
  const edit = useCallback(
    (id: string, patch: Partial<Fields>, delay = 0) => {
      if (Object.keys(patch).length) setTasks((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...patch } } : prev));
      pendingPatch.current.set(id, { ...pendingPatch.current.get(id), ...patch });
      if (delay > 0) {
        clearTimeout(timers.current.get(id));
        timers.current.set(id, setTimeout(() => flush(id), delay));
      } else {
        flush(id);
      }
    },
    [flush],
  );

  const remove = useCallback(
    (id: string) => {
      clearTimeout(timers.current.get(id));
      timers.current.delete(id);
      pendingPatch.current.delete(id);
      setTasks(({ [id]: _, ...rest }) => rest);
      enqueue(id, () => request(`/api/tasks/${id}`, { method: "DELETE" }));
    },
    [enqueue],
  );

  /** Puts a deleted task back (undo), keeping its id. */
  const restore = useCallback(
    (task: Task) => {
      setTasks((prev) => ({ ...prev, [task.id]: task }));
      const { id, title, description, date, done } = task;
      enqueue(id, () => request("/api/tasks", { method: "POST", body: JSON.stringify({ id, title, description, date, done }) }));
    },
    [enqueue],
  );

  return { tasks, load, create, edit, remove, restore };
}
