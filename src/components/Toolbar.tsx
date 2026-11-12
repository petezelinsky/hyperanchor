"use client";

import { ChevronLeft, ChevronRight, ReturnIcon } from "./icons";
import { Orb } from "./voice/Orb";

/** ‹ ›: one framed pair of arrows (the day, week, month or period before and after). */
export function Stepper({
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
  nextDisabled = false,
}: {
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
}) {
  const cell =
    "tap relative flex size-8 items-center justify-center text-ink-2 transition-colors duration-(--duration-fast) hover:bg-surface-3 hover:text-ink active:bg-line disabled:pointer-events-none disabled:text-ink-4";
  return (
    <div role="group" className="flex h-8 flex-none items-center rounded-sm bg-surface shadow-[inset_0_0_0_1px_var(--line-2)]">
      <button type="button" aria-label={prevLabel} data-tip={prevLabel} onClick={onPrev} className={`${cell} rounded-l-sm`}>
        <ChevronLeft size={15} />
      </button>
      <button type="button" aria-label={nextLabel} data-tip={nextLabel} onClick={onNext} disabled={nextDisabled} className={`${cell} rounded-r-sm border-l border-line-2`}>
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

/** The way back to the present, shown only away from it: an arrow that turns round (today, this week, this month). */
export function ReturnButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      data-tip={`${label} (T)`}
      onClick={onClick}
      className="tap relative flex size-8 flex-none animate-pop-in items-center justify-center rounded-sm bg-surface text-ink-2 shadow-[inset_0_0_0_1px_var(--line-2)] transition-colors duration-(--duration-fast) hover:bg-surface-3 hover:text-ink active:bg-line"
    >
      <ReturnIcon size={15} />
    </button>
  );
}

/** Speak your tasks: a small, quiet button beside "New task", with the sphere as its sign. */
export function SpeakChip({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Speak your tasks"
      data-tip="Speak your tasks (V)"
      className="tap relative flex h-7 flex-none items-center gap-1.5 rounded-sm bg-surface pr-2.5 pl-2 text-footnote font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--line-2)] transition-colors duration-(--duration-fast) hover:bg-surface-3 hover:text-ink active:bg-line"
    >
      <Orb size={16} />
      Speak
    </button>
  );
}
