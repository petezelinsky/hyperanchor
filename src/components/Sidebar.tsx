"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { signOutAction } from "@/app/actions";
import { addDays, formatLong, monthGrid, MONTHS, weekdayNames, ymd } from "@/lib/dates";
import type { AppUser, Task, Usage } from "@/lib/types";
import { Avatar } from "./Avatar";
import { Wordmark } from "./Brand";
import { useDrag } from "./drag";
import { AgentIcon, ChartIcon, ChevronLeft, ChevronRight, EllipsisVerticalIcon, GoalIcon, HomeIcon, KeyboardIcon, SidebarIcon, SignOutIcon, SlidersIcon, TimelineIcon } from "./icons";
import { SyncStatus, type Sync } from "./SyncStatus";
import { ReturnButton, Stepper } from "./Toolbar";
import { Burst, IconButton, Popover, ProgressRing } from "./ui";

export type View = "day" | "week" | "month" | "analytics" | "timeline" | "goals" | "agent";

/** The planner's own views (Home): the day, the week, the month. */
export const isPlanner = (v: View) => v === "day" || v === "week" || v === "month";

/** The pages of the app, as the sidebar (and the phone's account panel) lists them. */
export type Page = "home" | "analytics" | "timeline" | "goals" | "agent";
export const pageOf = (v: View): Page => (isPlanner(v) ? "home" : (v as Page));

const PAGES: { page: Page; label: string; icon: React.ReactNode; soon?: boolean }[] = [
  { page: "home", label: "Home", icon: <HomeIcon size={16} /> },
  { page: "analytics", label: "Progress", icon: <ChartIcon size={16} /> },
  { page: "timeline", label: "Timeline", icon: <TimelineIcon size={16} />, soon: true },
  { page: "goals", label: "Goals", icon: <GoalIcon size={16} />, soon: true },
  { page: "agent", label: "Agent", icon: <AgentIcon size={16} />, soon: true },
];

/**
 * Computers: the sidebar, on the left for the whole height, and it can be hidden. The name on top, the pages (Home: the
 * day, the week, the month; Progress; Timeline, Goals and Agent, coming), and the account at the foot.
 */
export function Sidebar({
  user,
  sync,
  view,
  onPage,
  onHide,
  onAccount,
  accountOpen,
}: {
  user: AppUser;
  sync: Sync;
  view: View;
  onPage: (p: Page) => void;
  onHide: () => void;
  onAccount: (button: HTMLElement) => void;
  accountOpen: boolean;
}) {
  const page = pageOf(view);
  return (
    <aside aria-label="Sidebar" className="hidden w-[248px] flex-none flex-col border-r border-line bg-canvas md:flex">
      <div className="flex h-14 flex-none items-center justify-between border-b border-line pr-3 pl-5">
        <Wordmark size={18} />
        <IconButton label="Hide sidebar" tip="Hide sidebar ([)" size="sm" onClick={onHide} className="text-ink-3 hover:bg-line!">
          <SidebarIcon size={16} />
        </IconButton>
      </div>
      <nav aria-label="Pages" className="flex flex-none flex-col gap-0.5 px-2.5 py-3">
        {PAGES.map((p) => (
          <SideRow key={p.page} icon={p.icon} label={p.label} soon={p.soon} on={page === p.page} onClick={() => onPage(p.page)} />
        ))}
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
          <EllipsisVerticalIcon size={16} className={`flex-none transition-colors duration-(--duration-fast) ${accountOpen ? "text-ink" : "text-ink-3 group-hover:text-ink"}`} />
        </button>
      </div>
    </aside>
  );
}

function SideRow({ icon, label, soon = false, on = false, onClick }: { icon: React.ReactNode; label: string; soon?: boolean; on?: boolean; onClick: () => void }) {
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
      {soon && <SoonTag />}
    </button>
  );
}

/** "Soon": a page that isn't open yet. */
export const SoonTag = () => (
  <span className="inline-flex h-[18px] flex-none items-center rounded-[5px] px-1.5 text-caption-2 font-medium text-ink-3 shadow-[inset_0_0_0_1px_var(--line-2)]">Soon</span>
);

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

/** What the bar says about the page: the day ("Today"), the week, the month, or a page's name, with its date beside it. */
export type Head = {
  title: string;
  /** The quiet part beside the title: the date in full ("Wednesday, November 11"), a range, the year. */
  soft?: string;
  /** The same for phones and narrow windows ("Wed, Nov 11"). */
  softShort?: string;
  /** Makes the title a button (Day and Week: it opens the month to pick a day from). */
  onTitle?: (button: HTMLElement) => void;
  titleOpen?: boolean;
};

