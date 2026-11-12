"use client";

import { useRef, useState, useTransition } from "react";
import { signOutAction } from "@/app/actions";
import { addDays, formatLong, monthGrid, MONTHS, weekdayNames, ymd } from "@/lib/dates";
import type { AppUser, Task } from "@/lib/types";
import { Avatar } from "./Avatar";
import { Mark, Wordmark } from "./Brand";
import { useDrag } from "./drag";
import { ChartIcon, ChevronLeft, ChevronRight, KeyboardIcon, SearchIcon, SelectorIcon, SidebarIcon, SignOutIcon, SlidersIcon } from "./icons";
import { SyncStatus, type Sync } from "./SyncStatus";
import { SpeakButton } from "./Toolbar";
import { Burst, IconButton, Kbd, Menu, ProgressRing, SegmentedControl } from "./ui";

export type View = "day" | "week" | "month" | "analytics";

/** What's done of today's tasks: the sidebar's Progress line and the phone's account menu show it. */
export type TodayCount = { done: number; total: number };

/**
 * Computers: the sidebar, on the left for the whole height, and it can be hidden. Its head holds the name; then Search
 * and Progress (with how much of today is done); the month to pick a day from; and the account at the foot.
 */
export function Sidebar({
  user,
  sync,
  progress,
  today,
  onSearch,
  onProgress,
  onHide,
  onAccount,
  accountOpen,
  mini,
}: {
  user: AppUser;
  sync: Sync;
  /** Whether Progress is the view on screen. */
  progress: boolean;
  today: TodayCount;
  onSearch: () => void;
  onProgress: () => void;
  onHide: () => void;
  onAccount: (button: HTMLElement) => void;
  accountOpen: boolean;
  mini: React.ReactNode;
}) {
  const allDone = today.total > 0 && today.done === today.total;
  return (
    <aside aria-label="Sidebar" className="hidden w-[248px] flex-none flex-col border-r border-line bg-canvas md:flex">
      <div className="flex h-14 flex-none items-center justify-between border-b border-line pr-3 pl-5">
        <Wordmark size={19} />
        <IconButton label="Hide sidebar" tip="Hide sidebar ([)" size="sm" onClick={onHide} className="text-ink-3 hover:bg-line!">
          <SidebarIcon size={16} />
        </IconButton>
      </div>
      <nav aria-label="Tools" className="flex flex-none flex-col gap-0.5 border-b border-line px-2.5 py-3">
        <SideRow icon={<SearchIcon size={16} />} label="Search" onClick={onSearch} right={<Kbd>/</Kbd>} />
        <SideRow
          icon={<ChartIcon size={16} />}
          label="Progress"
          on={progress}
          onClick={onProgress}
          right={
            today.total > 0 && (
              <span aria-label={`Today: ${today.done} of ${today.total} done`} className="flex items-center gap-1.5 text-caption font-normal text-ink-3">
                <Burst active={allDone}>
                  <ProgressRing value={today.done / today.total} size={14} stroke={2.2} />
                </Burst>
                <span aria-hidden="true" className="tabular">
                  {today.done}/{today.total}
                </span>
              </span>
            )
          }
        />
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pt-3 pb-3">{mini}</div>
      <SyncStatus sync={sync} className="px-5 pb-2 empty:hidden" />
      <div className="flex h-16 flex-none items-center border-t border-line px-2.5">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={accountOpen}
          aria-label={`${user.name}: account`}
          onClick={(e) => onAccount(e.currentTarget)}
          className={`flex h-12 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left transition-[background-color,box-shadow] duration-(--duration-fast) ${
            accountOpen ? "bg-surface shadow-lift" : "hover:bg-line"
          }`}
        >
          <Avatar name={user.name} image={user.image} size={32} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-footnote font-semibold">{user.name}</span>
            <span className="block truncate text-caption text-ink-3">{user.email}</span>
          </span>
          <SelectorIcon size={16} className="flex-none text-ink-3" />
        </button>
      </div>
    </aside>
  );
}

function SideRow({ icon, label, on = false, onClick, right }: { icon: React.ReactNode; label: string; on?: boolean; onClick: () => void; right?: React.ReactNode }) {
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
      {right}
    </button>
  );
}

