"use client";

import { DOW, DOW_FULL, MONTHS, addDays, dayDiff, dowIndex, parseYmd, plural, startOfWeek, ymd } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { CheckIcon } from "./icons";

const arrow =
  "flex-none size-11 max-sm:size-8 rounded-full bg-transparent font-mono text-sm text-ink transition-colors duration-150 hover:bg-white";

export function DayView({
  selected,
  todayKey,
  byDate,
  onSelect,
  onNew,
  onOpen,
  onToggle,
}: {
  selected: string;
  todayKey: string;
  byDate: (key: string) => Task[];
  onSelect: (key: string) => void;
  onNew: () => void;
  onOpen: (t: Task) => void;
  onToggle: (t: Task) => void;
}) {
  const sel = parseYmd(selected);
  const ws = startOfWeek(sel);
  const list = byDate(selected);
  const sorted = [...list].sort((a, b) => Number(a.done) - Number(b.done));
  const doneN = list.filter((t) => t.done).length;

  const diff = dayDiff(sel, parseYmd(todayKey));
  const rel = diff === 0 ? " — Today" : diff === 1 ? " — Tomorrow" : diff === -1 ? " — Yesterday" : "";

  return (
    <main className="mx-auto max-w-[1280px] px-4 pt-2 pb-16 sm:px-6">
      <div className="flex items-center gap-1 rounded-[28px] bg-white/45 p-1.5 sm:gap-2 sm:p-2">
        <button type="button" aria-label="Previous week" className={arrow} onClick={() => onSelect(ymd(addDays(sel, -7)))}>
          ←
        </button>
        <div className="grid min-w-0 flex-1 grid-cols-7 gap-1 sm:gap-1.5">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(ws, i);
            const key = ymd(d);
            const isSel = key === selected;
            const isToday = key === todayKey;
            const tasks = byDate(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(key)}
                aria-pressed={isSel}
                aria-label={`${DOW_FULL[i]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`}
                className={`relative flex flex-col items-center gap-1.5 rounded-[20px] pt-3 pb-2.5 transition-colors duration-150 hover:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] ${
                  isSel ? "bg-primary text-white" : isToday ? "bg-white text-ink" : key < todayKey ? "bg-transparent text-muted-3" : "bg-transparent text-ink"
                }`}
              >
                <span className="font-mono text-[11px] tracking-[0.08em] opacity-60 max-sm:text-[9px] max-sm:tracking-normal">{DOW[i]}</span>
                <span className="text-[22px] leading-none font-medium tracking-[-0.02em] max-sm:text-lg">{d.getDate()}</span>
                <span className="flex h-1 gap-[3px]">
                  {tasks.slice(0, 4).map((t) => (
                    <span
                      key={t.id}
                      className={`size-1 rounded-full ${isSel ? (t.done ? "bg-white/35" : "bg-white") : t.done ? "bg-check" : "bg-ink"}`}
                    />
                  ))}
                </span>
                {isToday && !isSel && <span className="absolute top-2.5 right-2.5 size-1.5 rounded-full bg-todo max-sm:top-1.5 max-sm:right-1.5" />}
              </button>
            );
          })}
        </div>
        <button type="button" aria-label="Next week" className={arrow} onClick={() => onSelect(ymd(addDays(sel, 7)))}>
          →
        </button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 px-2 pt-11 pb-7">
        <div>
          <div className="mono text-[11px] text-muted-2">
            {DOW_FULL[dowIndex(sel)]}
            {rel}
          </div>
          <h1 className="mt-3 text-[clamp(36px,5vw,56px)] leading-[1.04] font-medium tracking-[-0.035em]">
            {MONTHS[sel.getMonth()]} {sel.getDate()}
          </h1>
          <p className="mt-3 text-sm text-muted">{list.length ? `${plural(list.length, "task")} · ${doneN} done` : "Nothing planned yet"}</p>
        </div>
        {selected !== todayKey && (
          <button
            type="button"
            onClick={() => onSelect(todayKey)}
            className="mono h-11 rounded-full bg-white px-5 text-[11px] text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors duration-150 hover:bg-[#F7F7F6]"
          >
            Back to today
          </button>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-4">
        {sorted.map((t) => (
          <TaskCard key={t.id} task={t} onOpen={() => onOpen(t)} onToggle={() => onToggle(t)} />
        ))}
        <button
          type="button"
          onClick={onNew}
          className="mono flex min-h-[260px] flex-col items-center justify-center gap-2.5 rounded-[30px] border-[1.5px] border-dashed border-dash bg-transparent text-[11px] text-muted-2 transition-colors duration-150 hover:bg-white/50 hover:text-ink"
        >
          <span className="text-[22px] leading-none">+</span>
          <span>New task</span>
        </button>
      </div>
    </main>
  );
}

function TaskCard({ task, onOpen, onToggle }: { task: Task; onOpen: () => void; onToggle: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`flex min-h-[260px] cursor-pointer flex-col rounded-[30px] p-[26px] shadow-card transition-shadow duration-200 hover:shadow-card-hover ${
        task.done ? "bg-white/50" : "bg-white"
      }`}
    >
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <span className={`size-[7px] rounded-full ${task.done ? "bg-done" : "bg-todo"}`} />
        <span>{task.done ? "Done" : "To do"}</span>
      </div>
      <div
        className={`mt-[18px] text-[26px] leading-[1.15] font-medium tracking-[-0.025em] text-pretty wrap-anywhere ${
          task.done ? "text-muted-3 line-through" : "text-ink"
        }`}
      >
        {task.title}
      </div>
      {task.description && (
        <div className="mt-2.5 line-clamp-4 text-[15px] leading-normal text-pretty whitespace-pre-line text-muted-2 wrap-anywhere">{task.description}</div>
      )}
      <div className="mt-auto flex pt-7">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-pressed={task.done}
          className="mono flex h-11 items-center gap-2.5 rounded-full bg-fill pr-[18px] pl-2 text-[11px] text-ink transition-colors duration-150 hover:bg-fill-hover-2"
        >
          <span
            className={`flex size-7 items-center justify-center rounded-full border-[1.5px] ${task.done ? "border-ink bg-ink" : "border-check bg-white"}`}
          >
            {task.done && <CheckIcon />}
          </span>
          <span>{task.done ? "Undo" : "Mark done"}</span>
        </button>
      </div>
    </div>
  );
}
