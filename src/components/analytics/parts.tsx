"use client";

/** The panels' own look: white sheets with a hairline edge on the page's grey (dark: a step up from the background). */
export const PANEL = "rounded-[14px] bg-surface shadow-[0_0_0_1px_var(--line)]";

/** A section of the page: a panel, its title (and a quiet aside) on top. */
export function Card({
  title,
  count,
  aside,
  className = "",
  children,
}: {
  title: string;
  /** Shown beside the title, quietly, like the count after "To do". */
  count?: number;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`min-w-0 p-5 md:p-6 ${PANEL} ${className}`}>
      <header className="mb-5 flex min-h-6 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="text-body font-semibold text-ink">
          {title}
          {!!count && <span className="tabular ml-1.5 font-normal text-ink-3">{count}</span>}
        </h2>
        {aside}
      </header>
      {children}
    </section>
  );
}
