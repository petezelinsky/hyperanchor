"use client";

import { ChevronLeft, ChevronRight, PlusIcon } from "./icons";
import { Button } from "./ui";

/**
 * Header of a view: title + subtitle on the left, controls on the right.
 * Sticky on desktop; once the sheet scrolls (main[data-scrolled]) it turns into frosted glass.
 */
export function Toolbar({
  title,
  subtitle,
  children,
  wide = false,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  /** Full width (calendar, analytics) instead of the reading column. */
  wide?: boolean;
}) {
  return (
    <div className="relative z-20 px-4 pt-5 pb-3 transition-[background-color,box-shadow] duration-200 md:sticky md:top-0 md:px-8 md:pt-6 md:pb-4 md:group-data-[scrolled=true]/sheet:glass md:group-data-[scrolled=true]/sheet:shadow-[0_1px_0_var(--line)]">
      {/* min width: on narrow screens the controls wrap below the title instead of squeezing it. */}
      <div className={`mx-auto flex flex-wrap items-center gap-x-4 gap-y-3 ${wide ? "" : "max-w-[1120px]"}`}>
        <div className="min-w-[220px] flex-1">
          <h1 className="truncate font-display text-[26px] leading-8 font-bold tracking-[-0.025em]">{title}</h1>
          {subtitle && <p className="tabular mt-0.5 flex items-center gap-1.5 truncate text-[13px] leading-[18px] text-ink-2">{subtitle}</p>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </div>
  );
}

/**
 * ‹ Today ›: quiet on purpose — plain chevrons and a text button, no frame — so it never competes with the view's
 * real actions (Focus, New Task). "Today" greys out while today is already on screen.
 */
export function NavGroup({
  onPrev,
  onNext,
  onToday,
  todayLabel = "Today",
  prevLabel,
  nextLabel,
  todayDisabled = false,
  nextDisabled = false,
}: {
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  todayLabel?: string;
  prevLabel: string;
  nextLabel: string;
  todayDisabled?: boolean;
  nextDisabled?: boolean;
}) {
  const ghost =
    "flex h-8 items-center justify-center rounded-[9px] text-ink-2 transition-colors duration-150 hover:bg-surface-3 hover:text-ink active:bg-line disabled:pointer-events-none disabled:text-ink-4";
  return (
    <div className="flex items-center">
      <button type="button" aria-label={prevLabel} data-tip={prevLabel} onClick={onPrev} className={`${ghost} w-8`}>
        <ChevronLeft size={15} strokeWidth={1.8} />
      </button>
      <button type="button" onClick={onToday} disabled={todayDisabled} className={`${ghost} px-2 text-[13px] font-medium whitespace-nowrap`}>
        {todayLabel}
      </button>
      <button type="button" aria-label={nextLabel} data-tip={nextLabel} onClick={onNext} disabled={nextDisabled} className={`${ghost} w-8`}>
        <ChevronRight size={15} strokeWidth={1.8} />
      </button>
    </div>
  );
}

export function NewTaskButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="primary" onClick={onClick} aria-label="New Task" data-tip="New Task (N)" className="pl-2.5">
      <PlusIcon size={14} strokeWidth={2.2} />
      <span className="max-sm:hidden">New Task</span>
    </Button>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex animate-rise flex-col items-center px-6 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-[18px] bg-accent-soft text-accent-ink">{icon}</div>
      <p className="mt-4 text-[16px] font-semibold tracking-[-0.01em] text-ink">{title}</p>
      {children && <p className="mt-1.5 max-w-xs text-[13.5px] leading-relaxed text-ink-2">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
