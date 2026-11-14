"use client";

import { useEffect, useRef, useState } from "react";
import type { SavedSummary, SummaryPeriod } from "@/lib/summaries";
import { ChevronDown, TrashIcon, XIcon } from "../icons";
import { motion, reducedMotion } from "../motion";
import { IconButton, Modal } from "../ui";
import { SummaryBody, writtenAt } from "./SummaryBody";

const NAMES: Record<SummaryPeriod, string> = { day: "Day", week: "Week", month: "Month", year: "Year" };
const FILTERS: ("all" | SummaryPeriod)[] = ["all", "day", "week", "month", "year"];

/**
 * Every summary written, newest first, in a window: which period it's about, when it was written, its headline. A
 * summary opens in place to be read whole, and can be deleted (a first press asks, a second one deletes). Deleting
 * erases its words; the count of tasks it was written at stays, so the period's next summary still waits for its turn.
 */
export function SummaryHistory({ onClose, onDeleted }: { onClose: () => void; onDeleted: (id: string) => void }) {
  const [items, setItems] = useState<SavedSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<"all" | SummaryPeriod>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/summaries")
      .then((r) => (r.ok ? (r.json() as Promise<{ items: SavedSummary[] }>) : Promise.reject()))
      .then((b) => live && setItems(b.items))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  // A first press asks; the question goes away by itself after a few seconds.
  useEffect(() => {
    if (!asking) return;
    const t = setTimeout(() => setAsking(null), 3500);
    return () => clearTimeout(t);
  }, [asking]);

  const remove = async (s: SavedSummary) => {
    setAsking(null);
    const el = list.current?.querySelector<HTMLElement>(`[data-summary="${s.id}"]`);
    // It folds away first, then leaves the list.
    if (el && !reducedMotion()) {
      const h = el.offsetHeight;
      await el
        .animate([{ height: `${h}px`, opacity: 1 }, { height: "0px", opacity: 0, paddingTop: "0px", paddingBottom: "0px" }], { duration: motion().base, easing: motion().in, fill: "forwards" })
        .finished.catch(() => {});
    }
    setItems((all) => all?.filter((x) => x.id !== s.id) ?? null);
    const res = await fetch(`/api/summaries/${s.id}`, { method: "DELETE" }).catch(() => null);
    if (res && (res.ok || res.status === 404)) onDeleted(s.id);
    else setItems((all) => (all ? [...all, s].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) : all));
  };

  const present = new Set(items?.map((s) => s.period));
  const shown = (items ?? []).filter((s) => filter === "all" || s.period === filter);

  return (
    <Modal label="Summary history" onClose={onClose} sheet top className="flex max-h-[min(720px,88dvh)] max-w-[640px] flex-col overflow-hidden">
      <div className="flex flex-none items-center justify-between gap-3 border-b border-line py-3 pr-3 pl-5">
        <div className="min-w-0">
          <h2 className="text-body font-semibold text-ink">Summary history</h2>
          <p className="text-caption text-ink-3">{items ? `${items.length} ${items.length === 1 ? "summary" : "summaries"}, newest first` : " "}</p>
        </div>
        <IconButton label="Close" onClick={onClose}>
          <XIcon size={15} />
        </IconButton>
      </div>

      {items && items.length > 1 && present.size > 1 && (
        <div role="radiogroup" aria-label="Show" className="flex flex-none gap-1 border-b border-line px-4 py-2.5">
          {FILTERS.filter((f) => f === "all" || present.has(f)).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={filter === f}
              onClick={() => setFilter(f)}
              className={`h-7 rounded-full px-3 text-footnote transition-colors duration-(--duration-fast) ${
                filter === f ? "bg-primary text-on-primary" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {f === "all" ? "All" : NAMES[f]}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {failed ? (
          <p className="px-5 py-10 text-center text-footnote text-ink-2">The history didn’t load. Check your connection and try again.</p>
        ) : !items ? (
          <div aria-hidden="true" className="space-y-5 px-5 py-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <div className="skeleton h-3 w-40 rounded-full" />
                <div className="skeleton h-4 w-[80%] rounded-full" />
              </div>
            ))}
          </div>
        ) : !shown.length ? (
          <p className="px-5 py-10 text-center text-footnote text-ink-2">No summaries yet.</p>
        ) : (
          <ul ref={list}>
            {shown.map((s) => {
              const expanded = open === s.id;
              const ask = asking === s.id;
              return (
                <li key={s.id} data-summary={s.id} className="overflow-hidden border-b border-line last:border-0">
                  <div className="flex items-start gap-3 px-5 pt-4 pb-3.5">
                    <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : s.id)} className="group min-w-0 flex-1 text-left">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-3">
                        <span className="rounded-[5px] px-1.5 leading-[18px] font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--line-2)]">{NAMES[s.period]}</span>
                        <span className="text-ink-2">{s.label}</span>
                        <span aria-hidden="true">·</span>
                        <span>Written {writtenAt(s.createdAt)}</span>
                      </span>
                      <span className="mt-1.5 flex items-start gap-2">
                        <span className={`min-w-0 flex-1 text-callout font-medium text-pretty text-ink ${expanded ? "" : "line-clamp-2"}`}>{s.summary.headline}</span>
                        <ChevronDown size={14} className={`mt-1 flex-none text-ink-3 transition-transform duration-(--duration-base) group-hover:text-ink ${expanded ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                    {ask ? (
                      <button
                        type="button"
                        onClick={() => void remove(s)}
                        className="h-8 flex-none animate-[fade_var(--duration-fast)_var(--ease-out)_both] rounded-sm bg-red-soft px-2.5 text-footnote font-medium text-red-ink"
                      >
                        Delete
                      </button>
                    ) : (
                      <IconButton label={`Delete the summary of ${s.label}`} tip="Delete" size="sm" onClick={() => setAsking(s.id)} className="flex-none hover:text-red-ink!">
                        <TrashIcon size={14} />
                      </IconButton>
                    )}
                  </div>
                  {expanded && (
                    <div className="animate-[fade_var(--duration-base)_var(--ease-out)_both] px-5 pb-5">
                      <SummaryBody s={s} noun={NAMES[s.period].toLowerCase()} headline={false} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
