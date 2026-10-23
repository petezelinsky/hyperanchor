"use client";

import { ChevronLeft, ChevronRight, PlusIcon, SearchIcon, XIcon } from "./icons";
import { Button } from "./ui";

/** Header of a view: large title + subtitle on the left, glass controls on the right. Sticky on desktop, content blurs beneath it. */
export function Toolbar({ title, subtitle, children }: { title: React.ReactNode; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="relative z-20 flex flex-wrap items-center gap-x-4 gap-y-3 px-4 pt-5 pb-3 md:sticky md:top-0 md:scroll-edge md:px-7 md:pt-6 md:pb-4">
      {/* min width: on narrow screens the controls wrap below the title instead of squeezing it. */}
      <div className="min-w-[200px] flex-1">
        <h1 className="truncate font-display text-[28px] leading-[34px] font-bold tracking-[-0.032em]">{title}</h1>
        {subtitle && <p className="tabular mt-0.5 truncate text-[13px] leading-[18px] text-label-2">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** ‹ Today › in one glass capsule. */
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
  const seg =
    "flex h-7 items-center justify-center rounded-full text-label transition-[background-color,color] duration-150 hover:bg-fill-2 active:bg-fill disabled:pointer-events-none disabled:text-label-3";
  return (
    <div className="control flex items-center rounded-full p-0.5">
      <button type="button" aria-label={prevLabel} title={prevLabel} onClick={onPrev} className={`${seg} w-7`}>
        <ChevronLeft size={14} strokeWidth={2} />
      </button>
      <button type="button" onClick={onToday} disabled={todayDisabled} className={`${seg} px-3 text-[13px] font-medium whitespace-nowrap`}>
        {todayLabel}
      </button>
      <button type="button" aria-label={nextLabel} title={nextLabel} onClick={onNext} disabled={nextDisabled} className={`${seg} w-7`}>
        <ChevronRight size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

export function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative hidden lg:block">
      <SearchIcon size={13} className="pointer-events-none absolute top-1/2 left-3 z-[1] -translate-y-1/2 text-label-3" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onChange("")}
        placeholder="Filter"
        aria-label="Filter tasks"
        className="control h-8 w-44 rounded-full pr-8 pl-8 text-[13px] text-label outline-none transition-[width,background-color,box-shadow] duration-300 ease-glass focus:w-60 focus:bg-control-hover focus:shadow-[var(--shadow-lens),0_0_0_4px_var(--fill-2)] [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear filter"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-2 flex size-4 -translate-y-1/2 items-center justify-center rounded-full bg-label-3 text-on-ink"
        >
          <XIcon size={9} strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}

export function NewTaskButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="primary" onClick={onClick} title="New Task (N)" className="pl-3">
      <PlusIcon size={14} strokeWidth={2.2} />
      <span className="max-sm:hidden">New Task</span>
    </Button>
  );
}

export function EmptyState({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex animate-rise flex-col items-center px-6 py-16 text-center">
      <div className="lens flex size-14 items-center justify-center rounded-full text-label-2">{icon}</div>
      <p className="mt-4 text-[16px] font-semibold tracking-[-0.01em] text-label">{title}</p>
      {children && <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-label-2">{children}</p>}
    </div>
  );
}
