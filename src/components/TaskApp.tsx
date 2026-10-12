"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, monthGrid, parseYmd, startOfWeek, ymd } from "@/lib/dates";
import type { AppUser, Task } from "@/lib/types";
import { CalendarView } from "./CalendarView";
import { DayView } from "./DayView";
import { Header } from "./Header";
import { TaskModal, type Draft } from "./TaskModal";
import { useTasks } from "./useTasks";

type View = "day" | "calendar";

/** Today's local date key; refreshes when the tab regains focus (e.g. after midnight). */
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
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showError = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const { tasks, load, create, update, remove } = useTasks(showError);

  // Fetch whatever range is on screen.
  const [from, to] = useMemo(() => {
    if (view === "day") {
      const ws = startOfWeek(parseYmd(selected));
      return [ymd(ws), ymd(addDays(ws, 6))];
    }
    const { start, end } = monthGrid(cal.y, cal.m);
    return [ymd(start), ymd(end)];
  }, [view, selected, cal]);

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

  const openNew = () => setDraft({ id: null, title: "", description: "", date: selected, done: false });
  const openEdit = (t: Task) => setDraft({ id: t.id, title: t.title, description: t.description, date: t.date, done: t.done });
  const closeModal = useCallback(() => setDraft(null), []);

  const save = useCallback(() => {
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) return;
    const fields = { title, description: draft.description.trim(), date: draft.date, done: draft.done };
    if (draft.id) {
      const prev = tasks[draft.id];
      if (prev) {
        const patch = Object.fromEntries(
          Object.entries(fields).filter(([k, v]) => prev[k as keyof typeof fields] !== v),
        ) as Partial<typeof fields>;
        if (Object.keys(patch).length) update(draft.id, patch);
      }
    } else {
      create(fields);
    }
    setDraft(null);
  }, [draft, tasks, create, update]);

  const deleteDraft = () => {
    if (draft?.id) remove(draft.id);
    setDraft(null);
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
      <Header user={user} view={view} onView={showView} onNewTask={openNew} />

      {view === "day" ? (
        <DayView
          selected={selected}
          todayKey={todayKey}
          byDate={byDate}
          onSelect={setSelected}
          onNew={openNew}
          onOpen={openEdit}
          onToggle={(t) => update(t.id, { done: !t.done })}
        />
      ) : (
        <CalendarView
          year={cal.y}
          month={cal.m}
          selected={selected}
          todayKey={todayKey}
          byDate={byDate}
          onPick={(key) => {
            setSelected(key);
            setView("day");
          }}
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

      {draft && (
        <TaskModal
          draft={draft}
          onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
          onSave={save}
          onClose={closeModal}
          onDelete={deleteDraft}
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
