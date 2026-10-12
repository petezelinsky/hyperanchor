"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, monthGrid, parseYmd, startOfWeek, ymd } from "@/lib/dates";
import { periodRange, type StatsRange } from "@/lib/analytics";
import type { AppUser, Task } from "@/lib/types";
import { AnalyticsView } from "./AnalyticsView";
import { CalendarView } from "./CalendarView";
import { DayView, type Composer } from "./DayView";
import { Header, type View } from "./Header";
import { useTasks } from "./useTasks";

const SAVE_DELAY = 600; // ms of typing inactivity before a PATCH

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

export function TaskApp({ user }: { user: AppUser }) {
  const todayKey = useTodayKey();
  const [view, setView] = useState<View>("day");
  const [selected, setSelected] = useState(todayKey);
  const [cal, setCal] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const [stats, setStats] = useState<{ range: StatsRange; offset: number }>({ range: "week", offset: 0 });
  const [editing, setEditing] = useState<{ id: string; snapshot: string } | null>(null);
  const [composer, setComposer] = useState<Composer | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showError = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const { tasks, load, create, edit, remove } = useTasks(showError);

  // Fetch whatever range is on screen.
  const [from, to] = useMemo(() => {
    if (view === "day") {
      const ws = startOfWeek(parseYmd(selected));
      return [ymd(ws), ymd(addDays(ws, 6))];
    }
    if (view === "analytics") return periodRange(stats.range, stats.offset, todayKey);
    const { start, end } = monthGrid(cal.y, cal.m);
    return [ymd(start), ymd(end)];
  }, [view, selected, cal, stats, todayKey]);

  useEffect(() => {
    load(from, to);
  }, [load, from, to]);

  const byDateMap = useMemo(() => {
    const map = new Map<string, Task[]>();
    const sorted = Object.values(tasks).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const t of sorted) {
      const list = map.get(t.date);
      if (list) list.push(t);
      else map.set(t.date, [t]);
    }
    return map;
  }, [tasks]);
  const byDate = useCallback((key: string) => byDateMap.get(key) ?? [], [byDateMap]);

  // --- Inline editing -------------------------------------------------------

  const finishEdit = useCallback(() => {
    if (!editing) return;
    const t = tasks[editing.id];
    if (t) {
      const title = t.title.trim() || editing.snapshot || "Untitled";
      const description = t.description.trim();
      const patch: Partial<Pick<Task, "title" | "description">> = {};
      if (title !== t.title) patch.title = title;
      if (description !== t.description) patch.description = description;
      // Saves the cleaned values now; also flushes any pending debounced save.
      edit(t.id, patch);
    }
    setEditing(null);
    if (document.activeElement instanceof HTMLTextAreaElement) document.activeElement.blur();
  }, [editing, tasks, edit]);

  const startEdit = (id: string, focus: boolean) => {
    if (editing?.id === id) return;
    const t = tasks[id];
    if (!t) return;
    setEditing({ id, snapshot: t.title });
    if (focus) {
      // The title textarea is always rendered, so focus it synchronously and no keystrokes are lost.
      const el = document.querySelector<HTMLTextAreaElement>(`[data-title-for="${id}"]`);
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }
  };

  // --- Inline creation ------------------------------------------------------

  const openComposer = () => {
    finishEdit();
    setView("day");
    setComposer((c) => c ?? { title: "", description: "", nonce: Date.now() });
  };

  const addFromComposer = useCallback(
    (keepOpen: boolean) => {
      if (!composer) return;
      const title = composer.title.trim();
      if (!title) return;
      create({ title, description: composer.description.trim(), date: selected, done: false });
      setComposer(keepOpen ? { title: "", description: "", nonce: Date.now() } : null);
    },
    [composer, create, selected],
  );

  const closeComposer = useCallback(
    (commit: boolean) => {
      if (commit && composer?.title.trim()) addFromComposer(false);
      else setComposer(null);
    },
    [composer, addFromComposer],
  );

  // Click outside the active card, Esc and Cmd/Ctrl+Enter.
  useEffect(() => {
    if (!editing && !composer) return;
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element).closest?.('[data-editing="true"]')) return;
      if (editing) finishEdit();
      if (composer) closeComposer(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editing) finishEdit();
        else closeComposer(false);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (editing) finishEdit();
        else addFromComposer(true);
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [editing, composer, finishEdit, closeComposer, addFromComposer]);

  const openDay = (key: string) => {
    setSelected(key);
    setView("day");
  };

  const showView = (v: View) => {
    if (v === "calendar") {
      const d = parseYmd(selected);
      setCal({ y: d.getFullYear(), m: d.getMonth() });
    }
    setView(v);
  };

  return (
    <div className="min-h-dvh bg-bg">
      <Header user={user} view={view} onView={showView} onNewTask={openComposer} />

      {view === "day" ? (
        <DayView
          selected={selected}
          todayKey={todayKey}
          byDate={byDate}
          editingId={editing?.id ?? null}
          composer={composer}
          onSelect={setSelected}
          onStartEdit={startEdit}
          onFinishEdit={finishEdit}
          onEdit={(id, patch) => edit(id, patch, SAVE_DELAY)}
          onToggle={(t) => edit(t.id, { done: !t.done })}
          onDelete={(id) => {
            remove(id);
            setEditing(null);
          }}
          onOpenComposer={openComposer}
          onComposerChange={(patch) => setComposer((c) => (c ? { ...c, ...patch } : c))}
          onComposerAdd={addFromComposer}
          onComposerCancel={() => closeComposer(false)}
        />
      ) : view === "analytics" ? (
        <AnalyticsView
          range={stats.range}
          offset={stats.offset}
          todayKey={todayKey}
          byDate={byDate}
          onRange={(range) => setStats({ range, offset: 0 })}
          onOffset={(offset) => setStats((s) => ({ ...s, offset }))}
          onPick={openDay}
        />
      ) : (
        <CalendarView
          year={cal.y}
          month={cal.m}
          selected={selected}
          todayKey={todayKey}
          byDate={byDate}
          onPick={openDay}
          onShift={(n) =>
            setCal(({ y, m }) => {
              const d = new Date(y, m + n, 1);
              return { y: d.getFullYear(), m: d.getMonth() };
            })
          }
          onThisMonth={() => {
            const d = parseYmd(todayKey);
            setCal({ y: d.getFullYear(), m: d.getMonth() });
          }}
        />
      )}

      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-6 z-60 flex justify-center px-4">
          <div className="rounded-full bg-primary px-5 py-3 text-[13px] text-white shadow-pill-dark">{toast}</div>
        </div>
      )}
    </div>
  );
}
