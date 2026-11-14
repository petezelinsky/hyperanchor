"use client";

import type { SavedSummary } from "@/lib/summaries";
import { ArrowRightIcon } from "../icons";

/** "today at 10:42", "Nov 3, 9:05 PM", "Dec 30, 2025, 6:12 PM". */
export function writtenAt(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (new Date().toDateString() === d.toDateString()) return `today at ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined })}, ${time}`;
}

/**
 * The summary itself: the gist as a headline, the observations side by side, numbered, and the one thing to try next.
 * Freshly written, each part comes into focus in turn.
 */
export function SummaryBody({
  s,
  noun,
  fresh = false,
  headline = true,
  className = "",
}: {
  s: SavedSummary;
  noun: string;
  fresh?: boolean;
  /** Off where the headline is already on show (the history's list). */
  headline?: boolean;
  className?: string;
}) {
  const at = (ms: number) => (fresh ? ({ animationDelay: `${ms}ms` } as React.CSSProperties) : undefined);
  const enter = fresh ? "summary-in" : "";
  const n = s.summary.points.length;
  return (
    <div className={className}>
      {headline && (
        <p style={at(0)} className={`max-w-[52ch] font-display text-[21px] leading-[29px] font-semibold tracking-[-0.018em] text-balance text-ink md:text-[23px] md:leading-[31px] ${enter}`}>
          {s.summary.headline}
        </p>
      )}
      {n > 0 && (
        <ol className={`${headline ? "mt-5" : ""} grid gap-x-6 gap-y-4 ${n >= 3 ? "md:grid-cols-3" : n === 2 ? "md:grid-cols-2" : ""}`}>
          {s.summary.points.map((p, i) => (
            <li key={i} style={at(140 + i * 90)} className={`flex min-w-0 gap-3 border-t border-line pt-3.5 ${enter}`}>
              <span aria-hidden="true" className="tabular pt-px text-caption font-semibold text-ink-3">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 text-body text-pretty text-ink">{p}</span>
            </li>
          ))}
        </ol>
      )}
      {s.summary.next && (
        <div style={at(200 + n * 90)} className={`mt-5 flex items-start gap-3 rounded-[12px] bg-surface-2 px-4 py-3.5 shadow-ring-line ${enter}`}>
          <ArrowRightIcon size={14} className="mt-[3px] flex-none text-ink-3" />
          <p className="text-body text-pretty text-ink-2">
            <span className="font-semibold text-ink">Next {noun}: </span>
            {s.summary.next}
          </p>
        </div>
      )}
    </div>
  );
}

