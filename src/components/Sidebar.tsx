"use client";

import { useRef, useState, useTransition } from "react";
import { signOutAction } from "@/app/actions";
import { addDays, formatLong, monthGrid, MONTHS, ymd } from "@/lib/dates";
import type { AppUser, Task } from "@/lib/types";
import { Avatar } from "./Avatar";
import { Wordmark } from "./Brand";
import { CalendarIcon, ChartIcon, ChevronLeft, ChevronRight, SunIcon, WeekIcon } from "./icons";
import { IconButton, Menu, type Anchor } from "./ui";

export type View = "day" | "week" | "month" | "analytics";

export const VIEWS: { value: View; label: string; key: string; icon: React.ReactNode }[] = [
  { value: "day", label: "Day", key: "D", icon: <SunIcon /> },
  { value: "week", label: "Week", key: "W", icon: <WeekIcon /> },
  { value: "month", label: "Month", key: "M", icon: <CalendarIcon /> },
  { value: "analytics", label: "Analytics", key: "A", icon: <ChartIcon /> },
];

const NAV_ROW = 38; // item height (36) + gap (2): how far the selection travels per item

export function Sidebar({
  user,
  view,
  onView,
  onShortcuts,
  onSettings,
  badges,
  mini,
}: {
  user: AppUser;
  view: View;
  onView: (v: View) => void;
  onShortcuts: () => void;
  onSettings: () => void;
  badges: Partial<Record<View, number>>;
  mini: React.ReactNode;
}) {
  const index = Math.max(0, VIEWS.findIndex((v) => v.value === view));
  return (
    <aside className="hidden w-[248px] flex-none flex-col md:flex">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pt-3 pb-3">
        <div className="flex h-11 flex-none items-center px-2.5">
          <Wordmark />
        </div>
        <nav aria-label="Views" className="relative mt-3 flex flex-col gap-0.5">
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-9 rounded-[10px] bg-surface shadow-lift transition-transform duration-300 ease-spring"
            style={{ transform: `translateY(${index * NAV_ROW}px)` }}
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
                className={`relative flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] transition-colors duration-150 ${
                  on ? "font-medium text-ink" : "text-ink-2 hover:bg-line hover:text-ink"
                }`}
              >
                <span className={`transition-colors duration-150 ${on ? "text-accent" : "text-ink-3"}`}>{v.icon}</span>
                <span className="flex-1 text-left">{v.label}</span>
                {!!badge && <span className="tabular text-[12px] font-normal text-ink-3">{badge}</span>}
              </button>
            );
          })}
        </nav>
        <div className="mt-7 px-1">{mini}</div>
        <div className="mt-auto pt-4">
          <AccountButton user={user} onShortcuts={onShortcuts} onSettings={onSettings} />
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
        <span className="text-[13px] font-semibold tracking-[-0.01em]">
          {MONTHS[month]} <span className="font-normal text-ink-3">{year}</span>
        </span>
        <span className="flex">
          <IconButton label="Previous month" size="sm" onClick={() => onShift(-1)} className="hover:bg-line">
            <ChevronLeft size={13} strokeWidth={2} />
          </IconButton>
          <IconButton label="Next month" size="sm" onClick={() => onShift(1)} className="hover:bg-line">
            <ChevronRight size={13} strokeWidth={2} />
          </IconButton>
        </span>
      </div>
      <div className="mt-1.5 grid grid-cols-7 text-center text-[10.5px] font-medium text-ink-3">
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
          const today = key === todayKey;
          const tasks = byDate(key);
          const allDone = tasks.length > 0 && tasks.every((t) => t.done);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-label={formatLong(d)}
              aria-pressed={sel}
              className="group relative flex h-[30px] items-center justify-center"
            >
              {/* Today is the accent; another selected day is black (as in Calendar). */}
              <span
                className={`tabular flex size-[26px] items-center justify-center rounded-full text-[12px] transition-colors duration-150 ${
                  sel && today
                    ? "bg-accent font-semibold text-on-accent"
                    : sel
                      ? "bg-primary font-semibold text-on-primary"
                      : today
                        ? "font-bold text-accent-ink group-hover:bg-line-2"
                        : d.getMonth() !== month
                          ? "text-ink-4 group-hover:bg-line-2"
                          : "text-ink group-hover:bg-line-2"
                }`}
              >
                {d.getDate()}
              </span>
              {tasks.length > 0 && !sel && <span className={`absolute bottom-0 size-[3px] rounded-full ${allDone ? "bg-accent" : "bg-ink-4"}`} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** `phone`: names the account (the phone header shows only the avatar) and leaves out keyboard hints. */
function useAccountMenu(onShortcuts: () => void, onSettings: () => void, phone?: { email: string }) {
  const [anchor, setAnchor] = useState<{ rect: Anchor; el: HTMLElement } | null>(null);
  const [, startTransition] = useTransition();
  const menu = anchor && (
    <Menu
      anchor={anchor.rect}
      trigger={anchor.el}
      label="Account"
      onClose={() => setAnchor(null)}
      entries={[
        ...(phone ? [{ heading: phone.email }, { separator: true as const }] : []),
        { label: "Settings", shortcut: phone ? undefined : ",", onSelect: onSettings },
        ...(phone ? [] : [{ label: "Keyboard Shortcuts", shortcut: "?", onSelect: onShortcuts }]),
        { separator: true },
        { label: "Privacy Policy", onSelect: () => window.location.assign("/privacy") },
        { label: "Terms of Service", onSelect: () => window.location.assign("/terms") },
        { separator: true },
        { label: "Sign Out", onSelect: () => startTransition(() => signOutAction()) },
      ]}
    />
  );
  const toggle = (el: HTMLElement) => setAnchor((a) => (a ? null : { rect: el.getBoundingClientRect(), el }));
  return { menu, toggle, open: !!anchor };
}

function AccountButton({ user, onShortcuts, onSettings }: { user: AppUser; onShortcuts: () => void; onSettings: () => void }) {
  const { menu, toggle, open } = useAccountMenu(onShortcuts, onSettings);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => ref.current && toggle(ref.current)}
        className={`flex w-full items-center gap-2.5 rounded-[12px] p-2 text-left transition-colors duration-150 ${open ? "bg-line-2" : "hover:bg-line"}`}
      >
        <Avatar name={user.name} image={user.image} size={30} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{user.name}</span>
          <span className="block truncate text-[11.5px] text-ink-3">{user.email}</span>
        </span>
      </button>
      {menu}
    </>
  );
}