/** The arrows to the day (week, month, period) before and after, and, away from the present, the way back to it. */
export type Nav = {
  prev: string;
  next: string;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  back?: { label: string; onClick: () => void };
};

/**
 * The one bar across the top of the work area, in three parts that never crowd each other. On the left, what's on
 * screen: the arrows, then its name and date (the arrows come first, so they stay put however long the date is, and a
 * day can be stepped through without chasing them), and the way back to the present once away from it. In the middle,
 * the switch (Day / Week / Month, or Progress's periods). On the right, what the page offers: how much of the day is
 * done, and Focus. With the sidebar hidden, the button to bring it back is the only thing before the arrows. Phones
 * have two rows: the name of the app, the switch and the account; then the arrows, the date and the page's actions.
 */
export function AppBar({
  user,
  sync,
  head,
  nav,
  center,
  actions,
  sidebar,
  onShowSidebar,
  onAccount,
  accountOpen,
}: {
  user: AppUser;
  sync: Sync;
  head: Head;
  nav?: Nav;
  center?: React.ReactNode;
  /** The page's own actions, at the right end. */
  actions?: React.ReactNode;
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

  // The name and the date share one baseline; the button around them (when there is one) is a quiet tile.
  const words = (
    <>
      <h1 className="flex-none font-display text-[17px] leading-6 font-semibold tracking-[-0.014em] whitespace-nowrap">{head.title}</h1>
      {head.soft && (
        <span className="tabular min-w-0 truncate text-body whitespace-nowrap text-ink-3">
          <span className={head.softShort ? "max-lg:hidden" : ""}>{head.soft}</span>
          {head.softShort && <span className="lg:hidden">{head.softShort}</span>}
        </span>
      )}
    </>
  );
  const title = head.onTitle ? (
    <button
      type="button"
      onClick={(e) => head.onTitle?.(e.currentTarget)}
      aria-haspopup="dialog"
      aria-expanded={!!head.titleOpen}
      data-tip="Pick a day"
      className={`tap relative flex h-8 min-w-0 items-baseline gap-2 rounded-sm px-2 pt-[5px] text-left transition-colors duration-(--duration-fast) ${
        head.titleOpen ? "bg-surface-3" : "hover:bg-surface-3"
      }`}
    >
      {words}
    </button>
  ) : (
    <div className="flex h-8 min-w-0 items-baseline gap-2 px-2 pt-[5px]">{words}</div>
  );
  const left = (
    <div className={`flex min-w-0 items-center gap-1 ${nav ? "" : "-ml-2"}`}>
      {nav && <Stepper prevLabel={nav.prev} nextLabel={nav.next} onPrev={nav.onPrev} onNext={nav.onNext} nextDisabled={nav.nextDisabled} />}
      {title}
      {nav?.back && <ReturnButton label={nav.back.label} onClick={nav.back.onClick} />}
    </div>
  );

  return (
    <>
      {/* Computers: one row, three parts. */}
      <header className="hidden h-14 flex-none grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 border-b border-line bg-surface px-4 md:grid">
        <div className="flex min-w-0 items-center gap-2">
          {!sidebar && (
            <IconButton label="Show sidebar" tip="Show sidebar ([)" onClick={onShowSidebar} className="-ml-1 flex-none text-ink-2">
              <SidebarIcon size={16} />
            </IconButton>
          )}
          {left}
        </div>
        <div className="flex justify-center">{center}</div>
        <div className="flex min-w-0 items-center justify-end gap-3">
          {!sidebar && <SyncStatus sync={sync} className="empty:hidden" />}
          {actions}
        </div>
      </header>

      {/* Phones: the app's name, the switch and the account stay on top; the arrows, the date and the actions follow. */}
      <header
        className={`sticky top-0 z-30 flex h-[52px] flex-none items-center gap-3 bg-surface px-4 transition-shadow duration-(--duration-fast) md:hidden ${
          scrolled ? "shadow-[0_1px_0_var(--line)]" : ""
        }`}
      >
        <Wordmark size={17} />
        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          {center}
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
            <Avatar name={user.name} image={user.image} size={30} />
          </button>
        </div>
      </header>
      <div className="flex h-12 flex-none items-center justify-between gap-3 border-b border-line px-4 md:hidden">
        <div className="min-w-0">{left}</div>
        <div className="flex flex-none items-center gap-2.5">
          <SyncStatus sync={sync} className="empty:hidden" />
          {actions}
        </div>
      </div>
    </>
  );
}

/** How much of the day on screen is done: a small ring and "2/7", quiet. A ring that fills throws a little confetti. */
export function DayCount({ done, total }: { done: number; total: number }) {
  if (!total) return null;
  const allDone = done === total;
  return (
    <span aria-label={`${done} of ${total} done`} data-tip={allDone ? "All done" : `${done} of ${total} done`} className="flex flex-none items-center gap-1.5 text-footnote text-ink-3">
      <Burst active={allDone}>
        <ProgressRing value={done / total} size={14} stroke={1.75} />
      </Burst>
      <span aria-hidden="true" className="tabular">
        {done}/{total}
      </span>
    </span>
  );
}

const count = new Intl.NumberFormat("en-US");

/**
 * The account's panel: who is signed in; how many tokens of the day's allowance are left for the AI (speaking tasks, the
 * summary); Settings and the keyboard shortcuts; and signing out as the last line. Phones, which have no sidebar, also
 * find the pages here.
 */
export function AccountPanel({
  user,
  anchor,
  phone,
  view,
  usage,
  onPage,
  onSettings,
  onShortcuts,
  onClose,
}: {
  user: AppUser;
  anchor: HTMLElement;
  phone: boolean;
  view: View;
  /** undefined: not offered here (no AI on this server); null: still loading. */
  usage: Usage | null | undefined;
  onPage: (p: Page) => void;
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
  const page = pageOf(view);
  return (
    <Popover anchor={rect} trigger={anchor} align={phone ? "end" : "start"} label="Account" onClose={onClose} className="w-[300px] max-w-[calc(100vw-16px)] p-1.5">
      <div className="flex items-center gap-3 px-2.5 pt-2 pb-2.5">
        <Avatar name={user.name} image={user.image} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-footnote font-semibold text-ink">{user.name}</div>
          <div className="truncate text-caption text-ink-3">{user.email}</div>
        </div>
      </div>

      {usage !== undefined && (
        <>
          <Rule />
          <div className="px-2.5 pt-2 pb-2.5" aria-busy={usage === null}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-footnote font-medium text-ink">Tokens left today</span>
              <span className="tabular text-footnote font-medium text-ink">{usage ? count.format(usage.today.left) : "–"}</span>
            </div>
            <div
              role="img"
              aria-label={usage ? `${count.format(usage.today.left)} of ${count.format(usage.today.limit)} tokens left today` : "Loading"}
              className="mt-2 h-[3px] overflow-hidden rounded-full bg-line-2"
            >
              <div
                className="h-full origin-left rounded-full bg-ink transition-transform duration-(--duration-data) ease-out"
                style={{ transform: `scaleX(${usage ? Math.max(0, Math.min(1, usage.today.left / usage.today.limit)) : 0})` }}
              />
            </div>
          </div>
        </>
      )}

      <Rule />
      {phone &&
        PAGES.map((p) => <PanelRow key={p.page} icon={p.icon} label={p.label} soon={p.soon} current={page === p.page} onClick={go(() => onPage(p.page))} />)}
      <PanelRow icon={<SlidersIcon size={16} />} label="Settings" onClick={go(onSettings)} />
      {!phone && <PanelRow icon={<KeyboardIcon size={16} />} label="Keyboard shortcuts" onClick={go(onShortcuts)} />}
      <Rule />
      <PanelRow icon={<SignOutIcon size={16} />} label="Sign out" onClick={() => startSignOut(() => signOutAction())} />
    </Popover>
  );
}

const Rule = () => <div aria-hidden="true" className="-mx-1.5 my-1.5 h-px bg-line" />;

function PanelRow({ icon, label, soon = false, current = false, onClick }: { icon: React.ReactNode; label: string; soon?: boolean; current?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={current ? "page" : undefined}
      className="flex h-9 w-full items-center gap-2.5 rounded-sm px-2.5 text-left text-footnote font-medium text-ink transition-colors duration-(--duration-fast) hover:bg-surface-3 pointer-coarse:h-11"
    >
      <span className="flex size-4 flex-none items-center justify-center text-ink-2">{icon}</span>
      <span className="flex-1">{label}</span>
      {soon && <SoonTag />}
      {current && <span aria-hidden="true" className="size-1.5 rounded-full bg-ink" />}
    </button>
  );
}
