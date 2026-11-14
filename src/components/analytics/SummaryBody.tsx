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
        <p style={at(0)} className={`max-w-[34ch] font-display text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-balance text-ink md:text-[26px] md:leading-[34px] ${enter}`}>
          {s.summary.headline}
        </p>
      )}
      {n > 0 && (
        <ol className={`${headline ? "mt-5" : ""} grid gap-2.5 ${n >= 3 ? "@3xl/analytics:grid-cols-3" : n === 2 ? "@2xl/analytics:grid-cols-2" : ""}`}>
          {s.summary.points.map((p, i) => (
            <li key={i} style={at(140 + i * 90)} className={`flex min-w-0 gap-3 rounded-[12px] bg-surface-2 p-4 shadow-[inset_0_0_0_1px_var(--line)] ${enter}`}>
              <span aria-hidden="true" className="tabular flex size-5 flex-none items-center justify-center rounded-full bg-surface text-caption-2 font-semibold text-ink-2 shadow-ring-line">
                {i + 1}
              </span>
              <span className="min-w-0 text-body text-pretty text-ink">{p}</span>
            </li>
          ))}
        </ol>
      )}
      {s.summary.next && (
        // The one thing to try: the only dark line of the panel.
        <div style={at(200 + n * 90)} className={`mt-2.5 flex items-start gap-3 rounded-[12px] bg-primary px-4 py-3.5 text-on-primary ${enter}`}>
          <ArrowRightIcon size={14} className="mt-[3px] flex-none opacity-70" />
          <p className="text-body text-pretty">
            <span className="font-semibold">Next {noun}: </span>
            <span className="opacity-85">{s.summary.next}</span>
          </p>
        </div>
      )}
    </div>
  );
}

