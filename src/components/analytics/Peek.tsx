"use client";

import { formatLong, MONTHS } from "@/lib/dates";

import type { Task } from "@/lib/types";
import { tr } from "@/lib/i18n";
import { ArrowRightIcon, CheckIcon, XIcon } from "../icons";
import { Button, IconButton, Popover, type Anchor } from "../ui";
import { pct } from "./format";

/** What a click on a chart opens: a day (its tasks), or a month of the year (its numbers). */
export type Pick =
  | { kind: "day"; key: string; date: Date; tasks: Task[]; anchor: Anchor; trigger?: HTMLElement | null }
  | { kind: "month"; month: number; year: number; done: number; planned: number; activeDays: number; elapsedDays: number; best: { date: Date; done: number } | null; anchor: Anchor; trigger?: HTMLElement | null };

/** The part of a period that's done, as a thin line in the accent. */
function Meter({ value }: { value: number }) {
  return (
    <div aria-hidden="true" className="h-[3px] overflow-hidden rounded-full bg-accent-track">
      <div className="h-full origin-left rounded-full bg-accent transition-transform duration-(--duration-data) ease-out" style={{ transform: `scaleX(${value})` }} />
    </div>
  );
}

function Head({ title, line, onClose }: { title: string; line: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 pt-3.5 pr-2.5 pl-4">
      <div className="min-w-0 pt-px">
        <h3 className="truncate text-footnote font-semibold text-ink">{title}</h3>
        <p className="tabular mt-0.5 text-caption text-ink-3">{line}</p>
      </div>
      <IconButton label={tr("Close")} size="sm" onClick={onClose} className="-mt-0.5 flex-none">
        <XIcon size={14} />
      </IconButton>
    </div>
  );
}

/**
 * A day or a month, opened from a chart: no page change, just a small card beside what was clicked. A day lists its
 * tasks (done first) and offers to open it; a month gives its numbers and opens in Analytics. Escape, a click outside or
 * × closes it.
 */
export function Peek({ pick, todayKey, onOpenDay, onOpenMonth, onClose }: { pick: Pick; todayKey: string; onOpenDay: (key: string) => void; onOpenMonth: (year: number, month: number) => void; onClose: () => void }) {
  if (pick.kind === "month") {
    const rate = pick.planned ? pick.done / pick.planned : null;
    return (
      <Popover anchor={pick.anchor} trigger={pick.trigger} label={`${MONTHS[pick.month]} ${pick.year}`} onClose={onClose} className="w-[288px] max-w-[calc(100vw-16px)]">
        <Head title={`${MONTHS[pick.month]} ${pick.year}`} line={pick.planned ? `${tr("{done} of {total} done", { done: pick.done, total: pick.planned })} · ${pct(rate!)}` : tr("Nothing planned")} onClose={onClose} />
        {pick.planned > 0 && (
          <div className="px-4 pt-2.5">
            <Meter value={rate!} />
          </div>
        )}
        <dl className="mx-4 mt-3 text-footnote">
          <div className="flex items-center justify-between border-t border-line py-2">
            <dt className="text-ink-2">{tr("Days with something done")}</dt>
            <dd className="tabular text-ink">
              {pick.activeDays} <span className="text-ink-3">{tr("of {n}", { n: pick.elapsedDays })}</span>
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-line py-2">
            <dt className="text-ink-2">{tr("Best day")}</dt>
            <dd className="tabular text-ink">{pick.best ? `${formatLong(pick.best.date).replace(/^\w+, /, "")} · ${pick.best.done}` : "—"}</dd>
          </div>
        </dl>
        <div className="border-t border-line p-2">
          <Button
            size="sm"
            variant="plain"
            onClick={() => {
              onClose();
              onOpenMonth(pick.year, pick.month);
            }}
            className="w-full text-ink!"
          >
            {tr("See {month} in Analytics", { month: MONTHS[pick.month] })}
            <ArrowRightIcon size={13} />
          </Button>
        </div>
      </Popover>
    );
  }

  const tasks = [...pick.tasks].sort((a, b) => Number(b.done) - Number(a.done));
  const done = tasks.filter((t) => t.done).length;
  const title = formatLong(pick.date);
  return (
    <Popover anchor={pick.anchor} trigger={pick.trigger} label={title} onClose={onClose} className="w-[300px] max-w-[calc(100vw-16px)]">
      <Head title={title} line={tasks.length ? `${tr("{done} of {total} done", { done, total: tasks.length })} · ${pct(done / tasks.length)}` : pick.key > todayKey ? tr("Nothing planned yet") : tr("Nothing was planned")} onClose={onClose} />
      {tasks.length > 0 && (
        <>
          <div className="px-4 pt-2.5">
            <Meter value={done / tasks.length} />
          </div>
          <ul className="mt-2 max-h-[264px] overflow-y-auto overscroll-contain px-2 pb-1.5">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2.5 rounded-sm px-2 py-[7px] text-footnote">
                <span
                  aria-hidden="true"
                  className={`flex size-3.5 flex-none items-center justify-center rounded-full ${t.done ? "bg-accent text-on-accent" : "shadow-[inset_0_0_0_1.25px_var(--check-ring)]"}`}
                >
                  {t.done && <CheckIcon size={8} />}
                </span>
                <span dir="auto" className={`min-w-0 flex-1 truncate ${t.done ? "text-ink" : "text-ink-3"}`}>
                  {t.title}
                </span>
                <span className="sr-only">{t.done ? tr("done") : tr("open")}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className={`p-2 ${tasks.length ? "border-t border-line" : "mt-2"}`}>
        <Button
          size="sm"
          variant="plain"
          data-autofocus=""
          onClick={() => {
            onClose();
            onOpenDay(pick.key);
          }}
          className="w-full text-ink!"
        >
          {tr("Open day")}
          <ArrowRightIcon size={13} />
        </Button>
      </div>
    </Popover>
  );
}
