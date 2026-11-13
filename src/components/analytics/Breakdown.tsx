"use client";

import { useState } from "react";
import { formatShort, weekdayNames } from "@/lib/dates";
import { fmt1, pct, type DayStat, type Summary, weekdayStats } from "@/lib/stats";
import type { Task } from "@/lib/types";
import { ArrowRightIcon } from "../icons";
import { Button, Checkbox } from "../ui";
import { Card } from "./parts";

/** Average completed per weekday. Emphasis: the best day in the accent, the rest de-emphasized. */
export function WeekdayCard({ days, className = "" }: { days: DayStat[]; className?: string }) {
  const ws = weekdayStats(days);
  const short = weekdayNames("short");
  const max = Math.max(...ws.map((w) => w.avg));
  const best = max > 0 ? ws.reduce((b, w) => (w.avg > b.avg ? w : b)) : null;

  return (
    <Card title="By weekday" className={className} aside={<span className="text-caption text-ink-3">Average done per day</span>}>
      <div className="space-y-2">
        {ws.map((w) => {
          const top = best?.index === w.index;
          return (
            <div key={w.index} className="grid grid-cols-[34px_minmax(0,1fr)_76px] items-center gap-3">
              <span className={`text-footnote ${top ? "font-semibold text-ink" : "text-ink-2"}`}>{short[w.index]}</span>
              <span className="h-2 overflow-hidden rounded-full bg-surface-3">
                <span
                  className={`block h-full origin-left rounded-full transition-transform duration-(--duration-data) ease-out ${top ? "bg-accent" : "bg-ink-4"}`}
                  style={{ transform: `scaleX(${max ? w.avg / max : 0})` }}
                />
              </span>
              <span className="tabular text-right text-footnote text-ink">
                {fmt1(w.avg)}
                <span className="ml-1.5 text-ink-3">{w.rate == null ? "—" : pct(w.rate)}</span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-footnote text-ink-2">
        {best ? (
          <>
            You get the most done on <span className="font-semibold text-ink">{weekdayNames("full")[best.index]}s</span>.
          </>
        ) : (
          "Not enough done yet to compare."
        )}
      </p>
    </Card>
  );
}

export function OpenCard({
  open,
  todayKey,
  onToggle,
  onMove,
  className = "",
}: {
  open: Summary["open"];
  todayKey: string;
  onToggle: (t: Task) => void;
  onMove: (t: Task, date: string) => void;
  className?: string;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? open : open.slice(0, 6);

  return (
    <Card title="Left open" count={open.length} className={className}>
      {open.length === 0 ? (
        <p className="pb-2 text-footnote text-ink-3">Nothing from earlier days is waiting.</p>
      ) : (
        <>
          <ul>
            {shown.map(({ task, day }) => (
              <li key={task.id} data-flip={task.id} className="flex items-center gap-3 border-b border-line py-2 last:border-0">
                <Checkbox size={18} checked={false} onToggle={() => onToggle(task)} label={`Mark “${task.title}” as done`} />
                <span dir="auto" className="min-w-0 flex-1 truncate text-body">
                  {task.title}
                </span>
                <span className="tabular flex-none text-caption text-ink-3">{formatShort(day.date)}</span>
                <Button size="sm" variant="plain" onClick={() => onMove(task, todayKey)} aria-label={`Move “${task.title}” to today`} className="flex-none gap-1 text-ink!">
                  Today
                  <ArrowRightIcon size={12} />
                </Button>
              </li>
            ))}
          </ul>
          {open.length > 6 && (
            <button type="button" onClick={() => setAll((a) => !a)} className="tap relative mt-3 text-caption font-medium text-ink-2 underline decoration-ink-4 underline-offset-[3px] hover:text-ink hover:decoration-current">
              {all ? "Show less" : `Show all ${open.length}`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}
