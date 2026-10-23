"use client";

import { useState } from "react";
import { DOW_FULL, DOW_SHORT, MONTHS_SHORT } from "@/lib/dates";
import { fmt1, pct, type DayStat, type Summary, weekdayStats } from "@/lib/stats";
import type { Task } from "@/lib/types";
import { ArrowUpRightIcon } from "../icons";
import { Checkbox } from "../ui";
import { Section } from "./parts";

export function WeekdaySection({ days }: { days: DayStat[] }) {
  const ws = weekdayStats(days);
  const max = Math.max(...ws.map((w) => w.avg));
  const best = max > 0 ? ws.reduce((b, w) => (w.avg > b.avg ? w : b)) : null;

  return (
    <Section label="By weekday" aside={<span className="mono-label">Avg done · rate</span>}>
      <p className="text-[17px] leading-snug font-medium tracking-[-0.015em]">
        {best ? (
          <>
            {DOW_FULL[best.index]}s are your strongest. <span className="text-faint">{fmt1(best.avg)} done on average.</span>
          </>
        ) : (
          <span className="text-faint">Not enough completed tasks yet.</span>
        )}
      </p>
      <div className="mt-5 space-y-2.5">
        {ws.map((w) => (
          <div key={w.index} className="grid grid-cols-[38px_minmax(0,1fr)_76px] items-center gap-4">
            <span className={`font-mono text-[10.5px] tracking-[0.06em] uppercase ${best?.index === w.index ? "text-ink" : "text-faint"}`}>{DOW_SHORT[w.index]}</span>
            <span className="h-[6px] overflow-hidden rounded-full bg-track">
              <span
                className={`block h-full rounded-full transition-[width] duration-700 ease-quiet ${best?.index === w.index ? "bg-ink" : "bg-ink/30"}`}
                style={{ width: max ? `${(w.avg / max) * 100}%` : 0 }}
              />
            </span>
            <span className="tabular text-right font-mono text-[11px] text-ink">
              {fmt1(w.avg)}
              <span className="ml-2 text-faint">{w.rate == null ? "—" : pct(w.rate)}</span>
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function OpenSection({
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
    <Section label="Left open" aside={<span className="tabular mono-label">{open.length ? `${open.length} not done` : ""}</span>} className={className}>
      {open.length === 0 ? (
        <p className="text-[17px] leading-snug font-medium tracking-[-0.015em]">
          Nothing left open. <span className="text-faint">Everything planned got done.</span>
        </p>
      ) : (
        <>
          <ul className="-mt-2">
            {shown.map(({ task, day }) => (
              <li key={task.id} className="group flex h-12 items-center gap-3 border-b border-line last:border-b-0">
                <Checkbox size={18} checked={false} onToggle={() => onToggle(task)} label={`Mark “${task.title}” as done`} />
                <button type="button" onClick={() => onOpenDay(day.key)} className="min-w-0 flex-1 truncate text-left text-[14.5px] text-ink">
                  {task.title}
                </button>
                <span className="tabular flex-none font-mono text-[10.5px] text-faint uppercase">{day.isToday ? "Today" : `${MONTHS_SHORT[day.date.getMonth()]} ${day.date.getDate()}`}</span>
                {!day.isToday && (
                  <button
                    type="button"
                    onClick={() => onMove(task, todayKey)}
                    className="flex flex-none items-center gap-1 text-[13px] text-muted opacity-0 transition-[opacity,color] duration-150 group-hover:opacity-100 hover:text-ink focus-visible:opacity-100 pointer-coarse:opacity-100"
                  >
                    To today <ArrowUpRightIcon size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {open.length > 6 && (
            <button type="button" onClick={() => setAll((a) => !a)} className="mt-3 text-[13px] font-medium text-ink underline decoration-ghost underline-offset-4 hover:decoration-ink">
              {all ? "Show less" : `Show all ${open.length}`}
            </button>
          )}
        </>
      )}
    </Section>
  );
}
