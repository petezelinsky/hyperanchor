"use client";

import { useEffect, useRef } from "react";
import { DOW, addDays, parseYmd, startOfWeek, ymd } from "@/lib/dates";
import { CheckIcon } from "./icons";

export type Draft = { id: string | null; title: string; description: string; date: string; done: boolean };

export function TaskModal({
  draft,
  onChange,
  onSave,
  onClose,
  onDelete,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  onSave: () => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const titleRef = useRef<HTMLInputElement>(null);
  const isEdit = !!draft.id;
  const canSave = !!draft.title.trim();
  const ws = startOfWeek(parseYmd(draft.date));

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onSave]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(30,30,33,0.16)] p-4 backdrop-blur-[6px] sm:p-6"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Task" : "New task"}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full w-full max-w-[520px] overflow-y-auto rounded-[32px] bg-modal p-6 shadow-modal sm:p-7"
      >
        <div className="flex items-center justify-between">
          <div className="mono text-[11px] text-muted-2">{isEdit ? "Task" : "New task"}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="size-8 rounded-full bg-fill-2 text-base leading-none text-ink transition-colors duration-150 hover:bg-fill-hover"
          >
            ×
          </button>
        </div>

        <input
          ref={titleRef}
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onSave();
            }
          }}
          placeholder="Task title"
          aria-label="Task title"
          maxLength={500}
          className="mt-5 block w-full border-none bg-transparent p-0 text-[30px] font-medium tracking-[-0.025em] text-ink outline-none focus-visible:outline-none"
        />
        <textarea
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Description (optional)"
          aria-label="Description"
          rows={4}
          maxLength={5000}
          className="mt-[18px] block w-full resize-none rounded-[18px] border-none bg-fill px-4 py-3.5 text-sm leading-normal text-ink outline-none focus-visible:outline-none"
        />

        <div className="mono mt-[22px] text-[11px] text-muted-2">Day</div>
        <div className="mt-2.5 grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(ws, i);
            const key = ymd(d);
            const on = key === draft.date;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange({ date: key })}
                aria-pressed={on}
                className={`flex flex-col items-center gap-1 rounded-[14px] py-2.5 ${on ? "bg-primary text-white" : "bg-fill-2 text-ink"}`}
              >
                <span className="font-mono text-[10px] tracking-[0.08em] opacity-60 max-sm:text-[9px] max-sm:tracking-normal">{DOW[i]}</span>
                <span className="text-base font-medium">{d.getDate()}</span>
              </button>
            );
          })}
        </div>

        {isEdit && (
          <button
            type="button"
            onClick={() => onChange({ done: !draft.done })}
            aria-pressed={draft.done}
            className="mt-[18px] flex items-center gap-2.5 bg-transparent p-0 text-sm text-ink"
          >
            <span
              className={`flex size-5 items-center justify-center rounded-full border-[1.5px] ${draft.done ? "border-ink bg-ink" : "border-check bg-transparent"}`}
            >
              {draft.done && <CheckIcon size={10} strokeWidth={1.6} />}
            </span>
            <span>Done</span>
          </button>
        )}

        <div className="mt-7 flex items-center justify-between gap-3">
          <div>
            {isEdit && (
              <button
                type="button"
                onClick={onDelete}
                className="mono h-11 bg-transparent px-1 text-[11px] text-faint transition-colors duration-150 hover:text-danger"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="mono h-11 rounded-full bg-fill-2 px-5 text-[11px] text-ink transition-colors duration-150 hover:bg-fill-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              aria-disabled={!canSave}
              className={`mono h-11 rounded-full bg-primary px-[22px] text-[11px] text-white shadow-pill-dark-flat transition-colors duration-150 hover:bg-primary-hover ${canSave ? "" : "opacity-35"}`}
            >
              {isEdit ? "Save" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
