"use client";

import { ChevronLeft, ChevronRight, PlusIcon, SearchIcon, XIcon } from "./icons";
import { Button } from "./ui";

/** Header of a view: large title + subtitle on the left, controls on the right. Sticky on desktop. */
export function Toolbar({ title, subtitle, children }: { title: React.ReactNode; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="material z-20 flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-separator bg-toolbar px-4 py-3 md:sticky md:top-0 md:px-7">
      {/* min width: on narrow screens the controls wrap below the title instead of squeezing it. */}
      <div className="min-w-[200px] flex-1">
        <h1 className="truncate font-display text-[22px] leading-7 font-bold tracking-[-0.022em]">{title}</h1>
        {subtitle && <p className="tabular truncate text-[12.5px] leading-[18px] text-label-2">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** macOS-style ‹ Today › control group. */
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
  const seg = "flex h-7 items-center justify-center text-label transition-colors hover:bg-fill-3 active:bg-fill-2 disabled:pointer-events-none disabled:text-label-3";
  return (
    <div className="flex overflow-hidden rounded-[7px] bg-control shadow-control">
      <button type="button" aria-label={prevLabel} title={prevLabel} onClick={onPrev} className={`${seg} w-8`}>
        <ChevronLeft size={14} strokeWidth={2} />
      </button>
      <button
        type="button"
        onClick={onToday}
        disabled={todayDisabled}
        className={`${seg} border-x border-separator px-3 text-[13px] font-medium whitespace-nowrap`}
      >
        {todayLabel}
      </button>
      <button type="button" aria-label={nextLabel} title={nextLabel} onClick={onNext} disabled={nextDisabled} className={`${seg} w-8`}>
        <ChevronRight size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

export function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative hidden lg:block">
      <SearchIcon size={13} className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-label-3" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onChange("")}
        placeholder="Filter"
        aria-label="Filter tasks"
        className="h-7 w-44 rounded-[7px] bg-fill-2 pr-7 pl-7 text-[13px] text-label outline-none transition-[width,background-color] duration-200 focus:w-56 focus:bg-fill [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear filter"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-1.5 flex size-4 -translate-y-1/2 items-center justify-center rounded-full bg-label-3 text-window"
        >
          <XIcon size={9} strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}

export function NewTaskButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="primary" onClick={onClick} title="New Task (N)" className="pl-2.5">
      <PlusIcon size={14} strokeWidth={2} />
      <span className="max-sm:hidden">New Task</span>
    </Button>
  );
}

export function EmptyState({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-fill-2 text-label-3">{icon}</div>
      <p className="mt-3 text-[15px] font-semibold text-label">{title}</p>
      {children && <p className="mt-1 max-w-xs text-[13px] text-label-2">{children}</p>}
    </div>
  );
}
