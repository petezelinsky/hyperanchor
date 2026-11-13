"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { addDays, dayDiff, dayName, formatLong, formatMedium, formatShort, monthGrid, MONTHS, parseYmd, relativeDay, setWeekStart, startOfWeek, ymd, type WeekStart } from "@/lib/dates";
import { periodBounds, statsRange, type Period } from "@/lib/stats";
import { DEFAULT_SORT, placeBetween, placeOf, sortTasks, type Sort } from "@/lib/tasks";
import type { AppUser, Task, TaskDraft, Usage } from "@/lib/types";
import { AnalyticsView } from "./analytics/AnalyticsView";
import { DayView, type Focus, type Welcome } from "./DayView";
import { DragProvider, type DropTarget } from "./drag";
import { FocusPanel } from "./FocusPanel";
import { FocusIcon } from "./icons";
import { MonthView } from "./MonthView";
import { appearOnRender, cancelLeaving, exitCopy, foldAway, motion, playFlip, prepareFlip, pulseDayOnRender, reducedMotion, slideAway, unfoldOnRender } from "./motion";
import { readSort, readWeekStart, saveSort, saveWeekStart } from "./prefs";
import { SearchPalette } from "./SearchPalette";
import { SettingsSheet, type SettingsTab } from "./SettingsSheet";
import { AccountPanel, AppBar, DayCount, isPlanner, MiniMonth, Sidebar, type Head, type Nav, type Page, type View } from "./Sidebar";
import { ComingSoon } from "./ComingSoon";
import type { Composer, Editing, Section, TableActions } from "./table/types";
import { Button, Modal, Popover, SegmentedControl } from "./ui";
import { useTasks } from "./useTasks";
import { primeAudio } from "./voice/meter";
import { VoiceScreen } from "./voice/VoiceScreen";
import { shortRange, WeekView } from "./WeekView";

const SAVE_DELAY = 600; // ms of typing inactivity before a PATCH
/** Each composer gets its own number: a new one starts afresh (a counter, so two in the same millisecond still differ). */
let composerNonce = 0;
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

const VIEW_NAMES: View[] = ["day", "week", "month", "analytics", "timeline", "goals", "agent"];

/** The view and the date in the address (?view=week&date=2026-11-12). A plain address is Day, today. */
function fromAddress(): { view: View; date: string | null } {
  const q = new URLSearchParams(window.location.search);
  const view = q.get("view") as View | null;
  const date = q.get("date");
  return {
    view: view && VIEW_NAMES.includes(view) ? view : "day",
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) && ymd(parseYmd(date)) === date ? date : null,
  };
}

/** One step that can be taken back: `run` says whether there was still something to take back. */
type Undo = { run: () => boolean; done: string };

