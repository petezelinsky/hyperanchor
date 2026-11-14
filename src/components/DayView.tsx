"use client";

import { useEffect, useState } from "react";
import { dayDiff, dayName, formatMedium, parseYmd, relativeDay, yearAfter } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { tr, trn } from "@/lib/i18n";
import { ArrowRightIcon, TrashIcon } from "./icons";
import { CARD } from "./table/TaskRow";
import { FoldRow, NewTaskRow, TaskTable } from "./table/TaskTable";
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
  tools,
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
  /** Quiet controls of the list (the order of tasks), at the end of the "New task" line. */
  tools?: React.ReactNode;
  welcome: Welcome;
}) {
  const { todayKey } = state;
  const d = parseYmd(selected);
  const all = byDate(selected);
  const open = all.filter((t) => !t.done);
  const past = selected < todayKey;
  const isToday = selected === todayKey;

  // A day with nothing on it (and nothing left over from earlier days): the way to add stands in the middle of the page.
  if (!welcome && !all.length && !(isToday && carried.length) && state.composer?.date !== selected)
    return <EmptyDay date={selected} todayKey={todayKey} onAdd={() => actions.openComposer(selected)} onSpeak={onSpeak} />;

  return (
    <div className="mx-auto w-full max-w-[792px] pt-1 pb-6 md:px-6 md:pt-3 md:pb-16">
      {past && open.length > 0 && (
        <Notice action={<MoveButton label={tr("Move to today")} onClick={() => onMoveToToday(open)} />}>{trn(open.length, "{n} left open on this day", "{n} left open on this day")}</Notice>
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
          tools={tools}
          completedOpen={completedOpen}
          onCompletedOpen={onCompletedOpen}
          between={isToday && carried.length > 0 && <Carried tasks={carried} todayKey={todayKey} actions={actions} onMoveAll={() => onMoveToToday(carried)} />}
          cleared={
            <p className="flex h-12 items-center pl-[42px] text-body text-ink-3">
              {all.length
                ? isToday
                  ? tr("All done for today.")
                  : tr("Everything on this day is done.")
                : past
                  ? tr("Nothing was planned.")
                  : isToday
                    ? tr("Nothing planned yet.")
                    : tr("Nothing planned for {day} yet.", { day: dayName(d) })}
            </p>
          }
        />
      )}
    </div>
  );
}

/** An empty day: one line on it, and "New task" (with Speak) as a card in the middle of the page. */
function EmptyDay({ date, todayKey, onAdd, onSpeak }: { date: string; todayKey: string; onAdd: () => void; onSpeak?: () => void }) {
  const d = parseYmd(date);
  const tomorrow = dayDiff(d, parseYmd(todayKey)) === 1;
  const past = date < todayKey;
  const [title, line] = past
    ? [tr("Nothing was planned on this day."), tr("You can still add what you did.")]
    : date === todayKey
      ? [tr("Nothing planned for today."), tr("Add the first task, or say everything that’s on your mind.")]
      : [tomorrow ? tr("Nothing planned for tomorrow yet.") : tr("Nothing planned for {day} yet.", { day: dayName(d) }), tr("Get a head start: add a task, or say a few.")];
  return (
    // Phones: the screen under the two bars; computers: the work area. A little above the middle, where the eye rests.
    <div className="mx-auto flex min-h-[calc(100dvh-124px-env(safe-area-inset-bottom))] w-full max-w-[792px] flex-col items-center justify-center px-4 pb-[10dvh] text-center md:h-full md:min-h-[320px] md:px-6">
      <div className="flex w-full max-w-[400px] animate-rise flex-col items-center">
        <h2 className="text-headline font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-footnote text-balance text-ink-3">{line}</p>
        <NewTaskRow onClick={onAdd} onSpeak={onSpeak} className={`mt-6 w-full pr-2.5 pl-3 text-left ${CARD} transition-shadow duration-(--duration-fast) hover:shadow-[0_0_0_1px_var(--ink-4)]`} />
      </div>
    </div>
  );
}

/** How many tasks from earlier days show at first, and how many more each "Show more" adds. */
const FIRST = 12;
const MORE = 40;

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
 * Every task left open on an earlier day, as one quiet line. It opens on the most recent ones, to tick off, bring to
 * today or let go one by one, and offers to move them all. The list is part of the page (no box scrolling inside it)
 * and shows a dozen at first, more on request: hundreds of old tasks cost nothing until someone asks to see them.
 */
