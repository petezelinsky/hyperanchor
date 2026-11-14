"use client";

import { useState } from "react";
import { formatShort } from "@/lib/dates";
import type { Summary } from "@/lib/stats";
import type { Task } from "@/lib/types";
import { tr } from "@/lib/i18n";
import { ArrowRightIcon } from "../icons";
import { Button, Checkbox } from "../ui";
import { Card } from "./parts";

export function OpenCard({
  open,
  todayKey,
  onToggle,
  onMove,
  title = tr("Left open"),
  empty = tr("Nothing from earlier days is waiting."),
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
                <Checkbox size={18} checked={false} onToggle={() => onToggle(task)} label={tr("Mark “{title}” as done", { title: task.title })} />
                <span dir="auto" className="min-w-0 flex-1 truncate text-body">
                  {task.title}
                </span>
                <span className="tabular flex-none text-caption text-ink-3">{formatShort(day.date)}</span>
                {day.key !== todayKey && (
                  <Button size="sm" variant="plain" onClick={() => onMove(task, todayKey)} aria-label={tr("Move “{title}” to today", { title: task.title })} className="flex-none gap-1 text-ink!">
                    {tr("Today")}
                    <ArrowRightIcon size={12} />
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {open.length > 6 && (
            <button type="button" onClick={() => setAll((a) => !a)} className="tap relative mt-3 text-caption font-medium text-ink-2 underline decoration-ink-4 underline-offset-[3px] hover:text-ink hover:decoration-current">
              {all ? tr("Show less") : tr("Show all {n}", { n: open.length })}
            </button>
          )}
        </>
      )}
    </Card>
  );
}
