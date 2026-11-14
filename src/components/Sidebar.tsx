"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { signOutAction } from "@/app/actions";
import { addDays, formatLong, monthGrid, MONTHS, weekdayNames, ymd } from "@/lib/dates";
import type { AppUser, Task, Usage } from "@/lib/types";
import { Avatar } from "./Avatar";
import { Wordmark } from "./Brand";
import { useDrag } from "./drag";
import { createPortal } from "react-dom";
import { AgentIcon, ChartIcon, ChevronLeft, ChevronRight, EllipsisVerticalIcon, GoalIcon, SearchIcon, SidebarIcon, SignOutIcon, SlidersIcon, TasksIcon, TimelineIcon, UsageIcon } from "./icons";
import { SOON, SoonCard, type Soon } from "./Soon";
import { SyncStatus, type Sync } from "./SyncStatus";
import { ReturnButton, Stepper } from "./Toolbar";
import { Burst, IconButton, Popover, ProgressRing } from "./ui";

export type View = "day" | "week" | "month" | "analytics";

/** The planner's own views (Tasks): the day, the week, the month. */
export const isPlanner = (v: View) => v === "day" || v === "week" || v === "month";

/** The pages of the app, as the sidebar (and the phone's account panel) lists them. */
export type Page = "tasks" | "analytics";
export const pageOf = (v: View): Page => (isPlanner(v) ? "tasks" : "analytics");

const PAGES: { page: Page; label: string; icon: React.ReactNode }[] = [
  { page: "tasks", label: "Tasks", icon: <TasksIcon size={16} /> },
  { page: "analytics", label: "Analytics", icon: <ChartIcon size={16} /> },
];
/** What isn't open yet: listed after a line, quiet, with no page behind it. */
const SOONS: { soon: Soon; icon: React.ReactNode }[] = [
  { soon: "timeline", icon: <TimelineIcon size={16} /> },
  { soon: "goals", icon: <GoalIcon size={16} /> },
  { soon: "agent", icon: <AgentIcon size={16} /> },
];

const WIDTH = { min: 216, max: 360, normal: 248 };
const WIDTH_KEY = "hyperanchor:sidebar-width";
const readWidth = () => {
  try {
    const w = Number(localStorage.getItem(WIDTH_KEY));
    return w >= WIDTH.min && w <= WIDTH.max ? w : WIDTH.normal;
  } catch {
    return WIDTH.normal;
  }
};
const clampWidth = (w: number) => Math.round(Math.min(WIDTH.max, Math.max(WIDTH.min, w)));