/**
 * The month to pick a day from: plain numbers, no dots. Today is the black tile, the chosen day has an outline; days with
 * something still to do are dark, the rest quiet. A task dragged over a day lands there.
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
  /** Phones: bigger days to tap (the calendar that opens from Day's title, and Month). */
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
          <IconButton label="Previous month" onClick={() => onShift(-1)} className="rounded-r-none! text-ink-2">
            <ChevronLeft size={14} strokeWidth={1.8} />
          </IconButton>
          <IconButton label="Next month" onClick={() => onShift(1)} className="rounded-l-none! border-l border-line-2 text-ink-2">
            <ChevronRight size={14} strokeWidth={1.8} />
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
              className={`group relative flex items-center justify-center ${large ? "h-11" : "h-8"}`}
            >
              {/* Dragging a task over a day: the day lights up to take it. */}
              {drag.dragging && drag.target?.zone === "calendar" && drag.target.date === key && (
                <span aria-hidden="true" className="absolute inset-[1px] animate-pop-in rounded-sm bg-accent-soft shadow-ring-accent" />
              )}
              <span
                data-day-dot={key}
                className={`tabular relative flex items-center justify-center rounded-sm transition-colors duration-(--duration-fast) ${large ? "size-10 text-callout" : "size-7 text-[12.5px]"} ${
                  today
                    ? "bg-primary font-semibold text-on-primary"
                    : sel
                      ? "bg-surface font-semibold text-ink shadow-[inset_0_0_0_1.5px_var(--ink)]"
                      : out
                        ? "text-ink-4 group-hover:bg-line"
                        : busy
                          ? "font-medium text-ink group-hover:bg-line"
                          : "text-ink-3 group-hover:bg-line"
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

/**
 * The bar across the top of the work area. Computers: the view switch in the middle and Speak at the right end (with
 * the sidebar hidden, the way to show it and the sign on the left). Phones: the sign, the switch and the account.
 */
export function AppBar({
  user,
  sync,
  view,
  onView,
  sidebar,
  onShowSidebar,
  onSpeak,
  onAccount,
  accountOpen,
}: {
  user: AppUser;
  sync: Sync;
  view: View;
  onView: (v: View) => void;
  /** Whether the sidebar is shown (computers). */
  sidebar: boolean;
  onShowSidebar: () => void;
  onSpeak?: () => void;
  onAccount: (button: HTMLElement) => void;
  accountOpen: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 grid h-[52px] flex-none grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-line bg-surface px-4 md:static md:h-14">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="md:hidden">
          <Mark size={18} />
        </span>
        {!sidebar && (
          <span className="flex items-center gap-3 max-md:hidden">
            <IconButton label="Show sidebar" tip="Show sidebar ([)" onClick={onShowSidebar} className="text-ink-3 shadow-[inset_0_0_0_1px_var(--line-2)]">
              <SidebarIcon size={16} />
            </IconButton>
            <Mark size={18} />
            <SyncStatus sync={sync} className="empty:hidden" />
          </span>
        )}
      </div>
      <SegmentedControl
        label="View"
        value={view === "analytics" ? null : view}
        onChange={onView}
        options={[
          { value: "day", label: "Day", tip: "Day (D)" },
          { value: "week", label: "Week", tip: "Week (W)" },
          { value: "month", label: "Month", tip: "Month (M)" },
        ]}
      />
      <div className="flex min-w-0 items-center justify-end gap-2">
        <SyncStatus sync={sync} className="empty:hidden md:hidden" />
        {onSpeak && (
          <span className="max-md:hidden">
            <SpeakButton onClick={onSpeak} />
          </span>
        )}
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={accountOpen}
          aria-label={`${user.name}: account`}
          onClick={(e) => onAccount(e.currentTarget)}
          className={`relative flex-none rounded-full transition-shadow duration-(--duration-fast) before:absolute before:-inset-[6px] md:hidden ${
            accountOpen ? "shadow-[0_0_0_2px_var(--surface),0_0_0_3.5px_var(--ink)]" : ""
          }`}
        >
          <Avatar name={user.name} image={user.image} size={32} />
        </button>
      </div>
    </header>
  );
}

/**
 * The account's short menu: who is signed in, then Settings (on phones also Progress and Search, which computers keep in
 * the sidebar), and signing out as the last line. Deleting the account lives in Settings, one level down.
 */
export function AccountMenu({
  user,
  anchor,
  phone,
  today,
  onProgress,
  onSearch,
  onSettings,
  onShortcuts,
  onClose,
}: {
  user: AppUser;
  anchor: HTMLElement;
  phone: boolean;
  today: TodayCount;
  onProgress: () => void;
  onSearch: () => void;
  onSettings: () => void;
  onShortcuts: () => void;
  onClose: () => void;
}) {
  const [, startSignOut] = useTransition();
  const [rect] = useState(() => anchor.getBoundingClientRect());
  return (
    <Menu
      anchor={rect}
      trigger={anchor}
      align={phone ? "end" : "start"}
      label="Account"
      className="w-[288px]"
      header={
        <div className="flex items-center gap-3 px-2.5 pt-2 pb-2.5">
          <Avatar name={user.name} image={user.image} size={36} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-footnote font-semibold text-ink">{user.name}</div>
            <div className="truncate text-caption text-ink-3">{user.email}</div>
          </div>
        </div>
      }
      onClose={onClose}
      entries={[
        { separator: true },
        ...(phone
          ? [
              {
                label: "Progress",
                icon: <ChartIcon size={16} />,
                shortcut: today.total ? `${today.done}/${today.total} today` : undefined,
                onSelect: onProgress,
              },
              { label: "Search", icon: <SearchIcon size={16} />, onSelect: onSearch },
            ]
          : []),
        { label: "Settings", icon: <SlidersIcon size={16} />, shortcut: ",", onSelect: onSettings },
        ...(phone ? [] : [{ label: "Keyboard shortcuts", icon: <KeyboardIcon size={16} />, shortcut: "?", onSelect: onShortcuts }]),
        { separator: true },
        { label: "Sign out", icon: <SignOutIcon size={16} />, onSelect: () => startSignOut(() => signOutAction()) },
      ]}
    />
  );
}
