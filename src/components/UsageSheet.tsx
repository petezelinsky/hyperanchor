"use client";

import { useEffect, useRef, useState } from "react";
import { MONTHS_SHORT } from "@/lib/dates";
import type { Usage } from "@/lib/types";
import { SparkIcon, XIcon } from "./icons";
import { SoonTag } from "./Soon";
import { IconButton, Modal } from "./ui";

const count = new Intl.NumberFormat("en-US");
const DAYS = 14;

/** "Nov 14" for a UTC day key. */
const dayLabel = (key: string) => {
  const [, m, d] = key.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]} ${d}`;
};

/** When the allowance starts over (midnight UTC), on the person's own clock: "at 1:00 AM". */
function resetsAt() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/**
 * Usage: a window of its own (from the account's panel), on what the AI has used. Today against the day's 10,000
 * tokens, the last two weeks day by day, a few figures drawn from them, what things cost, and the plan without a limit
 * that is on its way.
 */
export function UsageSheet({ onClose }: { onClose: () => void }) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(`/api/usage?history=${DAYS}`)
      .then((r) => (r.ok ? (r.json() as Promise<Usage>) : Promise.reject()))
      .then((u) => live && setUsage(u))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const t = usage?.today;
  const days = usage?.history ?? [];
  const total = days.reduce((n, d) => n + d.tokens, 0);
  const active = days.filter((d) => d.tokens > 0);
  const busiest = days.reduce<(typeof days)[number] | null>((b, d) => (d.tokens > (b?.tokens ?? 0) ? d : b), null);
  const week = days.slice(-7).reduce((n, d) => n + d.tokens, 0);
  const requests = days.reduce((n, d) => n + d.requests, 0);
  const share = t ? Math.min(1, t.used / t.limit) : 0;

  return (
    <Modal label="Usage" onClose={onClose} sheet top className="flex max-h-[min(760px,92dvh)] max-w-[560px] flex-col overflow-hidden">
      <div className="flex h-[60px] flex-none items-center justify-between gap-3 border-b border-line pr-3 pl-5 md:pl-6">
        <h2 className="text-headline font-semibold">Usage</h2>
        <IconButton label="Close" onClick={onClose}>
          <XIcon size={15} />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-6 md:px-6" aria-busy={!usage && !failed}>
        {failed ? (
          <p className="py-10 text-center text-footnote text-ink-2">Usage didn’t load. Check your connection and try again.</p>
        ) : (
          <>
            {/* Today, against the day's allowance. */}
            <div className="text-caption font-medium text-ink-3">Today</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="tabular font-display text-[34px] leading-[40px] font-semibold tracking-[-0.025em] text-ink">{t ? count.format(t.used) : "–"}</span>
              <span className="text-footnote text-ink-3">of {count.format(t?.limit ?? 10000)} tokens</span>
            </div>
            <div
              role="img"
              aria-label={t ? `${count.format(t.used)} of ${count.format(t.limit)} tokens used today` : "Loading"}
              className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3"
            >
              <div className="h-full origin-left rounded-full bg-ink transition-transform duration-(--duration-data) ease-out" style={{ transform: `scaleX(${share})` }} />
            </div>
            <p className="mt-2 text-caption text-ink-3">
              {t ? `${count.format(t.left)} left` : " "}
              {t ? ` · starts over at ${resetsAt()}` : ""}
            </p>

            {/* The last two weeks, day by day. */}
            <div className="mt-7 flex items-baseline justify-between gap-3">
              <h3 className="text-footnote font-semibold text-ink">Last {DAYS} days</h3>
              <span className="tabular text-caption text-ink-3">{usage ? `${count.format(Math.round(total / DAYS))} a day on average` : ""}</span>
            </div>
            <Chart days={days} limit={t?.limit ?? 10000} loading={!usage} />

            <dl className="mt-5 grid grid-cols-3 divide-x divide-line rounded-[12px] shadow-[inset_0_0_0_1px_var(--line)]">
              {[
                ["Last 7 days", usage ? count.format(week) : "–", "tokens"],
                ["Busiest day", busiest && busiest.tokens ? dayLabel(busiest.day) : "–", busiest && busiest.tokens ? `${count.format(busiest.tokens)} tokens` : "nothing yet"],
                ["Days with AI", usage ? `${active.length} of ${DAYS}` : "–", `${count.format(requests)} ${requests === 1 ? "request" : "requests"}`],
              ].map(([label, value, foot]) => (
                <div key={label} className="min-w-0 px-3.5 py-3">
                  <dt className="truncate text-caption text-ink-3">{label}</dt>
                  <dd className="tabular mt-1 truncate text-callout font-semibold text-ink">{value}</dd>
                  <dd className="truncate text-caption text-ink-3">{foot}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-4 text-caption text-pretty text-ink-3">
              Speaking tasks, sorting them and the AI summary all draw on the same {count.format(t?.limit ?? 10000)} tokens a day. A minute of speech takes about 1,000, sorting it about 2,000, a summary about 3,000.
            </p>

            {/* The plan without a daily limit: not here yet. */}
            <div className="mt-6 flex items-start gap-3.5 rounded-[12px] bg-surface-2 p-4 shadow-[inset_0_0_0_1px_var(--line)]">
              <span aria-hidden="true" className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-surface text-ink shadow-ring-line">
                <SparkIcon size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-footnote font-semibold text-ink">Unlimited</span>
                  <SoonTag />
                </div>
                <p className="mt-0.5 text-footnote text-pretty text-ink-2">A subscription without the daily limit is on its way: speak and summarize as much as you like.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/** A bar a day (today last), against the day's allowance; the day under the pointer says what it used. */
function Chart({ days, limit, loading }: { days: { day: string; tokens: number; requests: number }[]; limit: number; loading: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const H = 132;
  const max = Math.max(limit, ...days.map((d) => d.tokens));
  const list = loading ? Array.from({ length: DAYS }, (_, i) => ({ day: String(i), tokens: 0, requests: 0 })) : days;
  const h = hover != null ? list[hover] : null;
  return (
    <div className="mt-6">
      <div ref={box} className="relative" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        {/* The allowance, as the line the bars reach for. */}
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-4" style={{ bottom: `${(limit / max) * 100}%` }}>
          <span className="tabular absolute bottom-1 left-0 text-caption-2 text-ink-3">The day’s {count.format(limit)}</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 border-t border-line-2" />
        <div className="relative grid h-full items-end gap-1.5" style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` }}>
          {list.map((d, i) => (
            <button
              key={d.day}
              type="button"
              tabIndex={loading ? -1 : 0}
              onMouseEnter={() => !loading && setHover(i)}
              onFocus={(e) => !loading && e.currentTarget.matches(":focus-visible") && setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={loading ? undefined : `${dayLabel(d.day)}: ${count.format(d.tokens)} tokens`}
              className={`flex h-full min-w-0 cursor-default flex-col items-center justify-end rounded-[5px] transition-colors duration-(--duration-fast) ${hover === i ? "bg-surface-2" : ""}`}
            >
              {loading ? (
                <span className="skeleton w-full max-w-[18px] rounded-t-xs" style={{ height: `${18 + ((i * 37) % 46)}%`, animationDelay: `${i * 40}ms` }} />
              ) : d.tokens > 0 ? (
                <span
                  className={`w-full max-w-[18px] origin-bottom rounded-t-xs ${i === list.length - 1 ? "bg-ink" : "bg-ink-3"}`}
                  style={{ height: `${Math.max(2, (d.tokens / max) * 100)}%`, animation: `grow-y var(--duration-data) ${i * 18}ms var(--ease-out) both` }}
                />
              ) : (
                <span className="h-[2px] w-full max-w-[18px] rounded-full bg-line-2" />
              )}
            </button>
          ))}
        </div>
        {h && hover != null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 w-max -translate-x-1/2 -translate-y-full rounded-[10px] bg-ink px-2.5 py-1.5 text-caption text-surface shadow-float"
            style={{ left: `${Math.min(88, Math.max(12, ((hover + 0.5) / list.length) * 100))}%`, top: Math.max(0, H - (h.tokens / max) * H - 8) }}
          >
            <div className="opacity-70">{dayLabel(h.day)}</div>
            <div className="tabular font-semibold">
              {count.format(h.tokens)} tokens <span className="font-normal opacity-70">· {h.requests} {h.requests === 1 ? "request" : "requests"}</span>
            </div>
          </div>
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-caption-2 text-ink-3">
        <span>{list.length && !loading ? dayLabel(list[0].day) : " "}</span>
        <span>{loading ? "" : "Today"}</span>
      </div>
    </div>
  );
}