function Carried({ tasks, todayKey, actions, onMoveAll }: { tasks: Task[]; todayKey: string; actions: TableActions; onMoveAll: () => void }) {
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(FIRST);
  useEffect(() => {
    if (!open) setLimit(FIRST);
  }, [open]);
  const n = tasks.length;
  const thisYear = parseYmd(todayKey).getFullYear();
  const when = (date: string) => {
    const d = parseYmd(date);
    return relativeDay(date, todayKey) ?? `${formatMedium(d)}${d.getFullYear() !== thisYear ? yearAfter(d.getFullYear()) : ""}`;
  };
  return (
    <div>
      <FoldRow label={tr("From earlier days")} count={n} open={open} onToggle={() => setOpen(!open)} />
      <Accordion open={open}>
        <div className="px-3 pt-1 pb-3 md:px-0">
          {/* Bringing everything along is a choice made while looking at the list, not a button that's always there. */}
          <div className="flex min-h-9 items-center justify-between gap-3 pr-0.5 pl-3 text-footnote text-ink-3">
            <span>{tr("Most recent first. Tick off, bring to today, or let go.")}</span>
            <MoveButton label={n === 1 ? tr("Move to today") : tr("Move all to today")} onClick={onMoveAll} />
          </div>
          <ul className="mt-1 flex flex-col gap-1.5">
            {tasks.slice(0, limit).map((t) => (
              <li key={t.id} data-flip={t.id} className={`flex items-center gap-3 py-1.5 pr-1.5 pl-3 ${CARD}`}>
                <Checkbox size={18} checked={t.done} onToggle={() => actions.toggle(t)} label={tr("Mark “{title}” as done", { title: t.title })} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-ink">{t.title}</span>
                  <span className="block text-caption text-ink-3">{when(t.date)}</span>
                </span>
                <Button size="sm" variant="plain" onClick={() => actions.move(t, todayKey)} className="gap-1 text-ink!">
                  {tr("Today")}
                  <ArrowRightIcon size={12} />
                </Button>
                <IconButton label={tr("Delete “{title}”", { title: t.title })} tip={tr("Delete")} size="sm" onClick={() => actions.remove(t)} className="hover:text-red-ink!">
                  <TrashIcon size={14} />
                </IconButton>
              </li>
            ))}
          </ul>
          {limit < n && (
            <button
              type="button"
              onClick={() => setLimit((l) => l + MORE)}
              className="tap relative mt-2.5 ml-3 text-caption font-medium text-ink-2 underline decoration-ink-4 underline-offset-[3px] hover:text-ink hover:decoration-current"
            >
              {tr("Show {n} more", { n: Math.min(MORE, n - limit) })}
            </button>
          )}
        </div>
      </Accordion>
    </div>
  );
}

/** First visit: what Hyperanchor is for, the four moves that matter (keys on the left, as a legend), and a way to try them. */
function WelcomeCard({ welcome, onAdd }: { welcome: NonNullable<Welcome>; onAdd: () => void }) {
  const steps: { title: string; key: string; touch: string }[] = [
    { title: tr("Add what’s on your mind"), key: "N", touch: tr("Tap +") },
    { title: tr("Tick tasks off as you go"), key: tr("Space"), touch: tr("Tap the box, or swipe right") },
    { title: tr("Stuck? Do one thing at a time"), key: "F", touch: tr("Tap the focus button") },
    { title: tr("Plans change: move a task to another day"), key: tr("Drag it"), touch: tr("Swipe left for tomorrow") },
  ];
  return (
    // A note on the page, not a card over it: the same left edge as the list it stands in for.
    <div className="max-w-[520px] px-4 pt-5 md:px-3">
      <h2 className="font-display text-title-2 font-semibold tracking-[-0.02em]">{tr("Welcome, {name}.", { name: welcome.name })}</h2>
      <p className="mt-1 text-body text-ink-2">{tr("Hyperanchor keeps your day calm: one list, one clear next step. Four things are enough to start.")}</p>
      <dl className="mt-5 border-t border-line">
        {steps.map((s) => (
          <div key={s.title} className="flex min-h-11 items-center gap-4 border-b border-line py-2">
            <dt className="w-14 flex-none pointer-coarse:hidden">{s.key === "Drag it" ? <span className="text-caption text-ink-3">{tr("Drag")}</span> : <Kbd>{s.key}</Kbd>}</dt>
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
          {tr("Try it with three examples")}
        </Button>
        <Button
          variant="plain"
          onClick={() => {
            welcome.onDismiss();
            onAdd();
          }}
        >
          {tr("Start with my own")}
        </Button>
      </div>
    </div>
  );
}
