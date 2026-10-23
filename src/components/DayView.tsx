"use client";

import { addDays, dayDiff, DOW_FULL, DOW_SHORT, dowIndex, formatLong, MONTHS, MONTHS_SHORT, parseYmd, startOfWeek, ymd } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { QuickAdd, type QuickAddHandle } from "./QuickAdd";
import { TaskTable } from "./table/TaskTable";
import type { Section, TableActions, TableState } from "./table/types";
import { Button, ProgressLine } from "./ui";
import { EmptyState, NavControls, Page, SearchField, ViewHeader } from "./ViewHeader";

const plural = (n: number, w: string) => `${n} ${n === 1 ? w : w + "s"}`;

/** The day as a two-tone sentence. */
function statement(selected: string, todayKey: string, firstName: string, done: number, total: number): [string, string] {
  const d = parseYmd(selected);
  const diff = dayDiff(d, parseYmd(todayKey));
  const open = total - done;
  if (diff === 0) {
    const h = new Date().getHours();
    const greet = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    const rest = !total ? "Nothing planned yet." : !open ? "Everything’s done. Enjoy the rest of the day." : `${plural(open, "task")} left, ${done} done.`;
    return [`${greet}${firstName ? `, ${firstName}` : ""}.`, rest];
  }
  const name = diff === 1 ? "Tomorrow." : diff === -1 ? "Yesterday." : `${DOW_FULL[dowIndex(d)]}, ${MONTHS[d.getMonth()]} ${d.getDate()}.`;
  if (diff < 0) return [name, total ? `${done} of ${total} done.` : "Nothing was planned."];
  return [name, total ? `${plural(total, "task")} planned.` : "A clean slate."];
}

export function DayView({
  selected,
  section,
  state,
  actions,
  byDate,
  firstName,
  query,
  onQuery,
  onSelectDate,
  onMoveToToday,
  quickAdd,
  onQuickAdd,
}: {
  selected: string;
  section: Section;
  state: TableState;
  actions: TableActions;
  byDate: (key: string) => Task[];
  firstName: string;
  query: string;
  onQuery: (q: string) => void;
  onSelectDate: (key: string) => void;
  onMoveToToday: (tasks: Task[]) => void;
  quickAdd: React.RefObject<QuickAddHandle | null>;
  onQuickAdd: (title: string, date: string) => void;
}) {
  const { todayKey } = state;
  const d = parseYmd(selected);
  const all = byDate(selected);
  const done = all.filter((t) => t.done).length;
  const open = all.filter((t) => !t.done);
  const past = selected < todayKey;
  const [title, rest] = statement(selected, todayKey, firstName, done, all.length);

  return (
    <Page className="pb-20">
      <ViewHeader
        label={`${DOW_SHORT[dowIndex(d)]} · ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`}
        title={title}
        rest={rest}
        animKey={`${selected}|${rest}`}
      >
        <SearchField value={query} onChange={onQuery} />
        <NavControls
          prevLabel="Previous day"
          nextLabel="Next day"
          onPrev={() => onSelectDate(ymd(addDays(d, -1)))}
          onNext={() => onSelectDate(ymd(addDays(d, 1)))}
          onToday={() => onSelectDate(todayKey)}
          showToday={selected !== todayKey}
        />
      </ViewHeader>

      {all.length > 0 && (
        <div className="mt-5 flex items-center gap-3">
          <ProgressLine value={done / all.length} className="flex-1" />
          <span className="tabular font-mono text-[11px] text-muted">
            {done}/{all.length}
          </span>
        </div>
      )}

      <WeekStrip selected={selected} todayKey={todayKey} byDate={byDate} onSelect={onSelectDate} />

      <div className="mt-6">
        <QuickAdd ref={quickAdd} defaultDate={selected} todayKey={todayKey} onAdd={onQuickAdd} />
      </div>

      {past && open.length > 0 && !query && (
        <div className="mt-6 flex animate-up flex-wrap items-center justify-between gap-x-4 gap-y-2 border-y border-line py-3 text-[14px]">
          <span className="text-muted">
            <span className="text-ink">{plural(open.length, "task")} left open</span> on this day. Carry {open.length === 1 ? "it" : "them"} over?
          </span>
          <Button size="sm" onClick={() => onMoveToToday(open)}>
            Move to today
          </Button>
        </div>
      )}

      <div className="mt-8">
        <TaskTable
          sections={[section]}
          state={state}
          actions={actions}
          empty={
            query ? (
              <EmptyState title="No matches">Nothing on this day matches “{query}”.</EmptyState>
            ) : (
              <EmptyState title={past ? "Nothing was planned" : "A clean slate"}>{past ? "This day had no tasks." : "Type a task above and press Enter."}</EmptyState>
            )
          }
        />
      </div>
    </Page>
  );
}

function WeekStrip({ selected, todayKey, byDate, onSelect }: { selected: string; todayKey: string; byDate: (key: string) => Task[]; onSelect: (key: string) => void }) {
  const start = startOfWeek(parseYmd(selected));
  const idx = dowIndex(parseYmd(selected));
  return (
    <div className="relative mt-8 grid grid-cols-7">
      {/* The ink pill slides to the selected day. */}
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[calc(100%/7)] transition-transform duration-300 ease-quiet" style={{ transform: `translateX(${idx * 100}%)` }}>
        <span className="mx-0.5 block h-full rounded-[16px] bg-ink" />
      </span>
      {Array.from({ length: 7 }, (_, i) => {
        const day = addDays(start, i);
        const key = ymd(day);
        const sel = key === selected;
        const tasks = byDate(key);
        const done = tasks.filter((t) => t.done).length;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            aria-pressed={sel}
            aria-label={`${formatLong(day)}: ${tasks.length ? `${done} of ${tasks.length} done` : "no tasks"}`}
            className={`relative flex flex-col items-center gap-2 rounded-[16px] pt-3 pb-3.5 transition-colors duration-200 ${sel ? "" : "hover:bg-fill"}`}
          >
            <span className={`font-mono text-[10px] tracking-[0.08em] uppercase transition-colors duration-300 ${sel ? "text-on-ink/60" : "text-faint"}`}>{DOW_SHORT[i]}</span>
            <span
              className={`tabular text-[19px] leading-none font-medium transition-colors duration-300 ${sel ? "text-on-ink" : key < todayKey ? "text-faint" : "text-ink"}`}
            >
              {day.getDate()}
            </span>
            <span className="flex h-[5px] items-center gap-[3px]">
              {tasks.slice(0, 5).map((t) => (
                <span
                  key={t.id}
                  className={`size-[5px] rounded-full transition-colors duration-300 ${
                    t.done ? (sel ? "bg-on-ink" : "bg-ink") : sel ? "shadow-[inset_0_0_0_1px_var(--on-ink)]" : "shadow-[inset_0_0_0_1px_var(--ghost)]"
                  }`}
                />
              ))}
            </span>
            {key === todayKey && <span className="absolute top-2.5 left-1/2 size-[5px] translate-x-[16px] rounded-full bg-signal" />}
          </button>
        );
      })}
    </div>
  );
}
