"use client";

import { useState } from "react";
import { DOW_FULL, DOW_SHORT, formatShort } from "@/lib/dates";
import { fmt1, pct, type DayStat, type Summary, weekdayStats } from "@/lib/stats";
import type { Task } from "@/lib/types";
import { Button, Checkbox } from "../ui";
import { Card } from "./parts";

/** Average completed per weekday. Emphasis: the best day in the accent, the rest de-emphasized. */
export function WeekdayCard({ days }: { days: DayStat[] }) {
  const ws = weekdayStats(days);
  const max = Math.max(...ws.map((w) => w.avg));
  const best = max > 0 ? ws.reduce((b, w) => (w.avg > b.avg ? w : b)) : null;

  return (
    <Card title="By weekday" aside={<span className="text-[12px] text-ink-3">Average completed per day</span>}>
      <div className="space-y-2">
        {ws.map((w) => {
          const top = best?.index === w.index;
          return (
            <div key={w.index} className="grid grid-cols-[34px_minmax(0,1fr)_76px] items-center gap-3">
              <span className={`text-[12.5px] ${top ? "font-semibold text-ink" : "text-ink-2"}`}>{DOW_SHORT[w.index]}</span>
              <span className="h-2 overflow-hidden rounded-full bg-surface-3">
                <span
                  className={`block h-full rounded-full transition-[width] duration-700 ease-out ${top ? "bg-accent" : "bg-ink-4"}`}
                  style={{ width: max ? `${(w.avg / max) * 100}%` : 0 }}
                />
              </span>
              <span className="tabular text-right text-[12.5px] text-ink">
                {fmt1(w.avg)}
                <span className="ml-1.5 text-ink-3">{w.rate == null ? "—" : pct(w.rate)}</span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[12.5px] text-ink-2">
        {best ? (
          <>
            You get the most done on <span className="font-semibold text-ink">{DOW_FULL[best.index]}s</span>.
          </>
        ) : (
          "Not enough completed tasks yet."
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
  onOpenDay,
  className = "",
}: {
  open: Summary["open"];
  todayKey: string;
  onToggle: (t: Task) => void;
  onMove: (t: Task, date: string) => void;
  onOpenDay: (key: string) => void;
  className?: string;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? open : open.slice(0, 6);

  return (
    <Card
      title="Left open"
      aside={<span className="tabular text-[12px] text-ink-3">{open.length ? `${open.length} not completed` : ""}</span>}
      className={className}
    >
      {open.length === 0 ? (
        <p className="flex items-center justify-center gap-2 py-6 text-center text-[13px] text-ink-2">
          <span className="size-1.5 rounded-full bg-accent" />
          Nothing left open — everything planned was completed.
        </p>
      ) : (
        <>
          <ul>
            {shown.map(({ task, day }) => (
              <li key={task.id} className="flex items-center gap-3 border-b border-line py-2 last:border-0">
                <Checkbox size={18} checked={false} onToggle={() => onToggle(task)} label={`Mark “${task.title}” as done`} />
                <button type="button" onClick={() => onOpenDay(day.key)} className="min-w-0 flex-1 truncate text-left text-[13.5px] underline-offset-2 hover:underline">
                  {task.title}
                </button>
                <span className={`tabular flex-none text-[12px] ${day.isToday ? "text-ink-3" : "font-medium text-ink-2"}`}>
                  {day.isToday ? "Today" : formatShort(day.date)}
                </span>
                {!day.isToday && (
                  <Button size="sm" onClick={() => onMove(task, todayKey)} className="flex-none">
                    Move to Today
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {open.length > 6 && (
            <button type="button" onClick={() => setAll((a) => !a)} className="mt-3 text-[12.5px] font-medium text-accent-ink hover:underline">
              {all ? "Show less" : `Show all ${open.length}`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}
