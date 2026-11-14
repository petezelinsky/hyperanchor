"use client";

import { useState } from "react";
import { formatShort } from "@/lib/dates";
import type { Summary } from "@/lib/stats";
import type { Task } from "@/lib/types";
import { ArrowRightIcon } from "../icons";
import { Button, Checkbox } from "../ui";
import { Card } from "./parts";

export function OpenCard({
  open,
  todayKey,
  onToggle,
  onMove,
  title = "Left open",
  empty = "Nothing from earlier days is waiting.",
  className = "",
}: {
  open: Summary["open"];
  todayKey: string;
  onToggle: (t: Task) => void;
  onMove: (t: Task, date: string) => void;
  title?: string;
  empty?: string;
  className?: string;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? open : open.slice(0, 6);

  return (
    <Card title={title} count={open.length} className={className}>
      {open.length === 0 ? (
        <p className="pb-2 text-footnote text-ink-3">{empty}</p>
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
                {day.key !== todayKey && (
                  <Button size="sm" variant="plain" onClick={() => onMove(task, todayKey)} aria-label={`Move “${task.title}” to today`} className="flex-none gap-1 text-ink!">
                    Today
                    <ArrowRightIcon size={12} />
                  </Button>
                )}
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
