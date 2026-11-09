"use client";

import { ChevronLeft, ChevronRight, PlusIcon, SearchIcon } from "./icons";
import { Button, Kbd } from "./ui";

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

/** ‹ Today › as one bordered group. */
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
  const seg = "flex h-8 items-center justify-center text-ink transition-colors duration-150 hover:bg-surface-2 active:bg-surface-3 disabled:pointer-events-none disabled:text-ink-4";
  return (
    <div className="flex overflow-hidden rounded-[9px] bg-surface shadow-lift">
      <button type="button" aria-label={prevLabel} data-tip={prevLabel} onClick={onPrev} className={`${seg} w-8`}>
        <ChevronLeft size={14} strokeWidth={2} />
      </button>
      <button type="button" onClick={onToday} disabled={todayDisabled} className={`${seg} border-x border-line px-3 text-[13px] font-medium whitespace-nowrap`}>
        {todayLabel}
      </button>
      <button type="button" aria-label={nextLabel} data-tip={nextLabel} onClick={onNext} disabled={nextDisabled} className={`${seg} w-8`}>
        <ChevronRight size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

/** ⌘K on Apple devices, Ctrl K elsewhere. */
export const searchKeys = () => (typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K");

/**
 * Opens search across all tasks. On wide screens it looks like a field, so it reads as "type here"; on tablets and
 * small laptops it's a round icon, leaving the title its room. Phones have it in the top bar.
 */
export function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Search"
      data-tip="Search all tasks (/)"
      className="hidden size-8 flex-none items-center justify-center gap-2 rounded-[9px] bg-surface-3 text-[13px] text-ink-3 transition-colors duration-150 hover:bg-line hover:text-ink-2 md:flex xl:w-44 xl:justify-start xl:pr-1.5 xl:pl-2.5"
    >
      <SearchIcon size={13} />
      <span className="hidden flex-1 text-left xl:inline">Search</span>
      <span className="hidden xl:inline">
        <Kbd>{searchKeys()}</Kbd>
      </span>
    </button>
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