export function TaskApp({ user, account, voice, transcribe }: { user: AppUser; account: string; voice: boolean; transcribe: boolean }) {
  const todayKey = useTodayKey();
  const [address] = useState(fromAddress);
  const [view, setView] = useState<View>(address.view);
  const [selected, setSelected] = useState(address.date ?? todayKey);
  const [cal, setCal] = useState(() => monthOf(address.date ?? todayKey));
  const [mini, setMini] = useState(() => monthOf(address.date ?? todayKey));
  const [stats, setStats] = useState<{ period: Period; offset: number }>({ period: "week", offset: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [composer, setComposer] = useState<Composer | null>(null);
  // The order of tasks is a setting, remembered on this device.
  const [sort, setSortState] = useState<Sort>(readSort);
  const setSort = useCallback((s: Sort) => {
    setSortState(s);
    saveSort(s);
  }, []);
  // Just-completed tasks stay where they are for a moment (the tick plays) before moving to Completed.
  const [settling, setSettling] = useState<string[]>([]);
  const [completedOpen, setCompletedOpen] = useState(() => {
    try {
      return localStorage.getItem("hyperanchor:completed") !== "hidden";
    } catch {
      return true;
    }
  });
  const [sheet, setSheet] = useState<SettingsTab | null>(null);
  // The first day of the week lives in lib/dates (every date helper reads it); this state re-renders on a change.
  const [weekStart, setWeekStartState] = useState<WeekStart>(() => {
    const w = readWeekStart();
    setWeekStart(w);
    return w;
  });
  const changeWeekStart = useCallback((w: WeekStart) => {
    setWeekStart(w);
    saveWeekStart(w);
    setWeekStartState(w);
  }, []);
  // Focus mode (Day view): one task at a time. "Not now" sends a task to the back of the queue for this session.
  const [focusOn, setFocusOn] = useState(false);
  const [later, setLater] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  // Computers: the sidebar can be hidden ([), and stays as it was left.
  const [sidebar, setSidebar] = useState(() => {
    try {
      return localStorage.getItem("hyperanchor:sidebar") !== "hidden";
    } catch {
      return true;
    }
  });
  const toggleSidebar = useCallback(() => {
    setSidebar((shown) => {
      try {
        localStorage.setItem("hyperanchor:sidebar", shown ? "hidden" : "shown");
      } catch {}
      return !shown;
    });
  }, []);
  // The account panel, opened from the sidebar's foot (computers) or the avatar in the bar (phones).
  const [accountMenu, setAccountMenu] = useState<HTMLElement | null>(null);
  // What speaking tasks has cost, asked for each time the panel opens (the last answer stays while the next one loads).
  const [usage, setUsage] = useState<Usage | null>(null);
  useEffect(() => {
    if (!accountMenu || !voice) return;
    let alive = true;
    fetch("/api/usage")
      .then((r) => (r.ok ? (r.json() as Promise<Usage>) : null))
      .then((u) => alive && u && setUsage(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [accountMenu, voice]);
  // The month to pick a day from, opened from the title in the bar.
  const [picking, setPicking] = useState<HTMLElement | null>(null);
  // The voice screen: say (or type) everything at once, and it comes back as tasks on their days.
  const [speaking, setSpeaking] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const scroller = useRef<HTMLElement>(null);

  // Set when a toast takes another's place, so the old one doesn't linger behind it.
  const toastReplaced = useRef(false);
  const notify = useCallback((message: string, action?: Toast["action"]) => {
    setToast((t) => {
      toastReplaced.current = !!t;
      return { id: Date.now(), message, action };
    });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), action ? 6000 : 4000);
  }, []);

  const { tasks, load, loadOpen, create, edit, remove, restore, merge, saving, waiting, trouble, loads } = useTasks(account, notify);

  // ── Undo ────────────────────────────────────────────────────────────────────
  // The last 20 actions can be taken back: ⌘Z / Ctrl Z takes back the latest, a toast's Undo its own.
  const undos = useRef<Undo[]>([]);
  const remember = useCallback((run: () => boolean, done: string) => {
    const u = { run, done };
    undos.current = [...undos.current.slice(-19), u];
    return u;
  }, []);
  const undoThis = useCallback((u: Undo) => {
    undos.current = undos.current.filter((x) => x !== u);
    u.run();
  }, []);
  const undoLast = useCallback(() => {
    // Skips steps that no longer apply (their task was deleted since, say).
    for (let u = undos.current.pop(); u; u = undos.current.pop()) if (u.run()) return notify(u.done);
  }, [notify]);

  // ── Data ────────────────────────────────────────────────────────────────────
  const mainRange = useMemo((): [string, string] => {
    if (view === "analytics") return statsRange(stats.period, stats.offset, todayKey);
    if (view === "month") {
      const g = monthGrid(cal.y, cal.m);
      return [ymd(g.start), ymd(g.end)];
    }
    const ws = startOfWeek(parseYmd(selected));
    return [ymd(ws), ymd(addDays(ws, 6))];
  }, [view, stats, cal, selected, todayKey, weekStart]); // weekStart: the date helpers read it
  const miniRange = useMemo((): [string, string] => {
    const g = monthGrid(mini.y, mini.m);
    return [ymd(g.start), ymd(g.end)];
  }, [mini, weekStart]);
  useEffect(() => {
    load(...mainRange);
  }, [load, mainRange]);
  useEffect(() => {
    load(...miniRange);
  }, [load, miniRange]);
  // Today gathers every task left open on an earlier day, however long ago, so nothing quietly slips away.
  useEffect(() => {
    if (view === "day") loadOpen(todayKey);
  }, [loadOpen, view, todayKey]);
  // Analytics counts the days with something done this year, which reaches further back than the period on screen.
  useEffect(() => {
    if (view === "analytics") load(ymd(addDays(parseYmd(todayKey), -365)), todayKey);
  }, [load, view, todayKey]);

  // Grouped by day first, then each day sorted: far less work than sorting everything, with hundreds of old tasks loaded.
  const byDateMap = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of Object.values(tasks)) {
      const list = map.get(t.date);
      if (list) list.push(t);
      else map.set(t.date, [t]);
    }
    for (const [key, list] of map) if (list.length > 1) map.set(key, sortTasks(list, DEFAULT_SORT));
    return map;
  }, [tasks]);
  const byDate = useCallback((key: string) => byDateMap.get(key) ?? [], [byDateMap]);
  // The earliest day with a task (of everything loaded, which reaches a year back): analytics starts counting there.
  const firstDay = useMemo(() => {
    let first: string | null = null;
    for (const key of byDateMap.keys()) if (!first || key < first) first = key;
    return first;
  }, [byDateMap]);

  const sections = useMemo((): Section[] => {
    const make = (date: string) => ({ date, tasks: sortTasks(byDate(date), sort) });
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
    return all;
  }, [view, selected, byDate, sort, settling, weekStart]);
  // In screen order. Week view always shows finished tasks; Day view folds them into a collapsible group.
  const visibleIds = useMemo(
    () => sections.flatMap((s) => [...s.tasks, ...(view === "week" || completedOpen ? (s.completed ?? []) : [])].map((t) => t.id)),
    [sections, completedOpen, view],
  );

  // A selection that scrolled out of the list (filtered, collapsed into Completed, …) is dropped, so keys never act unseen.
  useEffect(() => {
    if (selectedId && !visibleIds.includes(selectedId)) setSelectedId(null);
  }, [selectedId, visibleIds]);

  // Most recent first: yesterday's leftovers lead, the long-forgotten follow.
  const carried = useMemo(
    () =>
      Object.values(tasks)
        .filter((t) => !t.done && t.date < todayKey)
        .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0)),
    [tasks, todayKey],
  );

  // What focus mode works through: open tasks in list order, "Not now" ones last. A task ticked off leaves at once (its
  // card turns to dust while the next one rises).
  const focusQueue = useMemo(() => {
    if (!focusOn || view !== "day") return [];
    const list = sortTasks(byDate(selected).filter((t) => !t.done), sort);
    const deferred = later.map((id) => list.find((t) => t.id === id)).filter((t): t is Task => !!t);
    return [...list.filter((t) => !later.includes(t.id)), ...deferred];
  }, [focusOn, view, byDate, selected, sort, later]);
  const hasOpen = byDate(selected).some((t) => !t.done);

  // Latest state for stable callbacks and global listeners.
  const focusTask = focusQueue[0];
  const focusNext = focusQueue[1];
  const latest = useRef({ tasks, editing, composer, selectedId, visibleIds, view, selected, todayKey, focusOn, focusTask, focusNext, hasOpen, sort });
  latest.current = { tasks, editing, composer, selectedId, visibleIds, view, selected, todayKey, focusOn, focusTask, focusNext, hasOpen, sort };

  // A change that waits for its row to finish leaving (folding away, sliding off): Undo in the meantime calls it off.
  const leaving = useRef(new Map<string, () => void>());
  const leave = useCallback((id: string, animate: (done: () => void) => void, commit: () => void) => {
    const run = () => {
      if (leaving.current.get(id) !== run) return;
      leaving.current.delete(id);
      commit();
    };
    leaving.current.set(id, run);
    animate(run);
  }, []);
  const callOff = useCallback((id: string) => {
    if (!leaving.current.delete(id)) return false;
    cancelLeaving(id);
    return true;
  }, []);
  /** Whether a list for `date` is on screen (then a task moving there travels to its place). */
  const dayShown = (date: string) => !!document.querySelector(`[data-drop-list][data-drop-date="${date}"], [role="grid"] > [data-drop-date="${date}"]`);

  /** "today", "tomorrow", or "Wed, Nov 18": a day as a message names it mid-sentence. */
  const dayLabel = useCallback((key: string) => relativeDay(key, latest.current.todayKey)?.toLowerCase() ?? formatMedium(parseYmd(key)), []);
  // A new task's text while it's typed (the composer shows it; the app reads it on Enter).
  const draft = useRef({ title: "", description: "" });

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
  // Home is the planner (Day, Week, Month). From another page it returns to the one last on screen; from within, to today.
  const lastPlanner = useRef<View>(isPlanner(address.view) ? address.view : "day");
  useEffect(() => {
    if (isPlanner(view)) lastPlanner.current = view;
  }, [view]);

  // Leaving focus says how it went.
  const focusDone = useRef(0);
  const setFocus = useCallback(
    (on: boolean) => {
      const n = focusDone.current;
      if (!on && latest.current.focusOn && n > 0) notify(`${n} done in focus.`);
      focusDone.current = 0;
      setFocusOn(on);
      setLater([]);
      setSelectedId(null);
      setComposer(null);
      latest.current.composer = null;
    },
    [notify],
  );

  // A tab left open overnight moves on to the new day if it was showing "today".
  const lastToday = useRef(todayKey);
  useEffect(() => {
    const was = lastToday.current;
    lastToday.current = todayKey;
    if (was === todayKey || latest.current.selected !== was) return;
    selectDate(todayKey);
    setCal((c) => (c.y === monthOf(was).y && c.m === monthOf(was).m ? monthOf(todayKey) : c));
  }, [todayKey, selectDate]);

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
        const { snapshot } = editing;
        if (title !== snapshot.title || description !== snapshot.description)
          remember(() => !!latest.current.tasks[t.id] && (edit(t.id, snapshot), true), "Edit undone");
      }
      latest.current.editing = null;
      setEditing(null);
    };
    const composerSubmit = (keepOpen: boolean) => {
      const c = latest.current.composer;
      if (!c) return;
      const title = draft.current.title.trim();
      let id: string | undefined;
      if (title) {
        // At the top of the day's open tasks (where it was written), after any added just before it.
        const open = sortTasks(
          Object.values(latest.current.tasks).filter((t) => t.date === c.date && !t.done),
          DEFAULT_SORT,
        );
        const prev = c.after ? open.find((t) => t.id === c.after) : undefined;
        const position = placeBetween(prev, prev ? open[open.indexOf(prev) + 1] : open[0]);
        id = create({ title, description: draft.current.description.trim(), date: c.date, done: false, position });
      }
      draft.current = { title: "", description: "" };
      const next = title && keepOpen ? { date: c.date, nonce: ++composerNonce, after: id } : null;
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
        // Reopened: it travels back up to what's left at once.
        if (task.done) prepareFlip(task.id);
        edit(task.id, { done: !task.done });
        remember(() => {
          const t = latest.current.tasks[task.id];
          if (!t || t.done === task.done) return false;
          prepareFlip(task.id);
          edit(task.id, { done: task.done });
          return true;
        }, `“${task.title}” is ${task.done ? "done" : "open"} again`);
        if (task.done) return;
        setSettling((s) => [...s, task.id]);
        // The tick plays, then the row travels down to Done (about 600 ms from the click in all). In focus the next card
        // takes a little longer to come; without motion the task moves on almost at once.
        setTimeout(
          () => {
            prepareFlip(task.id);
            setSettling((s) => s.filter((id) => id !== task.id));
          },
          reducedMotion() ? motion().reduced : latest.current.focusOn ? 520 : motion().base,
        );
      },
      move: (task, date) => {
        const from = task.date;
        // To a day on screen the row travels to its new place; to one off screen it slides toward it and the day's dot
        // in the calendar answers.
        const commit = () => {
          edit(task.id, { date });
          pulseDayOnRender(date);
        };
        if (dayShown(date)) {
          prepareFlip(task.id);
          commit();
        } else leave(task.id, (done) => slideAway(task.id, date > from, done), commit);
        const u = remember(() => {
          if (callOff(task.id)) return true;
          if (!latest.current.tasks[task.id]) return false;
          if (dayShown(from)) prepareFlip(task.id);
          else appearOnRender(task.id);
          edit(task.id, { date: from });
          return true;
        }, `Moved back to ${dayLabel(from)}`);
        notify(`Moved to ${dayLabel(date)}`, { label: "Undo", run: () => undoThis(u) });
      },
      remove: (task) => {
        const { visibleIds, editing } = latest.current;
        const i = visibleIds.indexOf(task.id);
        setSelectedId(i >= 0 ? (visibleIds[i + 1] ?? visibleIds[i - 1] ?? null) : null);
        if (editing?.id === task.id) setEditing(null);
        // The row folds away, then it's gone; Undo opens it up again in the same place.
        leave(task.id, (done) => foldAway(task.id, done), () => remove(task.id));
        const u = remember(() => {
          if (callOff(task.id)) return true;
          if (latest.current.tasks[task.id]) return false;
          unfoldOnRender(task.id);
          restore(task);
          return true;
        }, `Restored “${task.title}”`);
        notify(`Deleted “${task.title}”`, { label: "Undo", run: () => undoThis(u) });
      },
      openComposer: (date) => {
        finishEdit();
        draft.current = { title: "", description: "" };
        const next = { date, nonce: ++composerNonce };
        latest.current.composer = next;
        setComposer(next);
      },
      // What's typed into a new task stays with it: the rest of the app doesn't redraw on every key.
      composerChange: (patch) => void Object.assign(draft.current, patch),
      composerSubmit,
      composerCancel: () => {
        draft.current = { title: "", description: "" };
        latest.current.composer = null;
        setComposer(null);
      },
      sort: setSort,
    };
  }, [create, edit, remove, restore, notify, remember, undoThis, dayLabel, leave, callOff]);

  const focus: Focus =
    focusOn && view === "day"
      ? {
          queue: focusQueue,
          onDone: (t) => {
            if (t.done) return;
            focusDone.current += 1;
            actions.toggle(t);
          },
          onLater: (t) => setLater((l) => [...l.filter((id) => id !== t.id), t.id]),
          onExit: () => setFocus(false),
          onCapture: (title) => {
            const id = create({ title, description: "", date: selected, done: false });
            setLater((l) => [...l, id]); // a jotted-down thought waits until the end (the stage itself says it's kept)
          },
        }
      : null;

  // The tab shows what's left today — a gentle cue when the window is in the background.
  const leftToday = byDate(todayKey).filter((t) => !t.done).length;
  useEffect(() => {
    document.title = leftToday ? `${leftToday} left today · Hyperanchor` : "Hyperanchor";
  }, [leftToday]);

  const moveAllToToday = (list: Task[]) => {
    prepareFlip();
    for (const t of list) edit(t.id, { date: todayKey });
    const u = remember(() => {
      const back = list.filter((t) => latest.current.tasks[t.id]);
      prepareFlip();
      back.forEach((t) => edit(t.id, { date: t.date }));
      return back.length > 0;
    }, list.length === 1 ? "Moved back" : `Moved ${list.length} tasks back`);
    notify(list.length === 1 ? "Moved 1 task to today" : `Moved ${list.length} tasks to today`, { label: "Undo", run: () => undoThis(u) });
  };

  /** What the voice screen sorted becomes tasks, in the order it was said; one Undo takes all of them back. */
  const addDrafts = useCallback(
    (drafts: TaskDraft[]) => {
      const now = Date.now();
      const ids = drafts.map((d, i) => create({ ...d, done: false, position: now + i }));
      const n = ids.length;
      const days = new Set(drafts.map((d) => d.date));
      days.forEach(pulseDayOnRender);
      const u = remember(() => {
        const left = ids.filter((id) => latest.current.tasks[id]);
        left.forEach(remove);
        return left.length > 0;
      }, n === 1 ? "Task removed" : `${n} tasks removed`);
      // Where they went, when it's a single day: "Added 3 tasks for tomorrow".
      const where = days.size === 1 ? ` for ${dayLabel([...days][0])}` : "";
      notify(`Added ${n === 1 ? "1 task" : `${n} tasks`}${where}`, { label: "Undo", run: () => undoThis(u) });
    },
    [create, remove, remember, undoThis, notify, dayLabel],
  );
  const openVoice = useCallback(() => {
    // A task being written is kept (as a click elsewhere would keep it) before the screen takes over.
    if (latest.current.editing) actions.finishEdit();
    if (latest.current.composer) actions.composerSubmit(false);
    // Started during the click (or the key press): Safari lets the microphone's meter run only then.
    primeAudio();
    setSpeaking(true);
  }, [actions]);
  // Offered only where the server can do the sorting (it has an Anthropic key).
  const speak = voice ? openVoice : undefined;
  // What the spoken language is guessed from: the latest task titles (gathered only while someone needs them).
  const wantsSample = speaking || !!sheet;
  const sample = useMemo(
    () =>
      wantsSample
        ? Object.values(latest.current.tasks)
            .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
            .slice(0, 40)
            .map((t) => t.title)
        : [],
    [wantsSample],
  );

  // ── Order and drag and drop ─────────────────────────────────────────────────
  /** The open tasks of a day in list order, without `except`. */
  const openOf = useCallback((date: string, except?: string) => {
    const l = latest.current;
    return sortTasks(
      Object.values(l.tasks).filter((t) => t.date === date && !t.done && t.id !== except),
      l.sort,
    );
  }, []);

  /**
   * The position that puts a task at `index` of `list` (a day's open tasks without it). Splitting the same gap over and
   * over eventually leaves no number in between; then the day is renumbered, in its order, to make room again.
   */
  const positionAt = useCallback(
    (list: Task[], index: number) => {
      const before = list[index - 1];
      const after = list[index];
      const p = placeBetween(before, after);
      if (!before || !after || (p > placeOf(before) && p < placeOf(after))) return p;
      const base = placeOf(list[0]);
      list.forEach((t, i) => edit(t.id, { position: base + i * 1024 }));
      return base + (index - 0.5) * 1024;
    },
    [edit],
  );

  /**
   * The way back after a task changed place: to its old day, at its old place among that day's open tasks. (Its old
   * position number may mean something else by then: a day gets renumbered when its gaps run out.)
   */
  const placeBack = useCallback(
    (task: Task) => {
      const index = openOf(task.date).findIndex((t) => t.id === task.id);
      return () => {
        if (!latest.current.tasks[task.id]) return false;
        prepareFlip(task.id);
        const rest = openOf(task.date, task.id);
        edit(task.id, { date: task.date, position: index < 0 ? task.position : positionAt(rest, Math.min(index, rest.length)) });
        return true;
      };
    },
    [openOf, edit, positionAt],
  );

  /** ⌥↑ / ⌥↓: nudges the selected task up or down its day. */
  const nudge = useCallback(
    (task: Task, dir: -1 | 1) => {
      if (latest.current.sort.key !== "manual" || task.done) return;
      const list = openOf(task.date);
      const j = list.findIndex((t) => t.id === task.id) + dir;
      if (j < 0 || j >= list.length) return;
      const rest = list.filter((t) => t.id !== task.id);
      const back = placeBack(task);
      prepareFlip(task.id);
      edit(task.id, { position: positionAt(rest, j) });
      remember(back, "Order restored");
    },
    [openOf, edit, positionAt, remember, placeBack],
  );

  /** A dropped task takes the place it was dropped in — another day, or another spot on its own day. */
  const dropTask = useCallback(
    (dragged: Task, target: DropTarget) => {
      const task = latest.current.tasks[dragged.id] ?? dragged;
      const list = openOf(target.date, task.id);
      const position =
        target.index != null ? positionAt(list, target.index) : target.date !== task.date ? placeBetween(list.at(-1), undefined) : task.position;
      if (target.date === task.date && position === task.position) return;
      const back = placeBack(task);
      prepareFlip(task.id);
      edit(task.id, { date: target.date, position });
      setSelectedId(task.id);
      if (target.date === task.date) return void remember(back, "Order restored");
      const u = remember(back, `Moved back to ${dayLabel(task.date)}`);
      notify(`Moved to ${dayLabel(target.date)}`, { label: "Undo", run: () => undoThis(u) });
    },
    [openOf, edit, notify, positionAt, remember, undoThis, dayLabel, placeBack],
  );

  // ── First visit ─────────────────────────────────────────────────────────────
  const [welcomed, setWelcomed] = useState(() => {
    try {
      return localStorage.getItem("hyperanchor:welcomed") === "yes";
    } catch {
      return true;
    }
  });
  const markWelcomed = useCallback(() => {
    setWelcomed(true);
    try {
      localStorage.setItem("hyperanchor:welcomed", "yes");
    } catch {}
  }, []);
  const hasAny = Object.keys(tasks).length > 0;
  useEffect(() => {
    if (hasAny && !welcomed) markWelcomed();
  }, [hasAny, welcomed, markWelcomed]);
  const addExamples = useCallback(() => {
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const date = latest.current.todayKey;
    const examples = touch
      ? [
          "Tick this off: tap the box, or swipe right",
          "Swipe me left to move me to tomorrow",
          "Tap the focus button to do one thing at a time",
        ]
      : ["Tick this off: click the box, or select it and press Space", "Drag me onto another day in Week", "Press F to focus on one task at a time"];
    const now = Date.now();
    examples.forEach((title, i) => create({ title, description: "", date, done: false, position: now + i }));
    markWelcomed();
  }, [create, markWelcomed]);
  const welcome: Welcome =
    loads >= 2 && !welcomed && !hasAny ? { name: user.name.split(" ")[0] || "there", onExamples: addExamples, onDismiss: markWelcomed } : null;

  /** Opens a search result: its day, with the task selected. */
  const openFound = useCallback(
    (task: Task) => {
      merge([task]);
      if (latest.current.focusOn) setFocus(false);
      openDay(task.date);
      setSelectedId(task.id);
    },
    [merge, openDay, setFocus],
  );

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
      // ⌘K / Ctrl K searches from anywhere, even mid-typing.
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!document.querySelector("[data-floating]")) setSearching(true);
        return;
      }
      // ⌘Z / Ctrl Z takes back the last action; text fields keep their own undo.
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "z") {
        if (isTyping(e.target) || document.querySelector("[data-floating]")) return;
        e.preventDefault();
        return undoLast();
      }
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || isTyping(e.target)) return;
      if (document.querySelector("[data-floating]")) return; // a menu or popover handles its own keys
      const l = latest.current;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const views: Record<string, View> = { d: "day", w: "week", m: "month", a: "analytics" };
      const table = l.view === "day" || l.view === "week";
      const i = l.selectedId ? l.visibleIds.indexOf(l.selectedId) : -1;
      const sel = l.selectedId ? l.tasks[l.selectedId] : undefined;
      if (e.altKey) {
        if (table && sel && (k === "ArrowUp" || k === "ArrowDown")) {
          e.preventDefault();
          nudge(sel, k === "ArrowUp" ? -1 : 1);
        }
        return;
      }

      if (l.focusOn && l.view === "day") {
        // Focus mode has no list to move through: Space finishes the task, → puts it off, N jots a thought down,
        // Esc or F leaves. The day stays put while focusing.
        if (k === " ") {
          if (l.focusTask && !l.focusTask.done) {
            focusDone.current += 1;
            actions.toggle(l.focusTask);
          }
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
      } else if (k === "v" && speak) speak();
      else if (k === "ArrowLeft" || k === "ArrowRight") step(k === "ArrowLeft" ? -1 : 1);
      else if (table && (k === "ArrowDown" || k === "ArrowUp") && l.visibleIds.length) {
        const n = l.visibleIds.length;
        const next = i < 0 ? (k === "ArrowDown" ? 0 : n - 1) : Math.min(n - 1, Math.max(0, i + (k === "ArrowDown" ? 1 : -1)));
        setSelectedId(l.visibleIds[next]);
      } else if (table && sel && k === "Enter") actions.startEdit(sel.id, "title");
      else if (table && sel && k === " ") actions.toggle(sel);
      else if (table && sel && (k === "Backspace" || k === "Delete")) actions.remove(sel);
      else if (k === "/") setSearching(true);
      else if (k === "[") toggleSidebar();
      else if (k === "?") setSheet("shortcuts");
      else if (k === ",") setSheet("general");
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
  }, [actions, selectDate, showView, setFocus, nudge, undoLast, speak, toggleSidebar]);

  // The address follows the view and the date. A new view is a step in history, so Back returns to the last one; a new
  // date only replaces the address. A reload or a bookmark comes back to the same place.
  useEffect(() => {
    const q = new URLSearchParams();
    if (view !== "day") q.set("view", view);
    const shownMonth = view === "month" && (cal.y !== monthOf(selected).y || cal.m !== monthOf(selected).m);
    const date = shownMonth ? ymd(new Date(cal.y, cal.m, 1)) : selected;
    if (isPlanner(view) && date !== todayKey) q.set("date", date);
    const search = q.toString() ? `?${q}` : "";
    if (search === window.location.search) return;
    if (fromAddress().view !== view) window.history.pushState(null, "", search || window.location.pathname);
    else window.history.replaceState(null, "", search || window.location.pathname);
  }, [view, selected, cal, todayKey]);
  useEffect(() => {
    const back = () => {
      const { view: v, date } = fromAddress();
      const key = date ?? latest.current.todayKey;
      if (v !== "day" && latest.current.focusOn) setFocus(false);
      setSelected(key);
      setMini(monthOf(key));
      setCal(monthOf(key));
      setSelectedId(null);
      setView(v);
    };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, [setFocus]);

  // A new view starts at the top (the sheet scrolls on desktop, the page on phones).
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [view]);

  // Rows that changed place move from where they were (motion.ts), before the browser paints the new layout.
  useLayoutEffect(() => {
    playFlip();
  });

  // ── Layout ──────────────────────────────────────────────────────────────────
  const sync = { saving, waiting, trouble };
  const tableState = { todayKey, selectedId, editing, composer, sort };
  const dayTasks = byDate(selected);
  const openAccount = (button: HTMLElement) => setAccountMenu((a) => (a ? null : button));
  const goToday = () => {
    selectDate(todayKey);
    setCal(monthOf(todayKey));
    setStats((st) => ({ ...st, offset: 0 }));
  };
  const goPage = (p: Page) => {
    if (p !== "home") return showView(p);
    if (!isPlanner(view)) return showView(lastPlanner.current);
    goToday();
    showView("day");
  };
  const startFocus = () => {
    if (view !== "day") showView("day");
    if (hasOpen) setFocus(true);
  };

  // What the bar says and where its arrows lead, for the page on screen.
  const sel = parseYmd(selected);
  const now = parseYmd(todayKey);
  const year = (d: Date) => (d.getFullYear() !== now.getFullYear() ? `, ${d.getFullYear()}` : "");
  const pickDay = (button: HTMLElement) => setPicking((p) => (p ? null : button));
  let head: Head;
  let nav: Nav | undefined;
  if (view === "day") {
    const relative = relativeDay(selected, todayKey);
    head = {
      title: relative ?? dayName(sel),
      soft: `${relative ? formatLong(sel) : `${MONTHS[sel.getMonth()]} ${sel.getDate()}`}${year(sel)}`,
      softShort: `${relative ? formatMedium(sel) : formatShort(sel)}${year(sel)}`,
      onTitle: pickDay,
      titleOpen: !!picking,
    };
    nav = {
      prev: "Previous day",
      next: "Next day",
      onPrev: () => selectDate(ymd(addDays(sel, -1))),
      onNext: () => selectDate(ymd(addDays(sel, 1))),
      back: selected !== todayKey ? { label: "Back to today", onClick: goToday } : undefined,
    };
  } else if (view === "week") {
    const start = startOfWeek(sel);
    const weeks = Math.round(dayDiff(start, startOfWeek(now)) / 7);
    head = {
      title: weeks === 0 ? "This week" : weeks === -1 ? "Last week" : weeks === 1 ? "Next week" : `Week of ${formatShort(start)}`,
      soft: shortRange(start, addDays(start, 6), now.getFullYear()),
      onTitle: pickDay,
      titleOpen: !!picking,
    };
    nav = {
      prev: "Previous week",
      next: "Next week",
      onPrev: () => selectDate(ymd(addDays(sel, -7))),
      onNext: () => selectDate(ymd(addDays(sel, 7))),
      back: weeks !== 0 ? { label: "Back to this week", onClick: goToday } : undefined,
    };
  } else if (view === "month") {
    head = { title: MONTHS[cal.m], soft: String(cal.y) };
    nav = {
      prev: "Previous month",
      next: "Next month",
      onPrev: () => setCal(({ y, m }) => monthOf(ymd(new Date(y, m - 1, 1)))),
      onNext: () => setCal(({ y, m }) => monthOf(ymd(new Date(y, m + 1, 1)))),
      back: cal.y !== now.getFullYear() || cal.m !== now.getMonth() ? { label: "Back to this month", onClick: goToday } : undefined,
    };
  } else if (view === "analytics") {
    const b = periodBounds(stats.period, stats.offset, todayKey);
    head = {
      title: "Progress",
      soft:
        stats.period === "week"
          ? shortRange(b.start, b.end, now.getFullYear())
          : stats.period === "month"
            ? `${MONTHS[b.start.getMonth()]} ${b.start.getFullYear()}`
            : String(b.start.getFullYear()),
    };
    nav = {
      prev: `Previous ${stats.period}`,
      next: `Next ${stats.period}`,
      onPrev: () => setStats((st) => ({ ...st, offset: st.offset - 1 })),
      onNext: () => setStats((st) => ({ ...st, offset: Math.min(0, st.offset + 1) })),
      nextDisabled: stats.offset === 0,
      back: stats.offset !== 0 ? { label: `Back to this ${stats.period}`, onClick: goToday } : undefined,
    };
  } else head = { title: view === "timeline" ? "Timeline" : view === "goals" ? "Goals" : "Agent" };
  const center =
    view === "analytics" ? (
      <SegmentedControl
        label="Period"
        value={stats.period}
        onChange={(period) => setStats({ period, offset: 0 })}
        options={[
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
          { value: "year", label: "Year" },
        ]}
      />
    ) : isPlanner(view) ? (
      <SegmentedControl
        label="View"
        value={view}
        onChange={showView}
        options={[
          { value: "day", label: "Day", tip: "Day (D)" },
          { value: "week", label: "Week", tip: "Week (W)" },
          { value: "month", label: "Month", tip: "Month (M)" },
        ]}
      />
    ) : undefined;
  // The page's own actions, on the right: how much of the day is done, beside Focus.
  const barActions = isPlanner(view) ? (
    <>
      {view === "day" && <DayCount done={dayTasks.filter((t) => t.done).length} total={dayTasks.length} />}
      <Button onClick={startFocus} disabled={!hasOpen} aria-label="Focus" data-tip="Focus on one task at a time (F)" className="max-sm:w-8 max-sm:px-0 sm:pr-3 sm:pl-2.5">
        <FocusIcon size={15} />
        <span className="max-sm:hidden">Focus</span>
      </Button>
    </>
  ) : undefined;
  const phone = typeof window !== "undefined" && !window.matchMedia("(min-width: 768px)").matches;
  const monthPicker = (large: boolean) => (
    <MiniMonth
      large={large}
      year={mini.y}
      month={mini.m}
      selected={selected}
      todayKey={todayKey}
      byDate={byDate}
      onShift={(n) => setMini(({ y, m }) => monthOf(ymd(new Date(y, m + n, 1))))}
      onSelect={(key) => {
        selectDate(key);
        setPicking(null);
      }}
    />
  );

  return (
    <DragProvider ordered={sort.key === "manual"} scroller={scroller} onDrop={dropTask}>
      {/* Edge to edge: the sidebar on the left (computers, unless hidden), the work area beside it with its bar on top. */}
      {/* While the voice screen or focus is up, the app behind it is out of reach of the keyboard and of assistive tech. */}
      <div inert={speaking || !!focus} className="min-h-dvh bg-surface md:flex md:h-dvh md:min-h-0">
        {sidebar && (
          <Sidebar
            user={user}
            sync={sync}
            view={view}
            onPage={goPage}
            onHide={toggleSidebar}
            onAccount={openAccount}
            accountOpen={!!accountMenu}
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <AppBar
            user={user}
            sync={sync}
            head={head}
            nav={nav}
            center={center}
            actions={barActions}
            sidebar={sidebar}
            onShowSidebar={toggleSidebar}
            onAccount={openAccount}
            accountOpen={!!accountMenu}
          />
          {/* Computers: the work area scrolls inside. Phones: the page scrolls. */}
          <main ref={scroller} className="min-h-0 flex-1 overflow-x-clip pb-[calc(env(safe-area-inset-bottom)+24px)] md:scroll-pt-4 md:overflow-y-auto md:pb-0">
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
                onMoveToToday={moveAllToToday}
                carried={carried}
                onSpeak={speak}
                welcome={welcome}
              />
            )}
            {view === "week" && <WeekView selected={selected} sections={sections} state={tableState} actions={actions} />}
            {view === "month" && (
              <MonthView
                year={cal.y}
                month={cal.m}
                selected={selected}
                todayKey={todayKey}
                byDate={byDate}
                onShift={(n) => setCal(({ y, m }) => monthOf(ymd(new Date(y, m + n, 1))))}
                onSelectDate={selectDate}
                onOpenDay={openDay}
                onToggle={actions.toggle}
                onCreate={(date, title) => {
                  // At the top of the day, as everywhere a task is written above its list.
                  const first = sortTasks(
                    byDate(date).filter((t) => !t.done),
                    DEFAULT_SORT,
                  )[0];
                  create({ title, description: "", date, done: false, position: placeBetween(undefined, first) });
                }}
              />
            )}
            {view === "analytics" && (
              <AnalyticsView
                period={stats.period}
                offset={stats.offset}
                todayKey={todayKey}
                firstDay={firstDay}
                ai={voice}
                account={account}
                byDate={byDate}
                onOffset={(offset) => setStats((s) => ({ ...s, offset: Math.min(0, offset) }))}
                onDrill={(period, offset) => setStats({ period, offset })}
                onOpenDay={openDay}
                onToggle={actions.toggle}
                onMove={actions.move}
                onPlan={() => showView(stats.period === "week" ? "week" : "month")}
              />
            )}
            {(view === "timeline" || view === "goals" || view === "agent") && <ComingSoon page={view} />}
          </main>
        </div>
      </div>

      {focus && (
        <FocusPanel
          queue={focus.queue}
          done={dayTasks.filter((t) => t.done && !focus.queue.includes(t)).length}
          total={dayTasks.length}
          isToday={selected === todayKey}
          onDone={focus.onDone}
          onLater={focus.onLater}
          onExit={focus.onExit}
          onCapture={focus.onCapture}
        />
      )}
      {picking &&
        (phone ? (
          <Modal label="Pick a day" sheet onClose={() => setPicking(null)} className="max-w-[400px] p-3 pt-3.5">
            {monthPicker(true)}
          </Modal>
        ) : (
          <Popover anchor={picking.getBoundingClientRect()} trigger={picking} label="Pick a day" onClose={() => setPicking(null)} className="w-[284px] p-3">
            {monthPicker(false)}
          </Popover>
        ))}
      {accountMenu && (
        <AccountPanel
          user={user}
          anchor={accountMenu}
          phone={phone}
          view={view}
          usage={voice ? usage : undefined}
          onPage={goPage}
          onSettings={() => setSheet("general")}
          onShortcuts={() => setSheet("shortcuts")}
          onClose={() => setAccountMenu(null)}
        />
      )}
      {sheet && (
        <SettingsSheet
          tab={sheet}
          user={user}
          weekStart={weekStart}
          onWeekStart={changeWeekStart}
          sort={sort}
          onSort={setSort}
          voice={voice}
          transcribe={transcribe}
          sample={sample}
          onClose={() => setSheet(null)}
        />
      )}
      {searching && <SearchPalette todayKey={todayKey} onOpen={openFound} onClose={() => setSearching(false)} />}
      {speaking && <VoiceScreen todayKey={todayKey} weekStart={weekStart} server={transcribe} sample={sample} onAdd={addDrafts} onClose={() => setSpeaking(false)} />}

      {/* One toast at a time: a new one takes the place of the last at once; the last one leaves gently. */}
      <div
        className={`pointer-events-none fixed inset-x-0 z-[120] grid justify-center px-4 md:bottom-6 ${
          focus ? "bottom-[calc(env(safe-area-inset-bottom)+84px)] md:bottom-24" : "bottom-[calc(env(safe-area-inset-bottom)+20px)]"
        }`}
      >
        {toast && <ToastView key={toast.id} toast={toast} replaced={toastReplaced} onDone={() => setToast(null)} />}
      </div>
    </DragProvider>
  );
}

/** The toast: rises in; leaves gently when it times out or is acted on, at once when another takes its place. */
function ToastView({ toast, replaced, onDone }: { toast: Toast; replaced: React.RefObject<boolean>; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    replaced.current = false;
    return () => {
      if (!replaced.current) exitCopy(el, "down");
    };
  }, [replaced]);
  return (
    <div
      ref={ref}
      role="status"
      className={`pointer-events-auto flex min-h-10 animate-rise items-center gap-3 rounded-lg bg-ink text-footnote text-surface shadow-float [grid-area:1/1] ${
        toast.action ? "py-1.5 pr-1.5 pl-4" : "px-4 py-2"
      }`}
    >
      <span className="line-clamp-2 max-w-[min(60vw,420px)]">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.run();
            onDone();
          }}
          className="tap relative flex h-7 items-center rounded-sm bg-surface/12 px-2.5 font-semibold transition-colors hover:bg-surface/20"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
