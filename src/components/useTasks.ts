"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "@/lib/types";

type Fields = Pick<Task, "title" | "description" | "date" | "done" | "position">;
type Notify = (message: string, action?: { label: string; run: () => void }) => void;

/**
 * A change the server hasn't confirmed yet. Changes wait in this browser (localStorage) until it has, so nothing ticked
 * or typed without a network is lost, not even across a reload. `title` names the task in messages.
 */
type Change = { id: string; title: string } & ({ kind: "create"; body: Task } | { kind: "patch"; body: Partial<Fields> } | { kind: "delete" });
type Op = Change & { n: string };

/** Why saving stopped: no network, or the server refused for now. */
export type Trouble = "offline" | "error" | null;

class HttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

async function request(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 401) {
    // Session expired: back to the sign-in screen. Waiting changes stay in this browser for the next visit.
    window.location.reload();
    throw new HttpError(401);
  }
  if (!res.ok) throw new HttpError(res.status);
  return res.status === 204 ? null : res.json();
}

/** The waiting changes, kept in localStorage (or in memory where storage isn't available). */
function outbox(key: string) {
  let memory: Op[] | null = null;
  const read = (): Op[] => {
    if (memory) return memory;
    try {
      return JSON.parse(localStorage.getItem(key) ?? "[]");
    } catch {
      return (memory = []);
    }
  };
  const write = (ops: Op[]) => {
    if (!memory)
      try {
        if (ops.length) localStorage.setItem(key, JSON.stringify(ops));
        else localStorage.removeItem(key);
        return;
      } catch {}
    memory = ops;
  };
  return { key, read, write };
}

/**
 * Client-side task cache. Local state is authoritative while editing: every change shows at once and joins a queue of
 * changes waiting for the server. The queue goes out oldest first — a task's own changes one after another, different
 * tasks side by side — and, without a network, waits (in localStorage) until it's back. Whatever the server sends in the
 * meantime is shown with the waiting changes on top, so a reload never undoes them.
 */
