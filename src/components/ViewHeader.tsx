"use client";

import { ChevronLeft, ChevronRight, CircleDotIcon, PlusIcon, SearchIcon, XIcon } from "./icons";
import { Button, IconButton } from "./ui";

/** Centered content column shared by all views. */
export function Page({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`mx-auto w-full max-w-[1040px] px-5 md:px-10 ${className}`}>{children}</div>;
}

/** A view's header: mono label + controls, then a two-tone statement as the title. */
export function ViewHeader({
  label,
  title,
  rest,
  animKey,
  children,
}: {
  label: React.ReactNode;
  title: React.ReactNode;
  rest?: React.ReactNode;
  /** Changing it replays the entrance animation (e.g. when the day changes). */
  animKey?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="pt-7 md:pt-11">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="mono-label">{label}</div>
        {children && <div className="flex flex-wrap items-center gap-1">{children}</div>}
      </div>
      <h1 key={animKey} className="mt-2 animate-up text-[25px] leading-[1.2] font-medium tracking-[-0.025em] text-balance md:text-[32px]">
        {title} {rest && <span className="text-faint">{rest}</span>}
      </h1>
    </header>
  );
}

/** ‹ › with a quiet "Today" that only appears away from the current period. */
export function NavControls({
  onPrev,
  onNext,
  onToday,
  todayLabel = "Today",
  prevLabel,
  nextLabel,
  showToday,
  nextDisabled = false,
}: {
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  todayLabel?: string;
  prevLabel: string;
  nextLabel: string;
  showToday: boolean;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex items-center">
      {showToday && (
        <Button variant="text" size="sm" onClick={onToday} className="animate-fade">
          {todayLabel}
        </Button>
      )}
      <IconButton label={prevLabel} onClick={onPrev}>
        <ChevronLeft />
      </IconButton>
      <IconButton label={nextLabel} onClick={onNext} disabled={nextDisabled}>
        <ChevronRight />
      </IconButton>
    </div>
  );
}

export function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative mr-1 hidden lg:block">
      <SearchIcon size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onChange("")}
        placeholder="Filter"
        aria-label="Filter tasks"
        className="h-9 w-36 rounded-full border border-transparent bg-fill pr-8 pl-8 text-[13px] text-ink transition-[width,background-color,border-color] duration-200 focus:w-56 focus:border-ink focus:bg-paper [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear filter"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-2.5 flex size-4 -translate-y-1/2 items-center justify-center rounded-full bg-faint text-paper"
        >
          <XIcon size={9} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}

export function NewTaskButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="primary" onClick={onClick} title="New task (N)" className="ml-1 pl-3.5">
      <PlusIcon size={15} strokeWidth={1.8} />
      <span className="max-sm:hidden">New task</span>
    </Button>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex animate-up flex-col items-center px-6 py-14 text-center">
      <div className="flex size-10 items-center justify-center rounded-full border border-edge text-faint">
        <CircleDotIcon />
      </div>
      <p className="mt-4 text-[15px] font-medium">{title}</p>
      {children && <p className="mt-1 max-w-xs text-[13.5px] text-muted">{children}</p>}
    </div>
  );
}
