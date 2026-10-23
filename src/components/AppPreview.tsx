import { AppIcon } from "./AppIcon";
import { CalendarIcon, ChartIcon, CheckIcon, ChevronLeft, ChevronRight, PlusIcon, SunIcon, WeekIcon } from "./icons";

// A static, decorative rendition of the app for the landing page.
const ROWS = [
  { done: true, title: "Team sync", notes: "Release plan, split up tasks for the week", time: "9:10 AM" },
  { done: true, title: "Reply to Anna about the offsite", notes: "", time: "9:24 AM" },
  { done: false, title: "Review sign-in screen mockups", notes: "Loading and error states", time: "10:02 AM", selected: true },
  { done: false, title: "Groceries", notes: "Milk, bread, vegetables, coffee", time: "12:40 PM" },
  { done: false, title: "Call mom", notes: "", time: "1:15 PM" },
];
const STRIP = [
  { d: "Mon", n: 20, p: 1 },
  { d: "Tue", n: 21, p: 1 },
  { d: "Wed", n: 22, p: 0.6 },
  { d: "Thu", n: 23, p: 0.4, sel: true },
  { d: "Fri", n: 24, p: 0 },
  { d: "Sat", n: 25, p: -1 },
  { d: "Sun", n: 26, p: -1 },
];

export function AppPreview() {
  return (
    <div aria-hidden="true" className="pointer-events-none overflow-hidden rounded-[14px] bg-window text-left shadow-window select-none">
      <div className="flex">
        <div className="hidden w-[188px] flex-none border-r border-separator bg-sidebar p-2.5 sm:block">
          <div className="flex h-9 items-center gap-2 px-1.5">
            <AppIcon size={18} />
            <span className="text-[12.5px] font-semibold">Hyperanchor</span>
          </div>
          {[
            { icon: <SunIcon size={14} />, label: "Day", badge: 3, on: true },
            { icon: <WeekIcon size={14} />, label: "Week", badge: 9 },
            { icon: <CalendarIcon size={14} />, label: "Month" },
            { icon: <ChartIcon size={14} />, label: "Analytics" },
          ].map((n) => (
            <div key={n.label} className={`flex h-7 items-center gap-2 rounded-[6px] px-2 text-[12px] ${n.on ? "bg-selected font-medium" : ""}`}>
              <span className="text-accent">{n.icon}</span>
              <span className="flex-1">{n.label}</span>
              {n.badge && <span className="text-[11px] text-label-2">{n.badge}</span>}
            </div>
          ))}
          <div className="mt-5 px-1.5 text-[11.5px] font-semibold">
            October <span className="font-normal text-label-2">2026</span>
          </div>
          <div className="mt-1.5 grid grid-cols-7 gap-y-1 px-0.5 text-center text-[10.5px]">
            {Array.from({ length: 35 }, (_, i) => {
              const day = i - 2;
              const label = day < 1 ? 28 + day + 2 : day > 31 ? day - 31 : day;
              return (
                <span
                  key={i}
                  className={`mx-auto flex size-[19px] items-center justify-center rounded-full ${day === 23 ? "bg-accent font-semibold text-white" : day < 1 || day > 31 ? "text-label-3" : "text-label"}`}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 border-b border-separator px-4 py-2.5 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="font-display text-[17px] leading-6 font-bold tracking-[-0.02em]">Today</div>
              <div className="truncate text-[11px] text-label-2">Thursday, October 23 · 2 of 5 done</div>
            </div>
            <div className="flex h-6 overflow-hidden rounded-[6px] bg-control text-[11.5px] font-medium shadow-control max-sm:hidden">
              <span className="flex w-6 items-center justify-center">
                <ChevronLeft size={11} strokeWidth={2} />
              </span>
              <span className="flex items-center border-x border-separator px-2 text-label-3">Today</span>
              <span className="flex w-6 items-center justify-center">
                <ChevronRight size={11} strokeWidth={2} />
              </span>
            </div>
            <div className="flex h-6 items-center gap-1 rounded-[6px] bg-accent px-2 text-[11.5px] font-medium text-white">
              <PlusIcon size={11} strokeWidth={2} /> New Task
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 px-4 pt-3 sm:px-5">
            {STRIP.map((s) => (
              <div key={s.n} className="flex flex-col items-center gap-0.5 py-1">
                <span className="text-[9.5px] font-medium text-label-2">{s.d}</span>
                <span
                  className={`flex size-6 items-center justify-center rounded-full text-[12.5px] font-semibold ${s.sel ? "bg-accent text-white" : s.n < 23 ? "text-label-2" : "text-label"}`}
                >
                  {s.n}
                </span>
                <span className={`h-[2px] w-4 overflow-hidden rounded-full ${s.p >= 0 ? "bg-fill" : ""}`}>
                  {s.p > 0 && <span className="block h-full bg-accent" style={{ width: `${s.p * 100}%` }} />}
                </span>
              </div>
            ))}
          </div>

          <div className="px-3 pt-3 pb-4 sm:px-4">
            <div className="grid h-7 grid-cols-[30px_minmax(0,1fr)_64px] items-center border-b border-separator px-1 text-[10.5px] font-medium text-label-2 sm:grid-cols-[30px_minmax(0,1.2fr)_minmax(0,1fr)_64px]">
              <span />
              <span>Task</span>
              <span className="max-sm:hidden">Notes</span>
              <span className="text-right">Added</span>
            </div>
            {ROWS.map((r) => (
              <div
                key={r.title}
                className={`grid h-9 grid-cols-[30px_minmax(0,1fr)_64px] items-center rounded-[6px] px-1 text-[12px] sm:grid-cols-[30px_minmax(0,1.2fr)_minmax(0,1fr)_64px] ${r.selected ? "bg-accent-soft" : "border-b border-separator"}`}
              >
                <span className="flex justify-center">
                  <span className={`flex size-[15px] items-center justify-center rounded-full ${r.done ? "bg-accent text-white" : "border-[1.5px] border-label-4"}`}>
                    {r.done && <CheckIcon size={8} strokeWidth={2.4} />}
                  </span>
                </span>
                <span className={`truncate pr-2 ${r.done ? "text-label-3" : ""}`}>{r.title}</span>
                <span className="truncate pr-2 text-[11.5px] text-label-2 max-sm:hidden">{r.notes}</span>
                <span className="text-right text-[11px] text-label-3">{r.time}</span>
              </div>
            ))}
            <div className="flex h-9 items-center gap-2 px-2 text-[12px] text-label-3">
              <PlusIcon size={12} /> New Task
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
