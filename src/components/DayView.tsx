"use client";

import { useEffect, useRef } from "react";
import { DOW, DOW_FULL, MONTHS, addDays, dayDiff, dowIndex, parseYmd, plural, startOfWeek, ymd } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { AutoTextarea } from "./AutoTextarea";
import { CheckIcon } from "./icons";

const LIFT = "0 1px 2px rgba(0,0,0,0.04), 0 30px 60px -28px rgba(0,0,0,0.32)";
const DARK_SHADOW = "0 1px 2px rgba(0,0,0,0.08), 0 18px 36px -20px rgba(0,0,0,0.45)";
const CARD_TODO = "#2A2A2E";

const cardBase = "flex min-h-[240px] h-full flex-col rounded-[30px] p-[26px] transition-[box-shadow,background-color,transform] duration-200";
const titleCls = "mt-[18px] text-[26px] leading-[1.15] font-medium tracking-[-0.025em]";
const descCls = "mt-2.5 text-[15px] leading-normal";

const arrow = "flex-none size-7 rounded-full bg-transparent font-mono text-xs text-muted-2 transition-colors duration-150 hover:bg-white";

export type Composer = { title: string; description: string; nonce: number };

export function DayView({
  selected,
  todayKey,
  byDate,
  editingId,
  composer,
  onSelect,
  onStartEdit,
  onFinishEdit,
  onEdit,
  onToggle,
  onDelete,
  onOpenComposer,
  onComposerChange,
  onComposerAdd,
  onComposerCancel,
}: {
  selected: string;
  todayKey: string;
  byDate: (key: string) => Task[];
  editingId: string | null;
  composer: Composer | null;
  onSelect: (key: string) => void;
  onStartEdit: (id: string, focus: boolean) => void;
  onFinishEdit: () => void;
  onEdit: (id: string, patch: Partial<Pick<Task, "title" | "description">>) => void;
  onToggle: (t: Task) => void;
  onDelete: (id: string) => void;
  onOpenComposer: () => void;
  onComposerChange: (patch: Partial<Composer>) => void;
  onComposerAdd: (keepOpen: boolean) => void;
  onComposerCancel: () => void;
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
      <div className="mx-auto flex max-w-[480px] items-center gap-1">
        <button type="button" aria-label="Previous week" className={arrow} onClick={() => onSelect(ymd(addDays(sel, -7)))}>
          ←
        </button>
        <div className="grid min-w-0 flex-1 grid-cols-7 gap-0.5">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(ws, i);
            const key = ymd(d);
            const isSel = key === selected;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(key)}
                aria-pressed={isSel}
                aria-label={`${DOW_FULL[i]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`}
                className={`relative flex flex-col items-center gap-[3px] rounded-xl pt-1.5 pb-[5px] transition-colors duration-150 hover:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] ${
                  isSel ? "bg-white/75 text-ink" : key < todayKey ? "bg-transparent text-muted-3" : "bg-transparent text-muted"
                }`}
              >
                <span className="font-mono text-[9.5px] tracking-[0.08em] opacity-70">{DOW[i]}</span>
                <span className="text-sm leading-none font-medium">{d.getDate()}</span>
                <span className="flex h-[3px] gap-0.5">
                  {byDate(key)
                    .slice(0, 3)
                    .map((t) => (
                      <span key={t.id} className={`size-[3px] rounded-full ${t.done ? "bg-dash" : "bg-muted-2"}`} />
                    ))}
                </span>
                {key === todayKey && <span className="absolute top-[5px] right-1.5 size-1 rounded-full bg-todo" />}
              </button>
            );
          })}
        </div>
        <button type="button" aria-label="Next week" className={arrow} onClick={() => onSelect(ymd(addDays(sel, 7)))}>
          →
        </button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 px-2 pt-8 pb-7">
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

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] items-start gap-4">
        {sorted.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            active={editingId === t.id}
            onStartEdit={(focus) => onStartEdit(t.id, focus)}
            onFinishEdit={onFinishEdit}
            onEdit={(patch) => onEdit(t.id, patch)}
            onToggle={() => onToggle(t)}
            onDelete={() => onDelete(t.id)}
          />
        ))}
        {composer ? (
          <ComposerCard composer={composer} onChange={onComposerChange} onAdd={onComposerAdd} onCancel={onComposerCancel} />
        ) : (
          <button
            type="button"
            onClick={onOpenComposer}
            className="mono flex h-full min-h-[240px] flex-col items-center justify-center gap-2.5 rounded-[30px] border-[1.5px] border-dashed border-dash bg-transparent text-[11px] text-muted-2 transition-colors duration-150 hover:bg-white/50 hover:text-ink"
          >
            <span className="text-[22px] leading-none">+</span>
            <span>New task</span>
          </button>
        )}
      </div>
    </main>
  );
}

