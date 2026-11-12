"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { signOutAction } from "@/app/actions";
import { addDays, formatLong, monthGrid, MONTHS, weekdayNames, ymd } from "@/lib/dates";
import type { AppUser, ProInterest, Task, Usage } from "@/lib/types";
import { Avatar } from "./Avatar";
import { Mark, Wordmark } from "./Brand";
import { useDrag } from "./drag";
import { ChartIcon, ChevronDown, ChevronLeft, ChevronRight, EllipsisIcon, HomeIcon, KeyboardIcon, SidebarIcon, SignOutIcon, SlidersIcon } from "./icons";
import { SyncStatus, type Sync } from "./SyncStatus";
import { Burst, IconButton, Popover, ProgressRing } from "./ui";
import { Orb } from "./voice/Orb";

export type View = "day" | "week" | "month" | "analytics";

/**
 * Computers: the sidebar, on the left for the whole height, and it can be hidden. The name on top, the two pages (Home:
 * the day, the week, the month; Progress), and the account at the foot.
 */
export function Sidebar({
  user,
  sync,
  view,
  onHome,
  onProgress,
  onHide,
  onAccount,
  accountOpen,
}: {
  user: AppUser;
  sync: Sync;
  view: View;
  onHome: () => void;
  onProgress: () => void;
  onHide: () => void;
  onAccount: (button: HTMLElement) => void;
  accountOpen: boolean;
}) {
  return (
    <aside aria-label="Sidebar" className="hidden w-[248px] flex-none flex-col border-r border-line bg-canvas md:flex">
      <div className="flex h-14 flex-none items-center justify-between border-b border-line pr-3 pl-5">
        <Wordmark size={19} />
        <IconButton label="Hide sidebar" tip="Hide sidebar ([)" size="sm" onClick={onHide} className="text-ink-3 hover:bg-line!">
          <SidebarIcon size={16} />
        </IconButton>
      </div>
      <nav aria-label="Pages" className="flex flex-none flex-col gap-0.5 px-2.5 py-3">
        <SideRow icon={<HomeIcon size={16} />} label="Home" on={view !== "analytics"} onClick={onHome} />
        <SideRow icon={<ChartIcon size={16} />} label="Progress" on={view === "analytics"} onClick={onProgress} />
      </nav>
      <div className="flex-1" />
      <SyncStatus sync={sync} className="px-5 pb-2 empty:hidden" />
      <div className="flex-none p-2.5">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={accountOpen}
          aria-label={`${user.name}: account`}
          onClick={(e) => onAccount(e.currentTarget)}
          className={`group flex h-12 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left transition-[background-color,box-shadow] duration-(--duration-fast) ${
            accountOpen ? "bg-surface shadow-lift" : "hover:bg-line"
          }`}
        >
          <Avatar name={user.name} image={user.image} size={32} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-footnote font-semibold">{user.name}</span>
            <span className="block truncate text-caption text-ink-3">{user.email}</span>
          </span>
          <EllipsisIcon size={16} className={`flex-none transition-colors duration-(--duration-fast) ${accountOpen ? "text-ink" : "text-ink-3 group-hover:text-ink"}`} />
        </button>
      </div>
    </aside>
  );
}