/**
 * Computers: the sidebar, on the left for the whole height. It can be hidden, and made wider or narrower by its right
 * edge (remembered on this device; a double click there sets it back). The name on top, the pages (Tasks: the day, the
 * week, the month; Analytics), then, after a line, what's coming (Timeline, Goals, Agent: not pages yet, only a word on
 * what they'll be), and the account at the foot.
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
  const [width, setWidth] = useState(readWidth);
  const aside = useRef<HTMLElement>(null);
  const keep = (w: number) => {
    setWidth(w);
    try {
      localStorage.setItem(WIDTH_KEY, String(w));
    } catch {}
  };
  // Dragging the edge moves it directly (no redraw of the app on every move); the width is kept when it's let go.
  const resize = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = aside.current;
    if (!el || e.button > 0) return;
    e.preventDefault();
    const handle = e.currentTarget;
    const x0 = e.clientX;
    const w0 = el.offsetWidth;
    handle.setPointerCapture(e.pointerId);
    const body = document.body.style;
    const { cursor, userSelect } = body;
    body.cursor = "col-resize";
    body.userSelect = "none";
    const move = (ev: PointerEvent) => {
      el.style.width = `${clampWidth(w0 + ev.clientX - x0)}px`;
    };
    const done = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", done);
      handle.removeEventListener("pointercancel", done);
      body.cursor = cursor;
      body.userSelect = userSelect;
      keep(clampWidth(el.offsetWidth));
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", done);
    handle.addEventListener("pointercancel", done);
  };
  return (
    <aside ref={aside} aria-label="Sidebar" style={{ width }} className="relative hidden flex-none flex-col border-r border-line bg-canvas md:flex">
      <div className="flex h-14 flex-none items-center justify-between border-b border-line pr-3 pl-5">
        <Wordmark size={18} />
        <IconButton label="Hide sidebar" tip="Hide sidebar ([)" size="sm" onClick={onHide} className="text-ink-3 hover:bg-line!">
          <SidebarIcon size={16} />
        </IconButton>
      </div>
      <nav aria-label="Pages" className="flex flex-none flex-col gap-0.5 px-2.5 py-3">
        {PAGES.map((p) => (
          <SideRow key={p.page} icon={p.icon} label={p.label} on={page === p.page} onClick={() => onPage(p.page)} />
        ))}
        {/* What's coming: set apart by a little air and one quiet word, not by a line and a tag on every row. */}
        <div className="px-2.5 pt-5 pb-1 text-caption-2 font-medium text-ink-3">Soon</div>
        {SOONS.map((s) => (
          <SoonRow key={s.soon} soon={s.soon} icon={s.icon} />
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
      {/* The edge: drag it to make the sidebar wider or narrower; the arrow keys work too, and a double click sets it back. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Sidebar width"
        aria-valuemin={WIDTH.min}
        aria-valuemax={WIDTH.max}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={resize}
        onDoubleClick={() => keep(WIDTH.normal)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          keep(clampWidth(width + (e.key === "ArrowRight" ? 16 : -16)));
        }}
        className="group/edge absolute inset-y-0 -right-[4px] z-10 w-[8px] cursor-col-resize touch-none outline-none"
      >
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors duration-(--duration-fast) group-hover/edge:bg-ink-4 group-focus-visible/edge:bg-ink-3 group-active/edge:bg-ink-3" />
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
 * Something that isn't open yet: a quiet row that goes nowhere. Resting the pointer on it (or reaching it with the
 * keyboard) shows, beside it, what it will be.
 */
function SoonRow({ soon, icon }: { soon: Soon; icon: React.ReactNode }) {
  const [card, setCard] = useState<DOMRect | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const id = `soon-${soon}`;
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = (el: HTMLElement, wait: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCard(el.getBoundingClientRect()), wait);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setCard(null);
  };
  return (
    <>
      <button
        type="button"
        aria-disabled="true"
        aria-describedby={card ? id : undefined}
        onPointerEnter={(e) => e.pointerType === "mouse" && show(e.currentTarget, 140)}
        onPointerLeave={hide}
        onFocus={(e) => show(e.currentTarget, 0)}
        onBlur={hide}
        onClick={(e) => (card ? hide() : show(e.currentTarget, 0))}
        className="flex h-9 w-full cursor-default items-center gap-2.5 rounded-sm px-2.5 text-footnote font-medium text-ink-3 outline-offset-[-2px]"
      >
        <span className="text-ink-4">{icon}</span>
        <span className="flex-1 text-left">{SOON[soon].title}</span>
      </button>
      {card &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            style={{ left: card.right + 12, top: Math.max(8, Math.min(window.innerHeight - 286, card.top + card.height / 2 - 120)) }}
            className="pointer-events-none fixed z-[110] w-[332px] animate-[soon-in_var(--duration-base)_var(--ease-out)_both] rounded-[16px] bg-elevated p-3 pb-4 shadow-float"
          >
            <SoonCard soon={soon} />
          </div>,
          document.body,
        )}
    </>
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

/** What the bar says about the page: the day ("Today"), the week, the month, or a page's name, with its date beside it. */
export type Head = {
  title: string;
  /** For a narrow bar, a name that says it all on its own ("Wed, Nov 11" for "Wednesday" and "November 11" beside it). */
  titleNarrow?: string;
  /** The quiet part beside the title: the date in full ("Wednesday, November 11"), a range, the year. */
  soft?: string;
  /** The same, shorter, for a bar without the room ("Wed, Nov 11"). */
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
 * The one bar across the top of the work area. On the left, what's on screen: the arrows, then its name and date (the
 * arrows come first, so they stay put however long the date is), and the way back to the present once away from it.
 * Then the switch (Day / Week / Month, or Analytics' periods) and what the page offers: how much of the day is done,
 * and Focus.
 *
 * It arranges itself by its own width, not the window's (the sidebar can be wide, narrow or hidden):
 * - wide: three parts, the switch in the very middle, the date in full;
 * - less: the same with the date short;
 * - less still: one row, the switch moved to the right beside Focus (the day's count sits before it, so the switch
 *   doesn't shift when the count comes and goes);
 * - narrow: two rows, the switch across the top.
 * A date that doesn't fit beside its name leaves whole rather than being cut short. Phones have two rows of their own:
 * the name of the app, the switch and the account; then the arrows, the date and the page's actions.
 */
export function AppBar({
  user,
  sync,
  head,
  nav,
  center,
  meter,
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
  /** How much of the day is done (Day). */
  meter?: React.ReactNode;
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

  // The name and the date share one baseline, on a line that holds only what fits: the date wraps out of sight whole
  // when there's no room for it. The button around them (when there is one) is a quiet tile.
  const words = (
    <span className="flex h-6 min-w-0 flex-wrap items-baseline gap-x-2 gap-y-3 overflow-hidden">
      <h1 className="flex-none font-display text-[17px] leading-6 font-semibold tracking-[-0.014em] whitespace-nowrap">
        {head.titleNarrow ? (
          <>
            <span className="@max-[640px]/appbar:hidden">{head.title}</span>
            <span className="@min-[640px]/appbar:hidden">{head.titleNarrow}</span>
          </>
        ) : (
          head.title
        )}
      </h1>
      {head.soft && (
        <span className={`tabular flex-none text-body whitespace-nowrap text-ink-3 ${head.titleNarrow ? "@max-[640px]/appbar:hidden" : ""}`}>
          <span className={head.softShort ? "@max-[1100px]/appbar:hidden" : ""}>{head.soft}</span>
          {head.softShort && <span className="@min-[1100px]/appbar:hidden">{head.softShort}</span>}
        </span>
      )}
    </span>
  );
  const title = head.onTitle ? (
    <button
      type="button"
      onClick={(e) => head.onTitle?.(e.currentTarget)}
      aria-haspopup="dialog"
      aria-expanded={!!head.titleOpen}
      data-tip="Pick a day"
      className={`tap relative flex h-8 min-w-0 items-center rounded-sm px-2 text-left transition-colors duration-(--duration-fast) ${
        head.titleOpen ? "bg-surface-3" : "hover:bg-surface-3"
      }`}
    >
      {words}
    </button>
  ) : (
    <div className="flex h-8 min-w-0 items-center px-2">{words}</div>
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
      {/* Computers. */}
      <header className="@container/appbar hidden flex-none border-b border-line bg-surface md:block">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 @min-[560px]/appbar:h-14 @min-[560px]/appbar:grid-cols-[minmax(0,1fr)_auto_auto] @min-[860px]/appbar:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] @min-[860px]/appbar:gap-x-4">
          <div className="flex h-12 min-w-0 items-center gap-2 @min-[560px]/appbar:h-auto">
            {!sidebar && (
              <IconButton label="Show sidebar" tip="Show sidebar ([)" onClick={onShowSidebar} className="-ml-1 flex-none text-ink-2">
                <SidebarIcon size={16} />
              </IconButton>
            )}
            {left}
            {meter && <span className="ml-auto hidden flex-none pl-1 @min-[560px]/appbar:flex @min-[860px]/appbar:hidden">{meter}</span>}
          </div>
          <div className="order-first col-span-2 flex justify-center pt-2.5 @max-[560px]/appbar:*:w-full @min-[560px]/appbar:order-none @min-[560px]/appbar:col-span-1 @min-[560px]/appbar:pt-0">
            {center}
          </div>
          <div className="flex min-w-0 items-center justify-end gap-3">
            {!sidebar && <SyncStatus sync={sync} className="empty:hidden" />}
            {meter && <span className="flex flex-none @min-[560px]/appbar:hidden @min-[860px]/appbar:flex">{meter}</span>}
            {actions}
          </div>
        </div>
      </header>

      {/* Phones: the app's name, the switch and the account stay on top; the arrows, the date and the actions follow. */}
      {/* When the three don't fit (a small phone, four periods, longer words), the name gives way, whole. */}
      <header
        className={`sticky top-0 z-30 flex h-[52px] flex-none items-center gap-3 bg-surface px-4 transition-shadow duration-(--duration-fast) max-[340px]:gap-2 md:hidden ${
          scrolled ? "shadow-[0_1px_0_var(--line)]" : ""
        }`}
      >
        <div className="flex h-full min-w-0 shrink-[1000] flex-wrap overflow-hidden">
          <span aria-hidden="true" className="h-full w-px flex-none" />
          <span className="flex h-full flex-none items-center">
            <Wordmark size={17} />
          </span>
        </div>
        {/* The switch takes the room there is, up to its full size; pressed for room, it tightens before the name goes. */}
        <div className="flex min-w-0 flex-auto justify-end">{center}</div>
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
      </header>
      <div className="@container/appbar flex-none border-b border-line md:hidden">
        <div className="flex h-12 items-center justify-between gap-3 px-4">
          <div className="min-w-0">{left}</div>
          <div className="flex flex-none items-center gap-2.5">
            <SyncStatus sync={sync} className="empty:hidden" />
            {meter && <span className="flex flex-none @max-[340px]/appbar:hidden">{meter}</span>}
            {actions}
          </div>
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
 * summary); Settings (the keyboard shortcuts are in there); and signing out as the last line. Phones, which have no
 * sidebar (nor a keyboard for / and Ctrl K), also find the pages, what's coming, and Search here.
 */
export function AccountPanel({
  user,
  anchor,
  phone,
  view,
  usage,
  onPage,
  onSearch,
  onSettings,
  onUsage,
  onClose,
}: {
  user: AppUser;
  anchor: HTMLElement;
  phone: boolean;
  view: View;
  /** undefined: not offered here (no AI on this server); null: still loading. */
  usage: Usage | null | undefined;
  onPage: (p: Page) => void;
  onSearch: () => void;
  onSettings: () => void;
  /** Opens the Usage window. */
  onUsage: () => void;
  onClose: () => void;
}) {
  const [, startSignOut] = useTransition();
  const [soonOpen, setSoonOpen] = useState<Soon | null>(null);
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

      <Rule />
      {phone && (
        <>
          {PAGES.map((p) => (
            <PanelRow key={p.page} icon={p.icon} label={p.label} current={page === p.page} onClick={go(() => onPage(p.page))} />
          ))}
          <PanelRow icon={<SearchIcon size={16} />} label="Search" onClick={go(onSearch)} />
          <div className="px-2.5 pt-3 pb-1 text-caption-2 font-medium text-ink-3">Soon</div>
          {SOONS.map((s) => (
            <div key={s.soon}>
              <PanelRow icon={s.icon} label={SOON[s.soon].title} soon expanded={soonOpen === s.soon} onClick={() => setSoonOpen((o) => (o === s.soon ? null : s.soon))} />
              {soonOpen === s.soon && <SoonCard soon={s.soon} className="animate-rise px-2 pt-1.5 pb-3" />}
            </div>
          ))}
          <Rule />
        </>
      )}
      {usage !== undefined && (
        // What the AI has used, in a window of its own; the row itself says how much of today is left.
        <PanelRow
          icon={<UsageIcon size={16} />}
          label="Usage"
          note={usage ? `${count.format(usage.today.left)} left today` : undefined}
          onClick={go(onUsage)}
        />
      )}
      <PanelRow icon={<SlidersIcon size={16} />} label="Settings" onClick={go(onSettings)} />
      <Rule />
      <PanelRow icon={<SignOutIcon size={16} />} label="Sign out" onClick={() => startSignOut(() => signOutAction())} />
    </Popover>
  );
}

const Rule = () => <div aria-hidden="true" className="-mx-1.5 my-1.5 h-px bg-line" />;

function PanelRow({
  icon,
  label,
  note,
  soon = false,
  expanded,
  current = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  /** A quiet word at the end of the row. */
  note?: string;
  /** Not open yet: quiet, and it shows what it will be instead of going anywhere. */
  soon?: boolean;
  expanded?: boolean;
  current?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={current ? "page" : undefined}
      aria-expanded={soon ? expanded : undefined}
      className={`flex h-9 w-full items-center gap-2.5 rounded-sm px-2.5 text-left text-footnote font-medium transition-colors duration-(--duration-fast) pointer-coarse:h-11 ${
        soon ? "text-ink-3" : "text-ink hover:bg-surface-3"
      }`}
    >
      <span className={`flex size-4 flex-none items-center justify-center ${soon ? "text-ink-4" : "text-ink-2"}`}>{icon}</span>
      <span className="flex-1">{label}</span>
      {note && <span className="tabular text-caption font-normal text-ink-3">{note}</span>}
      {current && <span aria-hidden="true" className="size-1.5 rounded-full bg-ink" />}
    </button>
  );
}