function TaskCard({
  task,
  active,
  onStartEdit,
  onFinishEdit,
  onEdit,
  onToggle,
  onDelete,
}: {
  task: Task;
  active: boolean;
  onStartEdit: (focus: boolean) => void;
  onFinishEdit: () => void;
  onEdit: (patch: Partial<Pick<Task, "title" | "description">>) => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { done } = task;
  const c = active
    ? { bg: "#FFFFFF", shadow: LIFT, status: "#2E2E32", title: done ? "#A3A3A7" : "#1E1E21", desc: "#3E3E42", btnBg: "#F1F1EF", btn: "#1E1E21" }
    : done
      ? { bg: "rgba(255,255,255,0.45)", shadow: "none", status: "#6B6B70", title: "#A3A3A7", desc: "#8B8B90", btnBg: "rgba(255,255,255,0.7)", btn: "#1E1E21" }
      : { bg: CARD_TODO, shadow: DARK_SHADOW, status: "#B8B8BC", title: "#FFFFFF", desc: "#B8B8BC", btnBg: "rgba(255,255,255,0.1)", btn: "#FFFFFF" };
  if (active && done) c.status = "#6B6B70";
  const ring = done ? "#1E1E21" : active ? "#C4C4C8" : "rgba(255,255,255,0.45)";
  const fill = done ? "#1E1E21" : active ? "#FFFFFF" : "transparent";

  return (
    <div
      data-editing={active ? "true" : "false"}
      onClick={(e) => onStartEdit((e.target as HTMLElement).tagName !== "TEXTAREA")}
      className={`${cardBase} ${active ? "" : "cursor-pointer"}`}
      style={{ background: c.bg, boxShadow: c.shadow, transform: active ? "translateY(-3px)" : "none" }}
    >
      <div className="flex min-h-5 items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px]" style={{ color: c.status }}>
          <span className={`size-[7px] rounded-full ${done ? "bg-done" : "bg-todo"}`} />
          <span>{done ? "Done" : "To do"}</span>
        </div>
        {active && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="mono bg-transparent p-0 text-[11px] text-faint transition-colors duration-150 hover:text-danger"
          >
            Delete
          </button>
        )}
      </div>
      <AutoTextarea
        data-title-for={task.id}
        value={task.title}
        onChange={(e) => onEdit({ title: e.target.value })}
        onFocus={() => onStartEdit(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onFinishEdit();
          }
        }}
        placeholder="Task title"
        aria-label="Task title"
        maxLength={500}
        className={`${titleCls} ${done ? "line-through" : ""}`}
        style={{ color: c.title }}
      />
      {(active || task.description) && (
        <AutoTextarea
          value={task.description}
          onChange={(e) => onEdit({ description: e.target.value })}
          onFocus={() => onStartEdit(false)}
          placeholder="Add a description"
          aria-label="Description"
          maxLength={5000}
          className={descCls}
          style={{ color: c.desc }}
        />
      )}
      <div className="mt-auto flex pt-6">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-pressed={done}
          className="mono flex h-11 items-center gap-2.5 rounded-full pr-[18px] pl-2 text-[11px] transition-opacity duration-150 hover:opacity-85"
          style={{ background: c.btnBg, color: c.btn }}
        >
          <span className="flex size-7 items-center justify-center rounded-full border-[1.5px]" style={{ borderColor: ring, background: fill }}>
            {done && <CheckIcon />}
          </span>
          <span>{done ? "Undo" : "Mark done"}</span>
        </button>
      </div>
    </div>
  );
}

function ComposerCard({
  composer,
  onChange,
  onAdd,
  onCancel,
}: {
  composer: Composer;
  onChange: (patch: Partial<Composer>) => void;
  onAdd: (keepOpen: boolean) => void;
  onCancel: () => void;
}) {
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const canAdd = !!composer.title.trim();

  useEffect(() => {
    titleRef.current?.focus();
  }, [composer.nonce]);

  return (
    <div data-editing="true" className={`${cardBase} bg-white`} style={{ boxShadow: LIFT, transform: "translateY(-3px)" }}>
      <div className="flex min-h-5 items-center gap-2 text-[13px] text-muted">
        <span className="size-[7px] rounded-full bg-todo" />
        <span>New task</span>
      </div>
      <AutoTextarea
        ref={titleRef}
        value={composer.title}
        onChange={(e) => onChange({ title: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onAdd(true);
          }
        }}
        placeholder="Task title"
        aria-label="Task title"
        maxLength={500}
        className={`${titleCls} text-ink`}
      />
      <AutoTextarea
        value={composer.description}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Add a description"
        aria-label="Description"
        maxLength={5000}
        className={`${descCls} text-ink-2`}
      />
      <div className="mt-auto flex items-center justify-between gap-2 pt-6">
        <span className="mono text-[11px] text-muted-3 max-sm:hidden">Enter ↵</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="mono h-11 rounded-full bg-fill px-[18px] text-[11px] text-ink transition-colors duration-150 hover:bg-fill-hover-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onAdd(false)}
            aria-disabled={!canAdd}
            className={`mono h-11 rounded-full bg-primary px-5 text-[11px] text-white shadow-pill-dark-flat transition-colors duration-150 hover:bg-primary-hover ${canAdd ? "" : "opacity-35"}`}
          >
            Add task
          </button>
        </div>
      </div>
    </div>
  );
}
