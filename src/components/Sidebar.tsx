"use client";

import { useRef, useState, useTransition } from "react";
import { signOutAction } from "@/app/actions";
import { addDays, formatLong, monthGrid, MONTHS, ymd } from "@/lib/dates";
import type { AppUser, Task } from "@/lib/types";
import { Brand } from "./AppIcon";
import { Avatar } from "./Avatar";
import { CalendarIcon, ChartIcon, ChevronLeft, ChevronRight, SunIcon, WeekIcon } from "./icons";
import { IconButton, Menu, SegmentedControl, type Anchor } from "./ui";

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
}: {
  user: AppUser;
  view: View;
  onView: (v: View) => void;
  badges: Partial<Record<View, number>>;
  mini: React.ReactNode;
}) {
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-separator bg-sidebar px-2.5 pb-2.5 md:flex">
      <div className="flex h-14 flex-none items-center px-2">
        <Brand size={22} />
      </div>
      <nav aria-label="Views" className="flex flex-col gap-px">
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
              className={`flex h-8 items-center gap-2.5 rounded-[7px] px-2.5 text-[13.5px] transition-colors ${on ? "bg-selected font-medium text-label" : "text-label hover:bg-fill-3"}`}
            >
              <span className="text-accent">{v.icon}</span>
              <span className="flex-1 text-left">{v.label}</span>
              {!!badge && <span className="tabular text-[12px] text-label-2">{badge}</span>}
            </button>
          );
        })}
      </nav>
      <div className="mt-7 px-1">{mini}</div>
      <div className="mt-auto pt-4">
        <AccountButton user={user} />
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
        <span className="text-[13px] font-semibold">
          {MONTHS[month]} <span className="font-normal text-label-2">{year}</span>
        </span>
        <span className="flex">
          <IconButton label="Previous month" size="sm" onClick={() => onShift(-1)}>
            <ChevronLeft size={13} strokeWidth={2} />
          </IconButton>
          <IconButton label="Next month" size="sm" onClick={() => onShift(1)}>
            <ChevronRight size={13} strokeWidth={2} />
          </IconButton>
        </span>
      </div>
      <div className="mt-1.5 grid grid-cols-7 text-center text-[10.5px] font-medium text-label-3">
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
          const has = byDate(key).length > 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-label={formatLong(d)}
              aria-pressed={sel}
              className="relative flex h-[30px] items-center justify-center"
            >
              <span
                className={`tabular flex size-[26px] items-center justify-center rounded-full text-[12px] transition-colors ${
                  sel
                    ? "bg-accent font-semibold text-white"
                    : key === todayKey
                      ? "font-semibold text-accent hover:bg-fill-2"
                      : d.getMonth() !== month
                        ? "text-label-3 hover:bg-fill-2"
                        : "text-label hover:bg-fill-2"
                }`}
              >
                {d.getDate()}
              </span>
              {has && <span className={`absolute bottom-[1px] size-[3px] rounded-full ${sel ? "bg-accent" : "bg-label-3"}`} />}
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
        { label: "Sign Out", onSelect: () => startTransition(() => signOutAction()) },
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
        className={`flex w-full items-center gap-2.5 rounded-[8px] p-2 text-left transition-colors ${open ? "bg-fill-2" : "hover:bg-fill-3"}`}
      >
        <Avatar name={user.name} image={user.image} size={28} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{user.name}</span>
          <span className="block truncate text-[11.5px] text-label-2">{user.email}</span>
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
    <div className="material sticky top-0 z-30 border-b border-separator bg-toolbar md:hidden">
      <div className="flex h-12 items-center justify-between px-4">
        <Brand size={22} />
        <button
          type="button"
          aria-label="Account"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={(e) => toggle(e.currentTarget)}
          className="rounded-full"
        >
          <Avatar name={user.name} image={user.image} size={28} />
        </button>
      </div>
      <div className="px-4 pb-2.5">
        <SegmentedControl label="View" value={view} onChange={onView} options={VIEWS.map(({ value, label }) => ({ value, label }))} className="w-full" />
      </div>
      {menu}
    </div>
  );
}