/** Phone layout, top: the wordmark and the account. */
export function MobileHeader({ user, onShortcuts, onSettings }: { user: AppUser; onShortcuts: () => void; onSettings: () => void }) {
  const { menu, toggle, open } = useAccountMenu(onShortcuts, onSettings, { email: user.email });
  return (
    <div className="glass sticky top-0 z-30 flex h-14 items-center justify-between pr-4 pl-5 shadow-[0_1px_0_var(--line)] md:hidden">
      <Wordmark />
      <button type="button" aria-label="Account" aria-haspopup="menu" aria-expanded={open} onClick={(e) => toggle(e.currentTarget)} className="rounded-full">
        <Avatar name={user.name} image={user.image} size={30} />
      </button>
      {menu}
    </div>
  );
}

/** Phone layout, bottom: a floating glass tab bar; the selection slides to the current view. */
export function TabBar({ view, onView }: { view: View; onView: (v: View) => void }) {
  const index = Math.max(0, VIEWS.findIndex((v) => v.value === view));
  return (
    <nav aria-label="Views" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] md:hidden">
      <div className="glass pointer-events-auto relative grid w-full max-w-[380px] grid-cols-4 rounded-[22px] p-1 shadow-float">
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 rounded-[18px] bg-surface shadow-lift transition-transform duration-300 ease-spring"
          style={{ width: "calc((100% - 8px) / 4)", transform: `translateX(${index * 100}%)` }}
        />
        {VIEWS.map((v) => {
          const on = v.value === view;
          return (
            <button
              key={v.value}
              type="button"
              onClick={() => onView(v.value)}
              aria-current={on ? "page" : undefined}
              className={`relative flex h-[52px] flex-col items-center justify-center gap-[3px] rounded-[18px] text-[10.5px] font-medium transition-colors duration-150 ${
                on ? "text-ink" : "text-ink-3"
              }`}
            >
              <span className={on ? "text-accent" : ""}>{v.icon}</span>
              {v.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
