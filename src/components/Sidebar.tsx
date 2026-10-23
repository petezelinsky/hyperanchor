"use client";

import { useRef, useState, useTransition } from "react";
import { signOutAction } from "@/app/actions";
import { addDays, formatLong, monthGrid, MONTHS, ymd } from "@/lib/dates";
import type { AppUser, Task } from "@/lib/types";
import { Brand } from "./AppIcon";
import { Avatar } from "./Avatar";
import { CalendarIcon, ChartIcon, ChevronLeft, ChevronRight, KeyboardIcon, SunIcon, WeekIcon } from "./icons";
import { DotTabs, IconButton, Kbd, Menu, type Anchor } from "./ui";

export type View = "day" | "week" | "month" | "analytics";

export const VIEWS: { value: View; label: string; key: string; icon: React.ReactNode }[] = [
  { value: "day", label: "Day", key: "D", icon: <SunIcon /> },
  { value: "week", label: "Week", key: "W", icon: <WeekIcon /> },
  { value: "month", label: "Month", key: "M", icon: <CalendarIcon /> },
  { value: "analytics", label: "Analytics", key: "A", icon: <ChartIcon /> },
];

export function Sidebar({
  user,
  view,
  onView,
  badges,
  mini,
  syncing,
  onShortcuts,
}: {
  user: AppUser;
  view: View;
  onView: (v: View) => void;
  badges: Partial<Record<View, number>>;
  mini: React.ReactNode;
  syncing: boolean;
  onShortcuts: () => void;
}) {
  const index = VIEWS.findIndex((v) => v.value === view);
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-line bg-paper px-3 pb-3 md:flex">
      <div className="flex h-[76px] flex-none items-center px-2.5">
        <Brand size={22} />
      </div>
      <nav aria-label="Views" className="relative flex flex-col gap-0.5">
        {/* One highlight that slides to the active row. */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-9 rounded-[10px] bg-fill-on transition-transform duration-300 ease-quiet"
          style={{ transform: `translateY(${index * 38}px)` }}
        />
        {VIEWS.map((v) => {
          const on = v.value === view;
          const badge = badges[v.value];
          return (
            <button
              key={v.value}
              type="button"
              onClick={() => onView(v.value)}
              aria-current={on ? "page" : undefined}
              title={`${v.label} (${v.key})`}
              className={`relative flex h-9 items-center gap-3 rounded-[10px] px-2.5 text-[13.5px] transition-colors duration-150 ${on ? "font-medium text-ink" : "text-ink-2 hover:bg-fill hover:text-ink"}`}
            >
              <span className={on ? "text-ink" : "text-muted"}>{v.icon}</span>
              <span className="flex-1 text-left">{v.label}</span>
              {!!badge && <span className="tabular font-mono text-[11px] text-faint">{badge}</span>}
            </button>
          );
        })}
      </nav>
      <div className="mt-9 px-1">{mini}</div>
      <div className="mt-auto flex flex-col gap-0.5 pt-6">
        <button
          type="button"
          onClick={onShortcuts}
          className="flex h-9 items-center gap-3 rounded-[10px] px-2.5 text-[13px] text-muted transition-colors hover:bg-fill hover:text-ink"
        >
          <KeyboardIcon />
          <span className="flex-1 text-left">Shortcuts</span>
          <Kbd>?</Kbd>
        </button>
        <div className="flex h-8 items-center gap-3 px-2.5 text-[12px]" aria-live="polite">
          <span className="flex w-4 justify-center">
            <span className={`size-1.5 rounded-full ${syncing ? "animate-breathe bg-ink" : "bg-ghost"}`} />
          </span>
          {syncing ? <span className="shimmer-text">Saving…</span> : <span className="text-faint">All changes saved</span>}
        </div>
        <div className="mt-1 border-t border-line pt-2">
          <AccountButton user={user} />
        </div>
      </div>
    </aside>
  );
}