function SideRow({ icon, label, on = false, onClick }: { icon: React.ReactNode; label: string; on?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={on ? "page" : undefined}
      className={`flex h-9 w-full items-center gap-2.5 rounded-sm px-2.5 text-footnote text-ink transition-[background-color,box-shadow] duration-(--duration-fast) ${
        on ? "bg-surface font-semibold shadow-lift" : "font-medium hover:bg-line"
      }`}
    >
      <span className={on ? "text-ink" : "text-ink-2"}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}

/**
 * The month to pick a day from (it opens from the title in the bar; phones also see it in Month): plain numbers, no
 * dots. Today is the black tile, the chosen day has an outline; days with something still to do are dark, the rest
 * quiet.
 */
export function MiniMonth({
  year,
  month,
  selected,
  todayKey,
  byDate,
  onShift,
  onSelect,
  large = false,
}: {
  year: number;
  month: number;
  selected: string;
  todayKey: string;
  byDate: (key: string) => Task[];
  onShift: (n: number) => void;
  onSelect: (key: string) => void;
  /** Phones: bigger days to tap. */
  large?: boolean;
}) {
  const { start, rows } = monthGrid(year, month);
  const drag = useDrag();
  const keys = Array.from({ length: rows * 7 }, (_, i) => ymd(addDays(start, i)));
  // One Tab stop for the whole month (the selected day, else today, else the 1st); arrows move between days.
  const [active, setActive] = useState<string | null>(null);
  const tabKey = [active, selected, todayKey, ymd(new Date(year, month, 1))].find((k) => k && keys.includes(k));
  const grid = useRef<HTMLDivElement>(null);
  const onGridKey = (e: React.KeyboardEvent) => {
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[e.key];
    const i = keys.indexOf((e.target as HTMLElement).dataset.dropDate ?? "");
    if (!step || i < 0) return;
    e.preventDefault();
    e.stopPropagation();
    const j = Math.min(keys.length - 1, Math.max(0, i + step));
    setActive(keys[j]);
    grid.current?.querySelectorAll<HTMLButtonElement>("button")[j]?.focus();
  };
  return (
    <div>
      <div className="flex h-8 items-center justify-between pl-2.5">
        <span className={`font-semibold ${large ? "text-body" : "text-footnote"}`}>
          {MONTHS[month]} <span className="font-normal text-ink-3">{year}</span>
        </span>
        <span className="flex h-8 items-center rounded-sm bg-surface shadow-[inset_0_0_0_1px_var(--line-2)]">
          <IconButton label="Previous month" onClick={() => onShift(-1)} className="rounded-r-none!">
            <ChevronLeft size={14} />
          </IconButton>
          <IconButton label="Next month" onClick={() => onShift(1)} className="rounded-l-none! border-l border-line-2">
            <ChevronRight size={14} />
          </IconButton>
        </span>
      </div>
      <div className="mt-1.5 grid grid-cols-7 text-center text-caption-2 font-medium tracking-[0.02em] text-ink-3">
        {weekdayNames("letter").map((d, i) => (
          <span key={i} className="flex h-6 items-center justify-center">
            {d}
          </span>
        ))}
      </div>
      <div ref={grid} className="grid grid-cols-7" onKeyDown={onGridKey}>
        {keys.map((key, i) => {
          const d = addDays(start, i);
          const sel = key === selected;
          const today = key === todayKey;
          const out = d.getMonth() !== month;
          const busy = byDate(key).some((t) => !t.done);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-label={formatLong(d)}
              aria-pressed={sel}
              tabIndex={key === tabKey ? 0 : -1}
              onFocus={() => setActive(key)}
              data-drop-date={key}
              data-drop-zone="calendar"
              className={`group relative flex items-center justify-center ${large ? "h-11" : "h-9"}`}
            >
              {/* Dragging a task over a day: the day lights up to take it. */}
              {drag.dragging && drag.target?.zone === "calendar" && drag.target.date === key && (
                <span aria-hidden="true" className="absolute inset-[1px] animate-pop-in rounded-sm bg-accent-soft shadow-ring-accent" />
              )}
              <span
                data-day-dot={key}
                className={`tabular relative flex items-center justify-center rounded-sm transition-colors duration-(--duration-fast) ${large ? "size-10 text-callout" : "size-8 text-footnote"} ${
                  today
                    ? "bg-primary font-semibold text-on-primary"
                    : sel
                      ? "bg-surface font-semibold text-ink shadow-[inset_0_0_0_1.5px_var(--ink)]"
                      : out
                        ? "text-ink-4 group-hover:bg-surface-3"
                        : busy
                          ? "font-medium text-ink group-hover:bg-surface-3"
                          : "text-ink-3 group-hover:bg-surface-3"
                }`}
              >
                {d.getDate()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** What the bar says about the page: the day ("Today"), the week, the month, or Progress, with its date beside it. */
export type Head = {
  title: string;
  /** The quiet part beside the title: the date in full ("Saturday, November 14"), a range, the year. */
  soft: string;
  /** The same for phones and narrow windows ("Sat, Nov 14"). */
  softShort?: string;
  /** Makes the title a button (Day and Week: it opens the month to pick a day from). */
  onTitle?: (button: HTMLElement) => void;
  titleOpen?: boolean;
  /** Day: how much of the day on screen is done. */
  count?: { done: number; total: number } | null;
};

/**
 * The one bar across the top of the work area. Computers: what's on screen and its date on the left (with how much of the
 * day is done), the switch in the middle (Day / Week / Month, or Progress's periods), and on the right the way back to
 * today, the arrows and Focus. Phones have two rows: the sign, the switch and the account; then the title and the same
 * controls.
 */
export function AppBar({
  user,
  sync,
  head,
  center,
  controls,
  sidebar,
  onShowSidebar,
  onAccount,
  accountOpen,
}: {
  user: AppUser;
  sync: Sync;
  head: Head;
  center: React.ReactNode;
  controls: React.ReactNode;
  /** Whether the sidebar is shown (computers). */
  sidebar: boolean;
  onShowSidebar: () => void;
  onAccount: (button: HTMLElement) => void;
  accountOpen: boolean;
}) {
  // Phones: the first row stays on top while the page scrolls, and draws its edge only once something is under it.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const allDone = !!head.count && head.count.total > 0 && head.count.done === head.count.total;
  const words = (
    <>
      <h1 className="flex-none font-display text-[19px] leading-7 font-bold tracking-[-0.02em] whitespace-nowrap md:text-headline md:font-semibold md:tracking-[-0.012em]">{head.title}</h1>
      <span className="tabular min-w-0 truncate text-body whitespace-nowrap text-ink-3">
        <span className={head.softShort ? "max-lg:hidden" : ""}>{head.soft}</span>
        {head.softShort && <span className="lg:hidden">{head.softShort}</span>}
      </span>
    </>
  );
  const title = (
    <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
      {head.onTitle ? (
        <button
          type="button"
          onClick={(e) => head.onTitle?.(e.currentTarget)}
          aria-haspopup="dialog"
          aria-expanded={!!head.titleOpen}
          data-tip="Pick a day"
          className={`tap relative -mx-2 flex h-9 min-w-0 items-baseline gap-2 rounded-sm px-2 pt-[5px] text-left transition-colors duration-(--duration-fast) md:pt-[7px] ${
            head.titleOpen ? "bg-surface-3" : "hover:bg-surface-3"
          }`}
        >
          {words}
          <ChevronDown size={12} className={`flex-none self-center text-ink-3 transition-transform duration-(--duration-fast) ${head.titleOpen ? "rotate-180" : ""}`} />
        </button>
      ) : (
        <div className="flex h-9 min-w-0 items-baseline gap-2 pt-[5px] md:pt-[7px]">{words}</div>
      )}
      {head.count && head.count.total > 0 && (
        <span
          aria-label={`${head.count.done} of ${head.count.total} done`}
          data-tip={allDone ? "All done" : `${head.count.done} of ${head.count.total} done`}
          className="flex flex-none items-center gap-1.5 text-caption text-ink-3"
        >
          <Burst active={allDone}>
            <ProgressRing value={head.count.done / head.count.total} size={14} stroke={1.75} />
          </Burst>
          <span aria-hidden="true" className="tabular max-sm:hidden">
            {head.count.done}/{head.count.total}
          </span>
        </span>
      )}
    </div>
  );

  return (
    <>
      {/* Computers: one row. */}
      <header className="hidden h-14 flex-none grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 border-b border-line bg-surface pr-4 pl-5 md:grid">
        <div className="flex min-w-0 items-center gap-3">
          {!sidebar && (
            <>
              <IconButton label="Show sidebar" tip="Show sidebar ([)" onClick={onShowSidebar} className="-ml-1 text-ink-3 shadow-[inset_0_0_0_1px_var(--line-2)]">
                <SidebarIcon size={16} />
              </IconButton>
              <Mark size={18} />
              <SyncStatus sync={sync} className="empty:hidden" />
            </>
          )}
          {title}
        </div>
        {center}
        <div className="flex min-w-0 items-center justify-end gap-2">{controls}</div>
      </header>

      {/* Phones: the sign, the switch and the account stay on top; the title and its controls follow. */}
      <header
        className={`sticky top-0 z-30 grid h-[52px] flex-none grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 bg-surface px-4 transition-shadow duration-(--duration-fast) md:hidden ${
          scrolled ? "shadow-[0_1px_0_var(--line)]" : ""
        }`}
      >
        <Mark size={18} />
        {center}
        <div className="flex min-w-0 items-center justify-end gap-2">
          <SyncStatus sync={sync} className="empty:hidden" />
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={accountOpen}
            aria-label={`${user.name}: account`}
            onClick={(e) => onAccount(e.currentTarget)}
            className={`relative flex-none rounded-full transition-shadow duration-(--duration-fast) before:absolute before:-inset-[6px] ${
              accountOpen ? "shadow-[0_0_0_2px_var(--surface),0_0_0_3.5px_var(--ink)]" : ""
            }`}
          >
            <Avatar name={user.name} image={user.image} size={32} />
          </button>
        </div>
      </header>
      <div className="flex h-12 flex-none items-center justify-between gap-3 border-b border-line px-4 md:hidden">
        {title}
        <div className="flex flex-none items-center gap-2">{controls}</div>
      </div>
    </>
  );
}

const count = new Intl.NumberFormat("en-US");

/**
 * The account's panel: who is signed in and on which plan; what speaking tasks has cost (tokens this month, today's
 * sortings against the day's allowance); Pro; Settings and the keyboard shortcuts; and signing out as the last line.
 * Phones, which have no sidebar, also find the two pages here.
 */
export function AccountPanel({
  user,
  anchor,
  phone,
  view,
  usage,
  proInterest,
  onHome,
  onProgress,
  onPro,
  onSettings,
  onShortcuts,
  onClose,
}: {
  user: AppUser;
  anchor: HTMLElement;
  phone: boolean;
  view: View;
  /** undefined: not offered here (no voice on this server); null: still loading. */
  usage: Usage | null | undefined;
  proInterest: ProInterest;
  onHome: () => void;
  onProgress: () => void;
  onPro: () => void;
  onSettings: () => void;
  onShortcuts: () => void;
  onClose: () => void;
}) {
  const [, startSignOut] = useTransition();
  const [rect] = useState(() => anchor.getBoundingClientRect());
  const go = (run: () => void) => () => {
    onClose();
    run();
  };
  return (
    <Popover anchor={rect} trigger={anchor} align={phone ? "end" : "start"} label="Account" onClose={onClose} className="w-[300px] max-w-[calc(100vw-16px)] p-1.5">
      <div className="flex items-center gap-3 px-2.5 pt-2 pb-2.5">
        <Avatar name={user.name} image={user.image} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-footnote font-semibold text-ink">{user.name}</div>
          <div className="truncate text-caption text-ink-3">{user.email}</div>
        </div>
        <span className="flex h-[22px] flex-none items-center rounded-[6px] px-[7px] text-caption-2 font-semibold text-ink-2 shadow-[inset_0_0_0_1px_var(--line-2)]">Free</span>
      </div>

      {usage !== undefined && (
        <>
          <Rule />
          <div className="px-2.5 pt-2 pb-2.5" aria-busy={usage === null}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-footnote font-medium text-ink">Usage</span>
              <span className="tabular text-footnote text-ink">
                {usage ? count.format(usage.month.tokens) : "–"} <span className="text-ink-3">tokens</span>
              </span>
            </div>
            <div
              role="img"
              aria-label={usage ? `${usage.today.requests} of ${usage.today.limit} voice sortings used today` : "Loading"}
              className="mt-2 h-[3px] overflow-hidden rounded-full bg-line-2"
            >
              <div
                className="h-full origin-left rounded-full bg-ink transition-transform duration-(--duration-data) ease-out"
                style={{ transform: `scaleX(${usage ? Math.min(1, usage.today.requests / usage.today.limit) : 0})` }}
              />
            </div>
            <div className="tabular mt-1.5 flex items-baseline justify-between gap-3 text-caption text-ink-3">
              <span>This month{usage ? ` · ${count.format(usage.month.requests)} ${usage.month.requests === 1 ? "sorting" : "sortings"}` : ""}</span>
              <span>{usage ? `${usage.today.requests} of ${usage.today.limit} today` : ""}</span>
            </div>
          </div>
        </>
      )}

      <Rule />
      <PanelRow icon={<Orb size={16} />} label={proInterest ? "Pro" : "Upgrade to Pro"} hint={proInterest ? "On the waitlist" : "From $4 a month"} onClick={go(onPro)} />
      {phone && (
        <>
          <PanelRow icon={<HomeIcon size={16} />} label="Home" current={view !== "analytics"} onClick={go(onHome)} />
          <PanelRow icon={<ChartIcon size={16} />} label="Progress" current={view === "analytics"} onClick={go(onProgress)} />
        </>
      )}
      <PanelRow icon={<SlidersIcon size={16} />} label="Settings" onClick={go(onSettings)} />
      {!phone && <PanelRow icon={<KeyboardIcon size={16} />} label="Keyboard shortcuts" onClick={go(onShortcuts)} />}
      <Rule />
      <PanelRow icon={<SignOutIcon size={16} />} label="Sign out" onClick={() => startSignOut(() => signOutAction())} />
    </Popover>
  );
}

const Rule = () => <div aria-hidden="true" className="-mx-1.5 my-1.5 h-px bg-line" />;

function PanelRow({ icon, label, hint, current = false, onClick }: { icon: React.ReactNode; label: string; hint?: string; current?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={current ? "page" : undefined}
      className="flex h-9 w-full items-center gap-2.5 rounded-sm px-2.5 text-left text-footnote font-medium text-ink transition-colors duration-(--duration-fast) hover:bg-surface-3 pointer-coarse:h-11"
    >
      <span className="flex size-4 flex-none items-center justify-center text-ink-2">{icon}</span>
      <span className="flex-1">{label}</span>
      {hint && <span className="text-caption font-normal text-ink-3">{hint}</span>}
      {current && <span aria-hidden="true" className="size-1.5 rounded-full bg-ink" />}
    </button>
  );
}
