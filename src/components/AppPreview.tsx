import { Wordmark } from "./Brand";
import { CalendarIcon, ChartIcon, CheckIcon, ChevronLeft, ChevronRight, PlusIcon, SunIcon, WeekIcon } from "./icons";

// A static, decorative rendition of the app for the landing page: glass panels floating over the page's light.
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
  { d: "Thu", n: 23, p: 0.4 },
  { d: "Fri", n: 24, p: 0 },
  { d: "Sat", n: 25, p: -1 },
  { d: "Sun", n: 26, p: -1 },
];
const NAV = [
  { icon: <SunIcon size={14} />, label: "Day", badge: 3 },
  { icon: <WeekIcon size={14} />, label: "Week", badge: 9 },
  { icon: <CalendarIcon size={14} />, label: "Month" },
  { icon: <ChartIcon size={14} />, label: "Analytics" },
];
const GRID = "grid-cols-[32px_minmax(0,1fr)_64px] sm:grid-cols-[32px_minmax(0,1.2fr)_minmax(0,1fr)_64px]";

export function AppPreview() {
  return (
    <div
      aria-hidden="true"
      className="settle rim pointer-events-none relative isolate rounded-[36px] bg-white/10 p-2.5 text-left shadow-float select-none dark:bg-white/[0.025]"
    >
      <div className="flex gap-2.5">
        <div className="glass rim relative hidden w-[206px] flex-none flex-col rounded-[28px] p-2.5 sm:flex">
          <div className="flex h-11 items-center px-2.5">
            <Wordmark size={16} />
          </div>
          <div className="relative mt-1 flex flex-col gap-0.5">
            <span className="lens absolute inset-x-0 top-0 h-8 rounded-[11px]" />
            {NAV.map((n, i) => (
              <div key={n.label} className={`relative flex h-8 items-center gap-2 rounded-[11px] px-2.5 text-[12px] ${i === 0 ? "font-medium text-label" : "text-label-2"}`}>
                {n.icon}
                <span className="flex-1">{n.label}</span>
                {n.badge && <span className="text-[11px] font-normal text-label-3">{n.badge}</span>}
              </div>
            ))}
          </div>
          <div className="mt-6 px-2 text-[11.5px] font-semibold">
            October <span className="font-normal text-label-2">2026</span>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-y-1 px-0.5 text-center text-[10px]">
            {Array.from({ length: 35 }, (_, i) => {
              const day = i - 2;
              const label = day < 1 ? 28 + day + 2 : day > 31 ? day - 31 : day;
              return (
                <span
                  key={i}
                  className={`mx-auto flex size-[20px] items-center justify-center rounded-full ${day === 23 ? "ink font-semibold" : day < 1 || day > 31 ? "text-label-3" : "text-label"}`}
                >
                  {label}
                </span>
              );
            })}
          </div>
          <div className="mt-auto flex items-center gap-2 px-1.5 pt-6">
            <span className="flex size-6 items-center justify-center rounded-full bg-gradient-to-b from-[#a1a1a6] to-[#86868b] text-[9px] font-semibold text-white">
              AS
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[11px] font-medium">Anna Smith</span>
              <span className="block truncate text-[9.5px] text-label-2">anna.smith@gmail.com</span>
            </span>
          </div>
        </div>

        <div className="glass-sheet rim relative min-w-0 flex-1 rounded-[28px]">
          <div className="flex items-center gap-3 px-4 pt-5 pb-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="font-display text-[20px] leading-6 font-bold tracking-[-0.03em]">Today</div>
              <div className="truncate text-[11px] text-label-2">Thursday, October 23 · 2 of 5 done</div>
            </div>
            <div className="control flex h-7 items-center rounded-full p-0.5 text-[11.5px] font-medium max-sm:hidden">
              <span className="flex size-6 items-center justify-center">
                <ChevronLeft size={11} strokeWidth={2} />
              </span>
              <span className="px-2 text-label-3">Today</span>
              <span className="flex size-6 items-center justify-center">
                <ChevronRight size={11} strokeWidth={2} />
              </span>
            </div>
            <div className="ink flex h-7 items-center gap-1 rounded-full px-3 text-[11.5px] font-medium">
              <PlusIcon size={11} strokeWidth={2.2} /> New Task
            </div>
          </div>

          <div className="relative mx-2.5 grid grid-cols-7 sm:mx-3.5">
            <span className="absolute inset-y-0 left-0 w-[calc(100%/7)] translate-x-[300%] px-0.5">
              <span className="lens block h-full rounded-[16px]" />
            </span>
            {STRIP.map((s) => (
              <div key={s.n} className="relative flex flex-col items-center gap-1 pt-2 pb-2.5">
                <span className={`text-[9.5px] font-medium ${s.n === 23 ? "text-label" : "text-label-2"}`}>{s.d}</span>
                <span
                  className={`flex size-7 items-center justify-center rounded-full text-[13px] font-semibold ${s.n === 23 ? "ink" : s.n < 23 ? "text-label-2" : "text-label"}`}
                >
                  {s.n}
                </span>
                <span className={`h-[2px] w-5 overflow-hidden rounded-full ${s.p >= 0 ? "bg-fill" : ""}`}>
                  {s.p > 0 && <span className="block h-full bg-ink" style={{ width: `${s.p * 100}%` }} />}
                </span>
              </div>
            ))}
          </div>

          <div className="px-2.5 pt-2 pb-3 sm:px-3.5">
            <div className={`grid h-7 ${GRID} items-center border-b border-separator px-1 text-[9.5px] font-semibold tracking-[0.06em] text-label-3 uppercase`}>
              <span />
              <span>Task</span>
              <span className="max-sm:hidden">Notes</span>
              <span className="text-right">Added</span>
            </div>
            <div className="pt-1">
              {ROWS.map((r) => (
                <div
                  key={r.title}
                  className={`relative grid h-9 ${GRID} items-center rounded-[12px] px-1 text-[12px] ${r.selected ? "lens z-[1]" : "after:absolute after:right-2 after:bottom-0 after:left-10 after:h-px after:bg-separator"}`}
                >
                  <span className="flex justify-center">
                    <span
                      className={`flex size-4 items-center justify-center rounded-full ${r.done ? "bg-ink bg-[image:var(--ink-sheen)] text-on-ink" : "shadow-[inset_0_0_0_1.5px_var(--label-3)]"}`}
                    >
                      {r.done && <CheckIcon size={8} strokeWidth={2.4} />}
                    </span>
                  </span>
                  <span className={`truncate pr-2 ${r.done ? "text-label-3" : ""}`}>{r.title}</span>
                  <span className="truncate pr-2 text-[11.5px] text-label-2 max-sm:hidden">{r.notes}</span>
                  <span className="text-right text-[11px] text-label-3">{r.time}</span>
                </div>
              ))}
              <div className="flex h-9 items-center gap-2 px-2.5 text-[12px] text-label-3">
                <PlusIcon size={12} /> New Task
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
