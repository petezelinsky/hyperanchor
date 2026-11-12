"use client";

import { useEffect, useRef, useState } from "react";
import { formatMedium, parseYmd, relativeDay, dayName } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { ArrowRightIcon, TrashIcon } from "./icons";
import { FoldRow, TaskTable } from "./table/TaskTable";
import type { Section, TableActions, TableState } from "./table/types";
import { Accordion, Button, Checkbox, IconButton, Kbd } from "./ui";

/** Focus mode for the selected day (null when off): what's left, in the order it will come up. */
export type Focus = {
  queue: Task[];
  onDone: (t: Task) => void;
  onLater: (t: Task) => void;
  onExit: () => void;
  onCapture: (title: string) => void;
} | null;

/** First visit: a short welcome instead of an empty list. */
export type Welcome = { name: string; onExamples: () => void; onDismiss: () => void } | null;

/**
 * The day: nothing but its tasks, in a column in the middle. A new task (or speaking them) starts at the top; what's
 * left follows; earlier days and what's done fold away under it. The day's name, date, count and controls live in the
 * bar above.
 */
export function DayView({
  selected,
  section,
  state,
  actions,
  completedOpen,
  onCompletedOpen,
  byDate,
  onMoveToToday,
  carried,
  onSpeak,
  welcome,
}: {
  selected: string;
  section: Section;
  state: TableState;
  actions: TableActions;
  completedOpen: boolean;
  onCompletedOpen: (open: boolean) => void;
  byDate: (key: string) => Task[];
  onMoveToToday: (tasks: Task[]) => void;
  /** Today only: tasks still open from earlier days. */
  carried: Task[];
  /** Opens the voice screen; absent where the server can't sort speech into tasks. */
  onSpeak?: () => void;
  welcome: Welcome;
}) {
  const { todayKey } = state;
  const d = parseYmd(selected);
  const all = byDate(selected);
  const open = all.filter((t) => !t.done);
  const past = selected < todayKey;
  const isToday = selected === todayKey;

  return (
    <div className="mx-auto w-full max-w-[792px] pt-1 pb-6 md:px-6 md:pt-3 md:pb-16">
      {past && open.length > 0 && (
        <Notice action={<MoveButton label="Move to today" onClick={() => onMoveToToday(open)} />}>{open.length} left open on this day</Notice>
      )}

      {welcome && !all.length && !carried.length ? (
        <WelcomeCard welcome={welcome} onAdd={() => actions.openComposer(selected)} />
      ) : (
        <TaskTable
          key={selected}
          sections={[section]}
          state={state}
          actions={actions}
          placeholderRow
          onSpeak={onSpeak}
          completedOpen={completedOpen}
          onCompletedOpen={onCompletedOpen}
          between={isToday && carried.length > 0 && <Carried tasks={carried} todayKey={todayKey} actions={actions} onMoveAll={() => onMoveToToday(carried)} />}
          cleared={
            <p className="flex h-12 items-center pl-[46px] text-body text-ink-3 md:pl-[42px]">
              {all.length
                ? isToday
                  ? "All done for today."
                  : "Everything on this day is done."
                : past
                  ? "Nothing was planned."
                  : isToday
                    ? "Nothing planned yet."
                    : `Nothing planned for ${dayName(d)} yet.`}
            </p>
          }
        />
      )}
    </div>
  );
}

const CHUNK = 50;

/** A quiet line above the list, with its actions after the words; what it opens appears below it. */
function Notice({ children, action, more }: { children: React.ReactNode; action: React.ReactNode; more?: React.ReactNode }) {
  return (
    <div className="px-4 pt-2 pb-1 text-footnote text-ink-2 md:px-3">
      <div className="flex min-h-8 flex-wrap items-center gap-x-1 gap-y-1">
        <span className="min-w-0">{children}</span>
        {action}
      </div>
      {more}
    </div>
  );
}

function MoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant="plain" onClick={onClick} className="gap-1 text-ink!">
      {label}
      <ArrowRightIcon size={12} />
    </Button>
  );
}

/**
 * Every task left open on an earlier day, as one quiet line. Review opens them most recent first, to tick off, bring to
 * today or let go one by one, and only then offers to move them all. The line keeps its size, so nothing jumps; a long
 * list scrolls inside.
 */
