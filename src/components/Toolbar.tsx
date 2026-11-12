"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "./icons";
import { Orb } from "./voice/Orb";

/**
 * The head of a view's column: the title with its date beside it (never under it), and the few controls that go with
 * it. Counts live elsewhere (the sidebar's Progress). On computers it stays at the top while the list scrolls.
 * `onTitle` makes the title a button (phones: Day's title opens the calendar).
 */
export function ViewHead({
  title,
  soft,
  right,
  below,
  onTitle,
  titleOpen = false,
  titleButton = "always",
}: {
  title: React.ReactNode;
  /** The quiet part beside the title: a date, a range, the year. */
  soft?: React.ReactNode;
  right?: React.ReactNode;
  below?: React.ReactNode;
  onTitle?: () => void;
  titleOpen?: boolean;
  /** "phone": the title opens something on phones only. */
  titleButton?: "always" | "phone";
}) {
  const heading = (
    <>
      <h1 className="truncate font-display text-[24px] leading-[30px] font-bold tracking-[-0.026em] md:text-title md:tracking-[-0.028em]">{title}</h1>
      {soft && <span className="tabular truncate text-body font-medium whitespace-nowrap text-ink-3 md:text-headline md:font-medium">{soft}</span>}
    </>
  );
  return (
    <div className="relative z-20 bg-surface md:sticky md:top-0">
      <div className="flex min-h-16 items-center justify-between gap-3 border-b border-line px-4 py-2.5 md:min-h-[84px] md:px-3 md:pt-[22px] md:pb-[18px]">
        {onTitle && titleButton === "phone" && <div className="flex min-w-0 items-baseline gap-2.5 max-md:hidden">{heading}</div>}
        {onTitle ? (
          <button
            type="button"
            onClick={onTitle}
            aria-haspopup="dialog"
            aria-expanded={titleOpen}
            className={`tap relative flex min-w-0 items-baseline gap-2 text-left md:gap-2.5 ${titleButton === "phone" ? "md:hidden" : ""}`}
          >
            {heading}
            <span
              aria-hidden="true"
              className={`flex size-[22px] flex-none items-center justify-center self-center rounded-[6px] transition-colors duration-(--duration-fast) ${
                titleOpen ? "bg-primary text-on-primary" : "bg-surface-2 text-ink-2 shadow-ring-line"
              }`}
            >
              <ChevronDown size={12} strokeWidth={2} className={`transition-transform duration-(--duration-fast) ${titleOpen ? "rotate-180" : ""}`} />
            </span>
          </button>
        ) : (
          <div className="flex min-w-0 items-baseline gap-2 md:gap-2.5">{heading}</div>
        )}
        {right && <div className="flex flex-none items-center gap-2">{right}</div>}
      </div>
      {below}
    </div>
  );
}

/**
 * ‹ ›: one framed group, so the arrows have a home. Away from today (this week, this month) the way back sits between
 * them.
 */
export function Stepper({
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
  todayLabel,
  onToday,
  nextDisabled = false,
}: {
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
  /** Shown only while away from the present ("Today", "This week"). */
  todayLabel?: string | null;
  onToday?: () => void;
  nextDisabled?: boolean;
}) {
  const cell =
    "tap relative flex h-8 items-center justify-center text-ink-2 transition-colors duration-(--duration-fast) hover:bg-surface-3 hover:text-ink active:bg-line disabled:pointer-events-none disabled:text-ink-4";
  return (
    <div role="group" className="flex h-8 flex-none items-center rounded-sm bg-surface shadow-[inset_0_0_0_1px_var(--line-2)]">
      <button type="button" aria-label={prevLabel} data-tip={prevLabel} onClick={onPrev} className={`${cell} w-8 rounded-l-sm`}>
        <ChevronLeft size={15} strokeWidth={1.8} />
      </button>
      {todayLabel && onToday && (
        <button type="button" onClick={onToday} className={`${cell} border-l border-line-2 px-2.5 text-footnote font-medium whitespace-nowrap text-ink!`}>
          {todayLabel}
        </button>
      )}
      <button
        type="button"
        aria-label={nextLabel}
        data-tip={nextLabel}
        onClick={onNext}
        disabled={nextDisabled}
        className={`${cell} w-8 rounded-r-sm border-l border-line-2`}
      >
        <ChevronRight size={15} strokeWidth={1.8} />
      </button>
    </div>
  );
}

/** Speak your tasks, on computers: in the top bar, always in the same place, with the sphere as its sign. */
export function SpeakButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Speak your tasks"
      data-tip="Speak your tasks (V)"
      className="tap relative flex h-8 flex-none items-center gap-2 rounded-sm bg-primary pr-1.5 pl-2 text-footnote font-semibold text-on-primary transition-[background-color,transform] duration-(--duration-fast) hover:bg-primary-hover active:scale-[0.98]"
    >
      <Orb size={20} />
      Speak
      <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-on-primary/18 px-1.5 font-sans text-caption-2 font-medium text-on-primary/80">V</kbd>
    </button>
  );
}

/** Speak your tasks, on phones: floating over the list, where the thumb is. */
export function SpeakFloat({ onClick }: { onClick: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[calc(env(safe-area-inset-bottom)+20px)] md:hidden">
      <button
        type="button"
        onClick={onClick}
        aria-label="Speak your tasks"
        className="pointer-events-auto flex h-[52px] items-center gap-2.5 rounded-card bg-primary pr-6 pl-[18px] text-[16px] leading-[22px] font-semibold tracking-[-0.006em] text-on-primary shadow-float transition-transform duration-(--duration-fast) active:scale-[0.97]"
      >
        <Orb size={26} />
        Speak
      </button>
    </div>
  );
}
