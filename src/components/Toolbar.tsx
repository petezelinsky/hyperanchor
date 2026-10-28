"use client";

import { ChevronLeft, ChevronRight, PlusIcon, SearchIcon, XIcon } from "./icons";
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

export function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative hidden xl:block">
      <SearchIcon size={13} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onChange("")}
        placeholder="Filter"
        aria-label="Filter tasks"
        className="h-8 w-40 rounded-[9px] bg-surface-3 pr-7 pl-8 text-[13px] text-ink outline-none transition-[width,background-color,box-shadow] duration-200 ease-out focus:w-56 focus:bg-surface focus:shadow-[0_0_0_1px_var(--accent),0_0_0_4px_var(--accent-soft)] [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear filter"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-2 flex size-4 -translate-y-1/2 items-center justify-center rounded-full bg-ink-3 text-surface"
        >
          <XIcon size={9} strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}

export function NewTaskButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="primary" onClick={onClick} data-tip="New Task (N)" className="pl-2.5">
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
