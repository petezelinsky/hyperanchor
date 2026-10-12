"use client";

import { useCallback, useRef, useState } from "react";
import type { Task } from "@/lib/types";

type Patch = Partial<Pick<Task, "title" | "description" | "date" | "done">>;

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

/** Client-side task cache with optimistic mutations. */
export function useTasks(onError: (message: string) => void) {
  const [tasks, setTasks] = useState<Record<string, Task>>({});
  const pending = useRef(new Set<string>());

  const load = useCallback(
    async (from: string, to: string) => {
      try {
        const { tasks: fetched } = (await request(`/api/tasks?from=${from}&to=${to}`)) as { tasks: Task[] };
        setTasks((prev) => {
          const next: Record<string, Task> = {};
          for (const t of Object.values(prev)) {
            if (t.date < from || t.date > to || pending.current.has(t.id)) next[t.id] = t;
          }
          for (const t of fetched) if (!pending.current.has(t.id)) next[t.id] = t;
          return next;
        });
      } catch (e) {
        onError(e instanceof Error ? e.message : "Couldn’t load tasks");
      }
    },
    [onError],
  );

  const run = useCallback(
    async (id: string, rollback: () => void, req: () => Promise<{ task: Task } | null>) => {
      pending.current.add(id);
      try {
        const res = await req();
        if (res?.task) setTasks((prev) => (prev[id] ? { ...prev, [id]: res.task } : prev));
      } catch (e) {
        rollback();
        onError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        pending.current.delete(id);
      }
    },
    [onError],
  );

  const create = useCallback(
    (input: Pick<Task, "title" | "description" | "date" | "done">) => {
      const now = new Date().toISOString();
      const task: Task = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
      setTasks((prev) => ({ ...prev, [task.id]: task }));
      return run(
        task.id,
        () => setTasks(({ [task.id]: _, ...rest }) => rest),
        () => request("/api/tasks", { method: "POST", body: JSON.stringify(task) }),
      );
    },
    [run],
  );

  const update = useCallback(
    (id: string, patch: Patch) => {
      let before: Task | undefined;
      setTasks((prev) => {
        before = prev[id];
        return before ? { ...prev, [id]: { ...before, ...patch } } : prev;
      });
      return run(
        id,
        () => setTasks((prev) => (before ? { ...prev, [id]: before } : prev)),
        () => request(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
      );
    },
    [run],
  );

  const remove = useCallback(
    (id: string) => {
      let before: Task | undefined;
      setTasks((prev) => {
        before = prev[id];
        const { [id]: _, ...rest } = prev;
        return rest;
      });
      return run(
        id,
        () => setTasks((prev) => (before ? { ...prev, [id]: before } : prev)),
        () => request(`/api/tasks/${id}`, { method: "DELETE" }),
      );
    },
    [run],
  );

  return { tasks, load, create, update, remove };
}