export function useTasks(account: string, notify: Notify) {
  const [tasks, setTasks] = useState<Record<string, Task>>({});
  // The ranges that have come back from the server at least once (so a page can tell "nothing there" from "not yet").
  const covered = useRef<[string, string][]>([]);
  // Requests on the wire (for the "Saving…" hint), changes still waiting, and whether the first load has come back.
  const [inFlight, setInFlight] = useState(0);
  const [waiting, setWaiting] = useState(0);
  const [trouble, setTrouble] = useState<Trouble>(null);
  const [loads, setLoads] = useState(0);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const engine = useMemo(() => {
    const box = outbox(`hyperanchor:outbox:${account}`);
    // Ranges loaded recently (main view, mini calendar, analytics…); all are re-fetched when the network is back.
    const ranges = new Map<string, [string, string]>();
    // Typing is batched: a pending patch per task, sent after a pause.
    const pendingPatch = new Map<string, Partial<Fields>>();
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const tab = Math.random().toString(36).slice(2, 8);
    let seq = 0;
    let paused = false;
    let problem: Trouble = null;
    let draining = false;
    let again = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = 2000;

    const counted = () => setWaiting(box.read().length);

    /** What the server sent, with the waiting changes applied on top (they're newer); typing in progress keeps its text. */
    const settle = (prev: Record<string, Task>, next: Record<string, Task>) => {
      for (const op of box.read()) {
        if (op.kind === "delete") delete next[op.id];
        else if (op.kind === "create") next[op.id] = { ...next[op.id], ...op.body };
        else if (next[op.id]) next[op.id] = { ...next[op.id], ...op.body };
      }
      for (const id of timers.keys()) if (prev[id]) next[id] = prev[id];
      return next;
    };

    /** A request got through: the network is there (a server error clears only once the queue is empty). */
    const reached = () => {
      if (problem !== "offline") return;
      problem = null;
      setTrouble(null);
      retryDelay = 2000;
    };
    /**
     * Saving stops and is tried again by itself, a little later each time (at most every 30 s), at once when the network
     * comes back. One message per stretch of trouble.
     */
    const fail = (kind: Exclude<Trouble, null>, message: string, action?: { label: string; run: () => void }) => {
      paused = true;
      if (problem !== kind) {
        problem = kind;
        setTrouble(kind);
        notifyRef.current(message, action);
      }
      retryTimer ??= setTimeout(() => {
        retryDelay = Math.min(retryDelay * 2, 30_000);
        resume();
      }, retryDelay);
    };
    const offline = () => fail("offline", "You’re offline. Your changes will save when you’re back.");

    function resume() {
      clearTimeout(retryTimer);
      retryTimer = undefined;
      const wasOffline = problem === "offline";
      paused = false;
      void drain();
      // Back online: catch up with changes made elsewhere in the meantime.
      if (wasOffline) for (const [from, to] of [...ranges.values()]) void load(from, to);
    }

    const send = (op: Op) =>
      op.kind === "create"
        ? request("/api/tasks", { method: "POST", body: JSON.stringify(op.body) })
        : op.kind === "patch"
          ? request(`/api/tasks/${op.id}`, { method: "PATCH", body: JSON.stringify(op.body) })
          : request(`/api/tasks/${op.id}`, { method: "DELETE" });

    /** After a failed send: true when the change should leave the queue. */
    const settled = (op: Op, e: unknown) => {
      if (!(e instanceof HttpError)) {
        offline();
        return false;
      }
      if (e.status === 401) {
        paused = true; // the page is reloading
        return false;
      }
      // Already done: the task is gone (deleted elsewhere), or the create got through before.
      if (e.status === 409 && op.kind === "create") return true;
      if (e.status === 404 && op.kind !== "create") {
        if (op.kind === "patch") setTasks(({ [op.id]: _, ...rest }) => rest);
        return true;
      }
      if (e.status >= 500 || e.status === 408 || e.status === 429) {
        fail("error", `Couldn’t save “${op.title}”.`, { label: "Try again", run: resume });
        return false;
      }
      // The server won't take this change: let it go and show what the server has.
      notifyRef.current(`Couldn’t save “${op.title}”.`);
      for (const [from, to] of [...ranges.values()]) void load(from, to);
      return true;
    };

    /** Sends what's waiting, oldest first: a task's own changes one after another, up to six tasks at once. */
    async function drain() {
      if (draining) {
        again = true;
        return;
      }
      draining = true;
      const run = async () => {
        do {
          again = false;
          while (!paused) {
            const seen = new Set<string>();
            const batch = box
              .read()
              .filter((op) => !seen.has(op.id) && !!seen.add(op.id))
              .slice(0, 6);
            if (!batch.length) break;
            const gone = new Set<string>();
            await Promise.all(
              batch.map(async (op) => {
                setInFlight((k) => k + 1);
                try {
                  await send(op);
                  reached();
                  gone.add(op.n);
                } catch (e) {
                  if (settled(op, e)) gone.add(op.n);
                } finally {
                  setInFlight((k) => k - 1);
                }
              }),
            );
            box.write(box.read().filter((op) => !gone.has(op.n)));
            counted();
          }
        } while (again && !paused);
        // Everything went out: whatever the trouble was, it's over.
        if (!paused && !box.read().length && problem) {
          problem = null;
          setTrouble(null);
          retryDelay = 2000;
        }
      };
      try {
        // One tab sends at a time, so two open tabs never send the same change twice.
        if (navigator.locks) await navigator.locks.request(box.key, run);
        else await run();
      } catch {
        // Nothing to do: whatever didn't go out is still waiting.
      } finally {
        draining = false;
      }
    }

    const push = (change: Change) => {
      box.write([...box.read(), { ...change, n: `${tab}.${++seq}` }]);
      counted();
      void drain();
    };

    async function load(from: string, to: string) {
      ranges.delete(`${from}|${to}`);
      ranges.set(`${from}|${to}`, [from, to]);
      while (ranges.size > 4) ranges.delete(ranges.keys().next().value!);
      try {
        const { tasks: fetched } = (await request(`/api/tasks?from=${from}&to=${to}`)) as { tasks: Task[] };
        back();
        setTasks((prev) => {
          const next: Record<string, Task> = {};
          for (const t of Object.values(prev)) if (t.date < from || t.date > to) next[t.id] = t;
          for (const t of fetched) next[t.id] = t;
          return settle(prev, next);
        });
        covered.current = [...covered.current.filter(([a, b]) => !(a >= from && b <= to)), [from, to] as [string, string]].slice(-24);
        setLoads((n) => n + 1);
      } catch (e) {
        failedLoad(e, () => load(from, to));
      }
    }

    /** A load got through while changes waited for the network: send them now rather than at the next retry. */
    const back = () => {
      const wasOffline = problem === "offline";
      reached();
      if (wasOffline && paused) {
        clearTimeout(retryTimer);
        retryTimer = undefined;
        paused = false;
        void drain();
      }
    };

    const failedLoad = (e: unknown, retry: () => void) => {
      if (!(e instanceof HttpError)) offline();
      else if (e.status !== 401) notifyRef.current("Couldn’t load your tasks.", { label: "Try again", run: retry });
    };

    /**
     * Every task still open before `before` (today), whatever its date: Today offers to bring them along. Open tasks
     * from earlier days that the server no longer lists were finished or deleted elsewhere, so they leave the store.
     */
    async function loadOpen(before: string) {
      try {
        const { tasks: fetched } = (await request(`/api/tasks/open?before=${before}`)) as { tasks: Task[] };
        back();
        const ids = new Set(fetched.map((t) => t.id));
        setTasks((prev) => {
          const next: Record<string, Task> = {};
          for (const t of Object.values(prev)) if (t.done || t.date >= before || ids.has(t.id)) next[t.id] = t;
          for (const t of fetched) next[t.id] = t;
          return settle(prev, next);
        });
      } catch (e) {
        failedLoad(e, () => loadOpen(before));
      }
    }

    const flush = (id: string) => {
      clearTimeout(timers.get(id));
      timers.delete(id);
      const patch = pendingPatch.get(id);
      pendingPatch.delete(id);
      if (patch && Object.keys(patch).length) push({ kind: "patch", id, body: patch, title: patch.title ?? tasksRef.current[id]?.title ?? "" });
    };

    return {
      load,
      loadOpen,
      drain,
      resume: () => problem && resume(),
      counted,
      flushAll: () => [...timers.keys()].forEach(flush),
      box,

      create: (input: Omit<Fields, "position"> & { position?: number | null }) => {
        const now = new Date().toISOString();
        const task: Task = { position: null, ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
        setTasks((prev) => ({ ...prev, [task.id]: task }));
        push({ kind: "create", id: task.id, body: task, title: task.title });
        return task.id;
      },

      /** Applies `patch` locally and saves it — now, or after `delay` ms of inactivity (for typing). */
      edit: (id: string, patch: Partial<Fields>, delay = 0) => {
        if (Object.keys(patch).length) setTasks((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...patch } } : prev));
        pendingPatch.set(id, { ...pendingPatch.get(id), ...patch });
        if (delay > 0) {
          clearTimeout(timers.get(id));
          timers.set(id, setTimeout(() => flush(id), delay));
        } else {
          flush(id);
        }
      },

      remove: (id: string) => {
        clearTimeout(timers.get(id));
        timers.delete(id);
        pendingPatch.delete(id);
        const title = tasksRef.current[id]?.title ?? "";
        setTasks(({ [id]: _, ...rest }) => rest);
        push({ kind: "delete", id, title });
      },

      /** Puts a deleted task back (undo), keeping its id. */
      restore: (task: Task) => {
        setTasks((prev) => ({ ...prev, [task.id]: task }));
        push({ kind: "create", id: task.id, body: task, title: task.title });
      },

      /** Adds tasks fetched elsewhere (search results), with the waiting changes on top. */
      merge: (list: Task[]) =>
        setTasks((prev) => {
          const next = { ...prev };
          for (const t of list) next[t.id] = t;
          return settle(prev, next);
        }),
    };
  }, [account]);

  useEffect(() => {
    // Changes left from an earlier visit go out first.
    engine.counted();
    void engine.drain();
    const back = () => engine.resume();
    const shown = () => document.visibilityState === "visible" && engine.resume();
    // Another tab changed the queue: show its count, and pick up what it may have left behind.
    const other = (e: StorageEvent) => {
      if (e.key !== engine.box.key) return;
      engine.counted();
      void engine.drain();
    };
    // Leaving with text still being typed: it joins the queue (and so outlives the page).
    const leaving = () => engine.flushAll();
    window.addEventListener("online", back);
    document.addEventListener("visibilitychange", shown);
    window.addEventListener("storage", other);
    window.addEventListener("pagehide", leaving);
    return () => {
      window.removeEventListener("online", back);
      document.removeEventListener("visibilitychange", shown);
      window.removeEventListener("storage", other);
      window.removeEventListener("pagehide", leaving);
    };
  }, [engine]);

  const { load, loadOpen, create, edit, remove, restore, merge } = engine;
  /** Whether every day from `from` to `to` has come back from the server (in one range). Changes with `loads`. */
  const covers = (from: string, to: string) => covered.current.some(([a, b]) => a <= from && b >= to);
  return { tasks, load, loadOpen, create, edit, remove, restore, merge, saving: inFlight > 0, waiting, trouble, loads, covers };
}