export function MiniMonth({
  year,
  month,
  selected,
  todayKey,
  byDate,
  onShift,
  onSelect,
}: {
  year: number;
  month: number;
  selected: string;
  todayKey: string;
  byDate: (key: string) => Task[];
  onShift: (n: number) => void;
  onSelect: (key: string) => void;
}) {
  const { start, rows } = monthGrid(year, month);
  return (
    <div>
      <div className="flex items-center justify-between pl-1.5">
        <span className="text-[13px] font-medium">
          {MONTHS[month]} <span className="text-faint">{year}</span>
        </span>
        <span className="flex">
          <IconButton label="Previous month" size="sm" onClick={() => onShift(-1)}>
            <ChevronLeft size={13} />
          </IconButton>
          <IconButton label="Next month" size="sm" onClick={() => onShift(1)}>
            <ChevronRight size={13} />
          </IconButton>
        </span>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center font-mono text-[10px] text-faint">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: rows * 7 }, (_, i) => {
          const d = addDays(start, i);
          const key = ymd(d);
          const sel = key === selected;
          const tasks = byDate(key);
          const open = tasks.some((t) => !t.done);
          return (
            <button key={key} type="button" onClick={() => onSelect(key)} aria-label={formatLong(d)} aria-pressed={sel} className="relative flex h-[31px] items-center justify-center">
              <span
                className={`tabular flex size-[26px] items-center justify-center rounded-full text-[12px] transition-colors duration-150 ${
                  sel
                    ? "bg-ink font-medium text-on-ink"
                    : key === todayKey
                      ? "font-medium text-ink ring-[1.5px] ring-signal ring-inset hover:bg-fill"
                      : d.getMonth() !== month
                        ? "text-ghost hover:bg-fill"
                        : "text-ink-2 hover:bg-fill"
                }`}
              >
                {d.getDate()}
              </span>
              {tasks.length > 0 && <span className={`absolute bottom-0 size-[3px] rounded-full ${open ? "bg-ink" : "bg-ghost"}`} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function useAccountMenu() {
  const [anchor, setAnchor] = useState<{ rect: Anchor; el: HTMLElement } | null>(null);
  const [, startTransition] = useTransition();
  const menu = anchor && (
    <Menu
      anchor={anchor.rect}
      trigger={anchor.el}
      label="Account"
      onClose={() => setAnchor(null)}
      entries={[
        { heading: "Signed in with Google" },
        { label: "Privacy Policy", onSelect: () => window.location.assign("/privacy") },
        { label: "Terms of Service", onSelect: () => window.location.assign("/terms") },
        { separator: true },
        { label: "Sign out", onSelect: () => startTransition(() => signOutAction()) },
      ]}
    />
  );
  const toggle = (el: HTMLElement) => setAnchor((a) => (a ? null : { rect: el.getBoundingClientRect(), el }));
  return { menu, toggle, open: !!anchor };
}

function AccountButton({ user }: { user: AppUser }) {
  const { menu, toggle, open } = useAccountMenu();
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => ref.current && toggle(ref.current)}
        className={`flex w-full items-center gap-3 rounded-[12px] p-2 text-left transition-colors ${open ? "bg-fill" : "hover:bg-fill"}`}
      >
        <Avatar name={user.name} image={user.image} size={30} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{user.name}</span>
          <span className="block truncate text-[11.5px] text-muted">{user.email}</span>
        </span>
      </button>
      {menu}
    </>
  );
}

/** Phone layout: brand + account on top, the view switcher below. */
export function MobileBar({ user, view, onView }: { user: AppUser; view: View; onView: (v: View) => void }) {
  const { menu, toggle, open } = useAccountMenu();
  return (
    <div className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-xl md:hidden">
      <div className="flex h-14 items-center justify-between px-5">
        <Brand size={22} />
        <button type="button" aria-label="Account" aria-haspopup="menu" aria-expanded={open} onClick={(e) => toggle(e.currentTarget)} className="rounded-full">
          <Avatar name={user.name} image={user.image} size={30} />
        </button>
      </div>
      <div className="-mt-1 px-3.5 pb-2">
        <DotTabs label="View" value={view} onChange={onView} options={VIEWS.map(({ value, label }) => ({ value, label }))} />
      </div>
      {menu}
    </div>
  );
}
