"use client";

import { useEffect, useRef, useState } from "react";
import { relativeDay } from "@/lib/dates";
import { parseTaskInput } from "@/lib/parseDate";
import { AppIcon } from "./AppIcon";
import { ArrowUpIcon, CalendarIcon, ChartIcon, PlusIcon, SunIcon, WeekIcon } from "./icons";
import { ProgressLine } from "./ui";

// A scripted, looping rendition of the Day view for the landing page. Decorative only.
const TODAY = "2026-10-23";
type Row = { id: number; title: string; notes: string; time: string; done: boolean };
const BASE: Row[] = [
  { id: 1, title: "Team sync", notes: "Release plan for the week", time: "09:10", done: true },
  { id: 2, title: "Reply to Anna about the offsite", notes: "", time: "09:24", done: true },
  { id: 3, title: "Review sign-in mockups", notes: "Loading and error states", time: "10:02", done: false },
  { id: 4, title: "Groceries", notes: "Milk, bread, coffee", time: "12:40", done: false },
];
const ADDED: Row = { id: 5, title: "Ship release notes", notes: "", time: "10:41", done: false };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function LiveDemo() {
  const [rows, setRows] = useState(BASE);
  const [typed, setTyped] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRows([...BASE.map((r) => (r.id === 3 ? { ...r, done: true } : r)), ADDED]);
      return;
    }
    let alive = true;
    const wait = async (ms: number) => {
      await sleep(ms);
      if (!alive) throw new Error("stopped");
    };
    const type = async (text: string) => {
      for (let i = 1; i <= text.length; i++) {
        setTyped(text.slice(0, i));
        await wait(50 + Math.random() * 45);
      }
    };
    (async () => {
      try {
        while (alive) {
          setRows(BASE);
          setTyped("");
          setCycle((c) => c + 1);
          await wait(1300);
          await type("Call mom tomorrow");
          await wait(700);
          setTyped("");
          setToast("Added to Tomorrow");
          await wait(1700);
          setToast(null);
          await wait(450);
          await type("Ship release notes");
          await wait(450);
          setTyped("");
          setRows((r) => [...r, ADDED]);
          await wait(1100);
          setRows((r) => r.map((x) => (x.id === 3 ? { ...x, done: true } : x)));
          await wait(3400);
        }
      } catch {
        // unmounted
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const done = rows.filter((r) => r.done).length;
  const open = rows.length - done;
  const parsed = parseTaskInput(typed, TODAY);
  const chip = parsed.date ? (relativeDay(parsed.date, TODAY) ?? "Today") : "Today";

  return (
    <div aria-hidden="true" className="pointer-events-none relative overflow-hidden rounded-[22px] bg-paper text-left shadow-card select-none">
      <div className="flex">
        <div className="hidden w-[196px] flex-none border-r border-line px-3 py-5 md:block">
          <div className="flex items-center gap-2 px-2">
            <AppIcon size={18} />
            <span className="text-[14px] font-semibold tracking-[-0.035em]">hyperanchor</span>
          </div>
          <div className="mt-6 space-y-0.5">
            {[
              { icon: <SunIcon size={14} />, label: "Day", n: open, on: true },
              { icon: <WeekIcon size={14} />, label: "Week", n: 9 },
              { icon: <CalendarIcon size={14} />, label: "Month" },
              { icon: <ChartIcon size={14} />, label: "Analytics" },
            ].map((v) => (
              <div key={v.label} className={`flex h-8 items-center gap-2.5 rounded-[9px] px-2 text-[12.5px] ${v.on ? "bg-fill-on font-medium text-ink" : "text-ink-2"}`}>
                <span className={v.on ? "text-ink" : "text-muted"}>{v.icon}</span>
                <span className="flex-1">{v.label}</span>
                {!!v.n && <span className="font-mono text-[10px] text-faint">{v.n}</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-1 px-5 pt-6 pb-4 md:px-8 md:pt-8">
          <div className="mono-label">Fri · 23 Oct 2026</div>
          <div className="mt-2 text-[21px] leading-tight font-medium tracking-[-0.025em] md:text-[26px]">
            Good morning, Anna.{" "}
            <span key={`${open}-${done}`} className="inline-block animate-up text-faint">
              {open} tasks left, {done} done.
            </span>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <ProgressLine value={done / rows.length} className="flex-1" />
            <span className="tabular font-mono text-[10.5px] text-muted">
              {done}/{rows.length}
            </span>
          </div>

          <div className="mt-5 flex h-12 items-center gap-1.5 rounded-[16px] border border-ink pr-1.5 pl-3.5 shadow-[0_10px_30px_-14px_rgba(10,10,10,0.25)]">
            <PlusIcon size={16} className="flex-none text-ink" />
            <span className="min-w-0 flex-1 truncate px-1.5 text-[14px]">
              <span className="caret text-ink">{typed}</span>
              {!typed && <span className="text-faint">Add a task</span>}
            </span>
            <span
              key={chip}
              className={`flex h-7 flex-none items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-medium ${parsed.date ? "animate-kick bg-ink text-on-ink" : "bg-fill text-ink-2"}`}
            >
              <CalendarIcon size={12} />
              {chip}
            </span>
            <span className={`flex size-8 flex-none items-center justify-center rounded-full transition-colors ${typed ? "bg-ink text-on-ink" : "bg-fill-on text-faint"}`}>
              <ArrowUpIcon size={14} />
            </span>
          </div>

          <div key={cycle} className="mt-4 animate-fade">
            {rows.map((r) => (
              <DemoRow key={r.id} row={r} />
            ))}
          </div>
        </div>
      </div>

      {toast && (
        <div className="absolute inset-x-0 bottom-5 flex justify-center">
          <div className="animate-up rounded-full bg-ink px-4 py-2 text-[12.5px] text-on-ink">{toast}</div>
        </div>
      )}
    </div>
  );
}

function DemoRow({ row }: { row: Row }) {
  return (
    <div className="grid h-12 animate-up grid-cols-[34px_minmax(0,1fr)_48px] items-center border-b border-line md:grid-cols-[34px_minmax(0,1.3fr)_minmax(0,1fr)_52px]">
      <span className="flex justify-center">
        <DemoCheck done={row.done} />
      </span>
      <span className="min-w-0 pr-3">
        <span className={`relative inline-block max-w-full truncate align-top text-[14px] transition-colors duration-300 ${row.done ? "text-faint" : "text-ink"}`}>
          {row.title}
          <span
            className={`absolute top-1/2 left-0 h-px w-full origin-left bg-current transition-transform duration-500 ease-sweep ${row.done ? "scale-x-100" : "scale-x-0"}`}
          />
        </span>
      </span>
      <span className="hidden truncate pr-3 text-[13px] text-muted md:block">{row.notes}</span>
      <span className="text-right font-mono text-[10.5px] text-faint">{row.time}</span>
    </div>
  );
}

function DemoCheck({ done }: { done: boolean }) {
  const prev = useRef(done);
  const fresh = done && !prev.current;
  useEffect(() => {
    prev.current = done;
  });
  return (
    <span
      className={`flex size-[18px] items-center justify-center rounded-full border-[1.5px] transition-colors duration-200 ${done ? "border-ink bg-ink text-on-ink" : "border-ghost"} ${fresh ? "animate-bump" : ""}`}
    >
      {done && (
        <svg width="9" height="9" viewBox="0 0 10 10">
          <path d="M2 5.3 4.1 7.3 8 3" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={12} className={fresh ? "animate-draw" : ""} />
        </svg>
      )}
    </span>
  );
}
