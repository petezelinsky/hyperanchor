"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatMedium, parseYmd, relativeDay } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { CheckIcon, SearchIcon } from "./icons";
import { Kbd, Modal } from "./ui";

/** Wraps each match of `q` in a highlight. */
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return text;
  const parts: React.ReactNode[] = [];
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  let at = 0;
  for (let i = lower.indexOf(needle); i >= 0; i = lower.indexOf(needle, i + needle.length)) {
    if (i > at) parts.push(text.slice(at, i));
    parts.push(
      <mark key={i} className="rounded-[3px] bg-accent-soft px-px text-accent-ink">
        {text.slice(i, i + needle.length)}
      </mark>,
    );
    at = i + needle.length;
  }
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

/**
 * Search across every task, on any date (press / or ⌘K). Results come grouped by day, newest first;
 * ↑ ↓ pick one, Enter opens its day with the task selected.
 */
export function SearchPalette({ todayKey, onOpen, onClose }: { todayKey: string; onOpen: (task: Task) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Task[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const query = q.trim();

  useEffect(() => {
    if (!query) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      fetch(`/api/tasks/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { tasks: [] }))
        .then(({ tasks }: { tasks: Task[] }) => {
          setResults(tasks);
          setActive(0);
          setLoading(false);
        })
        .catch((e) => {
          if (e?.name === "AbortError") return;
          setResults([]);
          setLoading(false);
        });
    }, 140);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [query]);

  const groups = useMemo(() => {
    const out: { date: string; tasks: Task[] }[] = [];
    for (const t of results ?? []) {
      if (out.at(-1)?.date === t.date) out.at(-1)!.tasks.push(t);
      else out.push({ date: t.date, tasks: [t] });
    }
    return out;
  }, [results]);
  const flat = groups.flatMap((g) => g.tasks);

  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const open = (t: Task | undefined) => {
    if (!t) return;
    onOpen(t);
    onClose();
  };
  const label = (date: string) => {
    const d = parseYmd(date);
    const rel = relativeDay(date, todayKey);
    const year = d.getFullYear() !== parseYmd(todayKey).getFullYear() ? `, ${d.getFullYear()}` : "";
    return rel ? `${rel} · ${formatMedium(d)}` : `${formatMedium(d)}${year}`;
  };
  let index = -1;

  return (
    <Modal label="Search" onClose={onClose} top className="max-w-[640px]">
      <div className="flex items-center gap-3 border-b border-line px-4">
        <SearchIcon size={16} className="flex-none text-ink-3" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              if (flat.length) setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + flat.length) % flat.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              open(flat[active]);
            }
          }}
          placeholder="Search all tasks"
          aria-label="Search all tasks"
          role="combobox"
          aria-expanded={flat.length > 0}
          aria-controls="search-results"
          aria-activedescendant={flat.length ? `search-result-${active}` : undefined}
          maxLength={200}
          className="h-14 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-3"
        />
        {loading ? (
          <span aria-label="Searching" className="size-4 flex-none animate-spin rounded-full border-2 border-line-2 border-t-accent" />
        ) : (
          <span className="pointer-coarse:hidden">
            <Kbd>Esc</Kbd>
          </span>
        )}
      </div>
      <div ref={list} id="search-results" role="listbox" aria-label="Results" className="max-h-[min(60vh,480px)] overflow-y-auto overscroll-contain p-2">
        {results === null ? (
          <p className="px-3 py-6 text-center text-[13.5px] text-ink-3">Find any task by its title or notes, on any day.</p>
        ) : !flat.length ? (
          !loading && <p className="px-3 py-6 text-center text-[13.5px] text-ink-3">No tasks match “{query}”.</p>
        ) : (
          groups.map((g) => (
            <div key={g.date} role="group" aria-label={label(g.date)}>
              <div className="px-3 pt-2.5 pb-1 text-[11.5px] font-medium text-ink-3">{label(g.date)}</div>
              {g.tasks.map((t) => {
                index++;
                const i = index;
                return (
                  <div
                    key={t.id}
                    id={`search-result-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={i === active}
                    onMouseMove={() => setActive(i)}
                    onClick={() => open(t)}
                    className={`flex cursor-pointer items-start gap-3 rounded-[10px] px-3 py-2 ${i === active ? "bg-surface-3" : ""}`}
                  >
                    <span
                      className={`mt-0.5 flex size-[18px] flex-none items-center justify-center rounded-full ${
                        t.done ? "bg-accent text-on-accent" : "shadow-[inset_0_0_0_1.5px_var(--check-ring)]"
                      }`}
                    >
                      {t.done && <CheckIcon size={9} strokeWidth={2.6} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[14px] leading-5 ${t.done ? "text-ink-3" : "text-ink"}`}>
                        <Highlight text={t.title} q={query} />
                      </span>
                      {t.description && (
                        <span className="block truncate text-[12.5px] leading-[18px] text-ink-3">
                          <Highlight text={t.description.replace(/\s*\n\s*/g, " · ")} q={query} />
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
