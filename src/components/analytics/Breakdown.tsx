"use client";

import { useState } from "react";
import { DOW_FULL, DOW_SHORT, formatShort } from "@/lib/dates";
import { fmt1, pct, type DayStat, type Summary, weekdayStats } from "@/lib/stats";
import type { Task } from "@/lib/types";
import { Button, Checkbox } from "../ui";
import { Card } from "./parts";

export function WeekdayCard({ days }: { days: DayStat[] }) {
  const ws = weekdayStats(days);
  const max = Math.max(...ws.map((w) => w.avg));
  const best = max > 0 ? ws.reduce((b, w) => (w.avg > b.avg ? w : b)) : null;

  return (
    <Card title="By weekday" aside={<span className="text-[12px] text-label-2">Average completed per day</span>}>
      <div className="space-y-1.5">
        {ws.map((w) => (
          <div key={w.index} className="grid grid-cols-[34px_minmax(0,1fr)_74px] items-center gap-3">
            <span className={`text-[12.5px] ${best?.index === w.index ? "font-semibold text-label" : "text-label-2"}`}>{DOW_SHORT[w.index]}</span>
            <span className="h-2 overflow-hidden rounded-full bg-fill-2">
              <span
                className={`block h-full rounded-full transition-[width] duration-700 ease-liquid ${best?.index === w.index ? "bg-ink" : "bg-label-3"}`}
                style={{ width: max ? `${(w.avg / max) * 100}%` : 0 }}
              />
            </span>
            <span className="tabular text-right text-[12.5px] text-label">
              {fmt1(w.avg)}
              <span className="ml-1.5 text-label-3">{w.rate == null ? "—" : pct(w.rate)}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[12.5px] text-label-2">
        {best ? (
          <>
            You complete the most on <span className="font-medium text-label">{DOW_FULL[best.index]}s</span>.
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
    <Card title="Left open" aside={<span className="tabular text-[12px] text-label-2">{open.length ? `${open.length} not completed` : ""}</span>} className={className}>
      {open.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-label-2">Nothing left open — everything planned was completed.</p>
      ) : (
        <>
          <ul>
            {shown.map(({ task, day }) => (
              <li key={task.id} className="flex items-center gap-3 border-b border-separator py-2 last:border-0">
                <Checkbox size={18} checked={false} onToggle={() => onToggle(task)} label={`Mark “${task.title}” as done`} />
                <button type="button" onClick={() => onOpenDay(day.key)} className="min-w-0 flex-1 truncate text-left text-[13.5px] underline-offset-2 hover:underline">
                  {task.title}
                </button>
                <span className="tabular flex-none text-[12px] text-label-3">{day.isToday ? "Today" : formatShort(day.date)}</span>
                {!day.isToday && (
                  <Button size="sm" variant="secondary" onClick={() => onMove(task, todayKey)} className="flex-none">
                    Move to Today
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {open.length > 6 && (
            <button type="button" onClick={() => setAll((a) => !a)} className="mt-3 text-[12.5px] font-semibold text-label underline decoration-label-4 underline-offset-[3px] hover:decoration-current">
              {all ? "Show less" : `Show all ${open.length}`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}