function Carried({ tasks, todayKey, actions, onMoveAll }: { tasks: Task[]; todayKey: string; actions: TableActions; onMoveAll: () => void }) {
  const [open, setOpen] = useState(false);
  // The list exists only while it's open (and while it closes), and grows by 50 as it's scrolled: hundreds of old tasks
  // cost nothing until someone looks at them.
  const [limit, setLimit] = useState(CHUNK);
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (!open) setLimit(CHUNK);
  }, [open]);
  useEffect(() => {
    const el = end.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setLimit((l) => l + CHUNK), { root: el.parentElement, rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [open, limit, tasks.length]);
  const n = tasks.length;
  const thisYear = parseYmd(todayKey).getFullYear();
  const when = (date: string) => {
    const d = parseYmd(date);
    return relativeDay(date, todayKey) ?? `${formatMedium(d)}${d.getFullYear() !== thisYear ? `, ${d.getFullYear()}` : ""}`;
  };
  return (
    <div>
      <FoldRow label="From earlier days" count={n} open={open} onToggle={() => setOpen(!open)} />
      <Accordion open={open}>
        <div className="pt-1 pb-3 pl-[46px] pr-4 md:pl-[42px] md:pr-3">
          {/* Bringing everything along is a choice made while looking at the list, not a button that's always there. */}
          <div className="flex min-h-9 items-center justify-between gap-3 text-footnote text-ink-3">
            <span>Most recent first. Tick off, bring to today, or let go.</span>
            <MoveButton label={n === 1 ? "Move to today" : "Move all to today"} onClick={onMoveAll} />
          </div>
          <ul className="mt-1 max-h-[min(52vh,440px)] overflow-y-auto overscroll-contain rounded-lg shadow-ring-line">
            {tasks.slice(0, limit).map((t, i) => (
              <li key={t.id} data-flip={t.id} className={`flex items-center gap-3 py-1.5 pr-2 pl-3.5 ${i ? "border-t border-line" : ""}`}>
                <Checkbox size={18} checked={t.done} onToggle={() => actions.toggle(t)} label={`Mark “${t.title}” as done`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-ink">{t.title}</span>
                  <span className="block text-caption text-ink-3">{when(t.date)}</span>
                </span>
                <Button size="sm" variant="plain" onClick={() => actions.move(t, todayKey)} className="gap-1 text-ink!">
                  Today
                  <ArrowRightIcon size={12} />
                </Button>
                <IconButton label={`Delete “${t.title}”`} tip="Delete" size="sm" onClick={() => actions.remove(t)} className="hover:text-red-ink!">
                  <TrashIcon size={14} />
                </IconButton>
              </li>
            ))}
            {limit < n && <li ref={end} aria-hidden="true" className="h-px" />}
          </ul>
        </div>
      </Accordion>
    </div>
  );
}

/** First visit: what Hyperanchor is for, the four moves that matter (keys on the left, as a legend), and a way to try them. */
function WelcomeCard({ welcome, onAdd }: { welcome: NonNullable<Welcome>; onAdd: () => void }) {
  const steps: { title: string; key: string; touch: string }[] = [
    { title: "Add what’s on your mind", key: "N", touch: "Tap +" },
    { title: "Tick tasks off as you go", key: "Space", touch: "Tap the box, or swipe right" },
    { title: "Stuck? Do one thing at a time", key: "F", touch: "Tap the focus button" },
    { title: "Plans change: move a task to another day", key: "Drag it", touch: "Swipe left for tomorrow" },
  ];
  return (
    // A note on the page, not a card over it: the same left edge as the list it stands in for.
    <div className="max-w-[520px] px-4 pt-5 md:px-3">
      <h2 className="font-display text-title-2 font-semibold tracking-[-0.02em]">Welcome, {welcome.name}.</h2>
      <p className="mt-1 text-body text-ink-2">Hyperanchor keeps your day calm: one list, one clear next step. Four things are enough to start.</p>
      <dl className="mt-5 border-t border-line">
        {steps.map((s) => (
          <div key={s.title} className="flex min-h-11 items-center gap-4 border-b border-line py-2">
            <dt className="w-14 flex-none pointer-coarse:hidden">{s.key === "Drag it" ? <span className="text-caption text-ink-3">Drag</span> : <Kbd>{s.key}</Kbd>}</dt>
            <dd className="min-w-0 flex-1">
              <span className="block text-body text-ink">{s.title}</span>
              {/* Phones: the gesture under the step. */}
              <span className="hidden text-caption text-ink-3 pointer-coarse:block">{s.touch}</span>
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="primary" onClick={welcome.onExamples}>
          Try it with three examples
        </Button>
        <Button
          variant="plain"
          onClick={() => {
            welcome.onDismiss();
            onAdd();
          }}
        >
          Start with my own
        </Button>
      </div>
    </div>
  );
}
