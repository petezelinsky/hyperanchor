"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, formatMedium, monthGrid, parseYmd, relativeDay, startOfWeek, ymd } from "@/lib/dates";
import { statsRange, type Period } from "@/lib/stats";
import { DEFAULT_SORT, matchesQuery, sortTasks, type Sort } from "@/lib/tasks";
import type { AppUser, Task } from "@/lib/types";
import { AnalyticsView } from "./analytics/AnalyticsView";
import { DayView, type Focus } from "./DayView";
import { MonthView } from "./MonthView";
import { SettingsSheet } from "./SettingsSheet";
import { ShortcutsSheet } from "./ShortcutsSheet";
import { MiniMonth, MobileHeader, Sidebar, TabBar, type View } from "./Sidebar";
import type { Composer, Editing, Section, TableActions } from "./table/types";
import { useTasks } from "./useTasks";
import { WeekView } from "./WeekView";

const SAVE_DELAY = 600; // ms of typing inactivity before a PATCH
type Toast = { id: number; message: string; action?: { label: string; run: () => void } };

/** Today's local date key; refreshes periodically and when the tab regains focus (e.g. after midnight). */
function useTodayKey() {
  const [key, setKey] = useState(() => ymd(new Date()));
  useEffect(() => {
    const refresh = () => setKey(ymd(new Date()));
    const id = setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return key;
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);

const monthOf = (key: string) => {
  const d = parseYmd(key);
  return { y: d.getFullYear(), m: d.getMonth() };
};

export function TaskApp({ user }: { user: AppUser }) {
  const todayKey = useTodayKey();
  const [view, setView] = useState<View>("day");
  const [selected, setSelected] = useState(todayKey);
  const [cal, setCal] = useState(() => monthOf(todayKey));
  const [mini, setMini] = useState(() => monthOf(todayKey));
  const [stats, setStats] = useState<{ period: Period; offset: number }>({ period: "week", offset: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [composer, setComposer] = useState<Composer | null>(null);
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  // Just-completed tasks stay where they are for a moment (the tick plays) before moving to Completed.
  const [settling, setSettling] = useState<string[]>([]);
  const [completedOpen, setCompletedOpen] = useState(() => {
    try {
      return localStorage.getItem("hyperanchor:completed") !== "hidden";
    } catch {
      return true;
    }
  });
  const [help, setHelp] = useState(false);
  const [settings, setSettings] = useState(false);
  // Focus mode (Day view): one task at a time. "Not now" sends a task to the back of the queue for this session.
  const [focusOn, setFocusOn] = useState(false);
  const [later, setLater] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const scroller = useRef<HTMLElement>(null);

  const notify = useCallback((message: string, action?: Toast["action"]) => {
    setToast({ id: Date.now(), message, action });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), action ? 6000 : 4000);
  }, []);

  const { tasks, load, create, edit, remove, restore } = useTasks(notify);

  // ── Data ────────────────────────────────────────────────────────────────────
  const mainRange = useMemo((): [string, string] => {
    if (view === "analytics") return statsRange(stats.period, stats.offset, todayKey);
    if (view === "month") {
      const g = monthGrid(cal.y, cal.m);
      return [ymd(g.start), ymd(g.end)];
    }
    const ws = startOfWeek(parseYmd(selected));
    return [ymd(ws), ymd(addDays(ws, 6))];
  }, [view, stats, cal, selected, todayKey]);
  const miniRange = useMemo((): [string, string] => {
    const g = monthGrid(mini.y, mini.m);
    return [ymd(g.start), ymd(g.end)];
  }, [mini]);
  useEffect(() => {
    load(...mainRange);
  }, [load, mainRange]);
  useEffect(() => {
    load(...miniRange);
  }, [load, miniRange]);
  // Today gathers tasks left open during the past week, so nothing quietly slips away.
  const lookback = useMemo((): [string, string] => [ymd(addDays(parseYmd(todayKey), -7)), ymd(addDays(parseYmd(todayKey), -1))], [todayKey]);
  useEffect(() => {
    if (view === "day") load(...lookback);
  }, [load, view, lookback]);
  // Analytics shows the current streak, which can reach further back than the period on screen.
  useEffect(() => {
    if (view === "analytics") load(ymd(addDays(parseYmd(todayKey), -365)), todayKey);
  }, [load, view, todayKey]);

  const byDateMap = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of sortTasks(Object.values(tasks), DEFAULT_SORT)) {
      const list = map.get(t.date);
      if (list) list.push(t);
      else map.set(t.date, [t]);
    }
    return map;
  }, [tasks]);
  const byDate = useCallback((key: string) => byDateMap.get(key) ?? [], [byDateMap]);

  const sections = useMemo((): Section[] => {
    const make = (date: string) => ({ date, tasks: sortTasks(byDate(date).filter((t) => matchesQuery(t, query)), sort) });
    if (view === "day") {
      // What's left first; finished tasks gather in a Completed group below.
      const { date, tasks } = make(selected);
      const completed = tasks.filter((t) => t.done && !settling.includes(t.id));
      return [{ date, tasks: tasks.filter((t) => !completed.includes(t)), completed }];
    }
    if (view !== "week") return [];
    // Each day lists what's left first; finished tasks sink below it (after the tick plays).
    const ws = startOfWeek(parseYmd(selected));
    const all = Array.from({ length: 7 }, (_, i) => {
      const { date, tasks } = make(ymd(addDays(ws, i)));
      const completed = tasks.filter((t) => t.done && !settling.includes(t.id));
      return { date, tasks: tasks.filter((t) => !completed.includes(t)), completed };
    });
    return query ? all.filter((s) => s.tasks.length || s.completed.length) : all;
  }, [view, selected, byDate, query, sort, settling]);
  // In screen order. Week view always shows finished tasks; Day view folds them into a collapsible group.
  const visibleIds = useMemo(
    () => sections.flatMap((s) => [...s.tasks, ...(view === "week" || completedOpen ? (s.completed ?? []) : [])].map((t) => t.id)),
    [sections, completedOpen, view],
  );

  // A selection that scrolled out of the list (filtered, collapsed into Completed, …) is dropped, so keys never act unseen.
  useEffect(() => {
    if (selectedId && !visibleIds.includes(selectedId)) setSelectedId(null);
  }, [selectedId, visibleIds]);

  const carried = useMemo(
    () =>
      Object.values(tasks)
        .filter((t) => !t.done && t.date >= lookback[0] && t.date <= lookback[1])
        .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)),
    [tasks, lookback],
  );

  // What focus mode works through: open tasks in list order, "Not now" ones last. A task just ticked off
  // stays first while its check plays.
  const focusQueue = useMemo(() => {
    if (!focusOn || view !== "day") return [];
    const list = sortTasks(byDate(selected).filter((t) => !t.done || settling.includes(t.id)), sort);
    const deferred = later.map((id) => list.find((t) => t.id === id)).filter((t): t is Task => !!t);
    return [...list.filter((t) => !later.includes(t.id)), ...deferred];
  }, [focusOn, view, byDate, selected, settling, sort, later]);
  const hasOpen = byDate(selected).some((t) => !t.done);

  // Latest state for stable callbacks and global listeners.
  const focusTask = focusQueue[0];
  const focusNext = focusQueue[1];
  const latest = useRef({ tasks, editing, composer, selectedId, visibleIds, view, selected, todayKey, focusOn, focusTask, focusNext, hasOpen });
  latest.current = { tasks, editing, composer, selectedId, visibleIds, view, selected, todayKey, focusOn, focusTask, focusNext, hasOpen };

  // ── Navigation ──────────────────────────────────────────────────────────────
  const selectDate = useCallback((key: string) => {
    setSelected(key);
    setMini(monthOf(key));
    setSelectedId(null);
    setLater([]);
  }, []);

  const showView = useCallback((v: View) => {
    if (v === "month") setCal(monthOf(latest.current.selected));
    if (v !== "day") setFocusOn(false);
    setSelectedId(null);
    setView(v);
  }, []);

  const setFocus = useCallback((on: boolean) => {
    setFocusOn(on);
    setLater([]);
    setSelectedId(null);
    setComposer(null);
    latest.current.composer = null;
  }, []);

  const openDay = useCallback(
    (key: string) => {
      selectDate(key);
      setView("day");
    },
    [selectDate],
  );

  // ── Table actions ───────────────────────────────────────────────────────────
  const actions = useMemo((): TableActions => {
    const finishEdit = () => {
      const { editing, tasks } = latest.current;
      if (!editing) return;
      const t = tasks[editing.id];
      if (t) {
        const title = t.title.trim() || editing.snapshot.title || "Untitled";
        const description = t.description.trim();
        const patch: Partial<Task> = {};
        if (title !== t.title) patch.title = title;
        if (description !== t.description) patch.description = description;
        edit(t.id, patch); // also flushes any pending debounced save
      }
      latest.current.editing = null;
      setEditing(null);
    };
    const composerSubmit = (keepOpen: boolean) => {
      const c = latest.current.composer;
      if (!c) return;
      const title = c.title.trim();
      if (title) create({ title, description: c.description.trim(), date: c.date, done: false });
      const next = title && keepOpen ? { date: c.date, title: "", description: "", nonce: Date.now() } : null;
      latest.current.composer = next;
      setComposer(next);
    };
    return {
      select: (id) => setSelectedId(id),
      startEdit: (id, field) => {
        const { editing, tasks } = latest.current;
        if (editing && editing.id !== id) finishEdit();
        const t = tasks[id];
        if (!t) return;
        const snapshot = editing?.id === id ? editing.snapshot : { title: t.title, description: t.description };
        const next = { id, field, snapshot };
        latest.current.editing = next;
        setEditing(next);
        setSelectedId(id);
      },
      finishEdit,
      cancelEdit: () => {
        const { editing, tasks } = latest.current;
        if (!editing) return;
        const t = tasks[editing.id];
        if (t && (t.title !== editing.snapshot.title || t.description !== editing.snapshot.description)) edit(t.id, editing.snapshot);
        latest.current.editing = null;
        setEditing(null);
      },
      change: (id, patch) => edit(id, patch, SAVE_DELAY),
      toggle: (task) => {
        edit(task.id, { done: !task.done });
        if (task.done) return;
        setSettling((s) => [...s, task.id]);
        setTimeout(() => setSettling((s) => s.filter((id) => id !== task.id)), 900);
      },
      move: (task, date) => {
        const from = task.date;
        edit(task.id, { date });
        const name = relativeDay(date, latest.current.todayKey) ?? formatMedium(parseYmd(date));
        notify(`Moved to ${name}`, { label: "Undo", run: () => edit(task.id, { date: from }) });
      },
      remove: (task) => {
        const { visibleIds, editing } = latest.current;
        const i = visibleIds.indexOf(task.id);
        setSelectedId(i >= 0 ? (visibleIds[i + 1] ?? visibleIds[i - 1] ?? null) : null);
        if (editing?.id === task.id) setEditing(null);
        remove(task.id);
        notify(`Deleted “${task.title}”`, { label: "Undo", run: () => restore(task) });
      },
      openComposer: (date) => {
        finishEdit();
        const next = { date, title: "", description: "", nonce: Date.now() };
        latest.current.composer = next;
        setComposer(next);
      },
      composerChange: (patch) => setComposer((c) => (c ? { ...c, ...patch } : c)),
      composerSubmit,
      composerCancel: () => {
        latest.current.composer = null;
        setComposer(null);
      },
      sort: setSort,
    };
  }, [create, edit, remove, restore, notify]);

  const focus: Focus =
    focusOn && view === "day"
      ? {
          task: focusQueue[0],
          next: focusQueue[1],
          after: Math.max(0, focusQueue.length - 2),
          onDone: (t) => !t.done && actions.toggle(t),
          onLater: (t) => setLater((l) => [...l.filter((id) => id !== t.id), t.id]),
          onExit: () => setFocus(false),
          onCapture: (title) => {
            const id = create({ title, description: "", date: selected, done: false });
            setLater((l) => [...l, id]); // a jotted-down thought waits until the end
            notify("Added for later");
          },
        }
      : null;

  // The tab shows what's left today — a gentle cue when the window is in the background.
  const leftToday = byDate(todayKey).filter((t) => !t.done).length;
  useEffect(() => {
    document.title = leftToday ? `${leftToday} left today · Hyperanchor` : "Hyperanchor";
  }, [leftToday]);

  const moveAllToToday = (list: Task[]) => {
    for (const t of list) edit(t.id, { date: todayKey });
    notify(list.length === 1 ? "Moved 1 task to Today" : `Moved ${list.length} tasks to Today`, {
      label: "Undo",
      run: () => list.forEach((t) => edit(t.id, { date: t.date })),
    });
  };

  // ── Global pointer + keyboard handling ─────────────────────────────────────
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = e.target as Element;
      const l = latest.current;
      if (el.closest?.('[data-editing="true"]')) return;
      if (l.editing) actions.finishEdit();
      if (l.composer) actions.composerSubmit(false);
      if (!el.closest?.("[data-task-row], [data-floating]")) setSelectedId(null);
    };
    const step = (dir: number) => {
      const l = latest.current;
      if (l.view === "day" || l.view === "week") selectDate(ymd(addDays(parseYmd(l.selected), dir * (l.view === "day" ? 1 : 7))));
      else if (l.view === "month") setCal(({ y, m }) => monthOf(ymd(new Date(y, m + dir, 1))));
      else setStats((s) => ({ ...s, offset: Math.min(0, s.offset + dir) }));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector("[data-floating]")) return; // a menu or popover handles its own keys
      const l = latest.current;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const views: Record<string, View> = { d: "day", w: "week", m: "month", a: "analytics" };
      const table = l.view === "day" || l.view === "week";
      const i = l.selectedId ? l.visibleIds.indexOf(l.selectedId) : -1;
      const sel = l.selectedId ? l.tasks[l.selectedId] : undefined;

      if (l.focusOn && l.view === "day") {
        // Focus mode has no list to move through: Space finishes the task, → puts it off, N jots a thought down,
        // Esc or F leaves. The day stays put while focusing.
        if (k === " ") {
          if (l.focusTask && !l.focusTask.done) actions.toggle(l.focusTask);
        } else if (k === "ArrowRight") {
          const t = l.focusTask;
          if (t && !t.done && l.focusNext) setLater((ids) => [...ids.filter((id) => id !== t.id), t.id]);
        } else if (k === "n") document.getElementById("focus-capture")?.focus();
        else if (k === "Escape" || k === "f") setFocus(false);
        else if (k === "ArrowLeft" || k === "ArrowUp" || k === "ArrowDown" || k === "Enter" || k === "Backspace" || k === "Delete") return;
        if (k === " " || k === "ArrowRight" || k === "n" || k === "Escape" || k === "f") return e.preventDefault();
      }
      if (views[k]) showView(views[k]);
      else if (k === "f") {
        if (l.view !== "day") showView("day");
        if (l.hasOpen) setFocus(true);
      } else if (k === "t") {
        selectDate(l.todayKey);
        setCal(monthOf(l.todayKey));
        setStats((s) => ({ ...s, offset: 0 }));
      } else if (k === "n") {
        if (!table) setView("day");
        actions.openComposer(l.selected);
      } else if (k === "ArrowLeft" || k === "ArrowRight") step(k === "ArrowLeft" ? -1 : 1);
      else if (table && (k === "ArrowDown" || k === "ArrowUp") && l.visibleIds.length) {
        const n = l.visibleIds.length;
        const next = i < 0 ? (k === "ArrowDown" ? 0 : n - 1) : Math.min(n - 1, Math.max(0, i + (k === "ArrowDown" ? 1 : -1)));
        setSelectedId(l.visibleIds[next]);
      } else if (table && sel && k === "Enter") actions.startEdit(sel.id, "title");
      else if (table && sel && k === " ") actions.toggle(sel);
      else if (table && sel && (k === "Backspace" || k === "Delete")) actions.remove(sel);
      else if (k === "?") setHelp(true);
      else if (k === ",") setSettings(true);
      else if (k === "Escape") setSelectedId(null);
      else return;
      e.preventDefault();
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [actions, selectDate, showView, setFocus]);

  // A new view starts at the top (the sheet scrolls on desktop, the page on phones).
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [view]);

  // The sticky toolbar shows its blurred edge only while content is scrolled beneath it.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => (el.dataset.scrolled = String(el.scrollTop > 2));
    update();
    el.addEventListener("scroll", update, { passive: true });
    return () => el.removeEventListener("scroll", update);
  }, []);

  // ── Layout ──────────────────────────────────────────────────────────────────
  const tableState = { todayKey, selectedId, editing, composer, sort };
  const weekStart = startOfWeek(parseYmd(selected));
  const weekOpen = Array.from({ length: 7 }, (_, i) => byDate(ymd(addDays(weekStart, i)))).flat().filter((t) => !t.done).length;

  return (
    <div className="min-h-dvh md:flex md:h-dvh md:min-h-0 md:bg-canvas">
      <Sidebar
        user={user}
        view={view}
        onView={showView}
        onShortcuts={() => setHelp(true)}
        onSettings={() => setSettings(true)}
        badges={{ day: byDate(selected).filter((t) => !t.done).length, week: weekOpen }}
        mini={
          <MiniMonth
            year={mini.y}
            month={mini.m}
            selected={selected}
            todayKey={todayKey}
            byDate={byDate}
            onShift={(n) => setMini(({ y, m }) => monthOf(ymd(new Date(y, m + n, 1))))}
            onSelect={(key) => {
              selectDate(key);
              if (view === "month") setCal(monthOf(key));
              if (view === "analytics") setView("day");
            }}
          />
        }
      />
      <div className="flex min-w-0 flex-1 flex-col md:py-2 md:pr-2">
        <MobileHeader user={user} onShortcuts={() => setHelp(true)} onSettings={() => setSettings(true)} />
        {/* The content sheet. Desktop: an inset white sheet that scrolls inside (the toolbar sticks). Phone: the page scrolls. */}
        <div className="min-h-0 flex-1 pb-[calc(env(safe-area-inset-bottom)+92px)] md:pb-0">
          <main ref={scroller} className="group/sheet md:h-full md:scroll-pt-32 md:overflow-y-auto md:rounded-[14px] md:bg-surface md:shadow-sheet">
            {view === "day" && (
              <DayView
                selected={selected}
                section={sections[0] ?? { date: selected, tasks: [] }}
                state={tableState}
                actions={actions}
                completedOpen={completedOpen}
                onCompletedOpen={(open) => {
                  setCompletedOpen(open);
                  try {
                    localStorage.setItem("hyperanchor:completed", open ? "shown" : "hidden");
                  } catch {}
                }}
                byDate={byDate}
                query={query}
                onQuery={setQuery}
                onSelectDate={selectDate}
                onMoveToToday={moveAllToToday}
                carried={carried}
                focus={focus}
                onFocus={() => setFocus(!focusOn)}
              />
            )}
            {view === "week" && (
              <WeekView selected={selected} sections={sections} state={tableState} actions={actions} query={query} onQuery={setQuery} onSelectDate={selectDate} />
            )}
            {view === "month" && (
              <MonthView
                year={cal.y}
                month={cal.m}
                selected={selected}
                todayKey={todayKey}
                byDate={byDate}
                onShift={(n) => setCal(({ y, m }) => monthOf(ymd(new Date(y, m + n, 1))))}
                onThisMonth={() => setCal(monthOf(todayKey))}
                onSelectDate={selectDate}
                onOpenDay={openDay}
                onToggle={actions.toggle}
                onCreate={(date, title) => create({ title, description: "", date, done: false })}
              />
            )}
            {view === "analytics" && (
              <AnalyticsView
                period={stats.period}
                offset={stats.offset}
                todayKey={todayKey}
                byDate={byDate}
                onPeriod={(period) => setStats({ period, offset: 0 })}
                onOffset={(offset) => setStats((s) => ({ ...s, offset: Math.min(0, offset) }))}
                onDrill={(period, offset) => setStats({ period, offset })}
                onOpenDay={openDay}
                onToggle={actions.toggle}
                onMove={actions.move}
              />
            )}
          </main>
        </div>
      </div>
      <TabBar view={view} onView={showView} />
      {help && <ShortcutsSheet onClose={() => setHelp(false)} />}
      {settings && <SettingsSheet user={user} onClose={() => setSettings(false)} />}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+90px)] z-[120] flex justify-center px-4 md:bottom-6">
          <div
            role="status"
            key={toast.id}
            className="pointer-events-auto flex animate-rise items-center gap-3 rounded-[12px] bg-ink py-1.5 pr-1.5 pl-4 text-[13px] text-surface shadow-float"
          >
            <span className="max-w-[60vw] truncate">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.run();
                  setToast(null);
                }}
                className="rounded-[8px] bg-surface/12 px-2.5 py-1 font-semibold transition-colors hover:bg-surface/20"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
