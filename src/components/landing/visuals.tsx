"use client";

import { useEffect, useState } from "react";
import { CheckIcon } from "../icons";
import { useInView } from "./useInView";

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Tick({ done }: { done: boolean }) {
  return (
    <span
      className={`flex size-[18px] flex-none items-center justify-center rounded-full transition-colors duration-300 ${
        done ? "bg-accent text-on-accent" : "shadow-[inset_0_0_0_1.5px_var(--check-ring)]"
      }`}
    >
      {done && <CheckIcon size={9} strokeWidth={2.6} />}
    </span>
  );
}

const PHRASE = "Book flights to Lisbon";

/** "Capture in a blink": a task types itself, Enter lights up, the task drops into the list. */
export function TypingVisual() {
  const [ref, inView] = useInView<HTMLDivElement>();
  const [n, setN] = useState(0);
  const [phase, setPhase] = useState<"type" | "enter" | "added">("type");

  useEffect(() => {
    if (!inView) return;
    if (reduceMotion()) {
      setPhase("added");
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    if (phase === "type") t = n < PHRASE.length ? setTimeout(() => setN(n + 1), 45 + (n % 4) * 18) : setTimeout(() => setPhase("enter"), 450);
    else if (phase === "enter") t = setTimeout(() => setPhase("added"), 320);
    else
      t = setTimeout(() => {
        setN(0);
        setPhase("type");
      }, 2800);
    return () => clearTimeout(t);
  }, [inView, n, phase]);

  return (
    <div ref={ref} className="flex h-full flex-col justify-center gap-3 px-6 sm:px-10">
      <div className="flex h-11 items-center gap-2.5 rounded-[12px] bg-surface px-3.5 shadow-lift">
        <span className="text-[17px] leading-none text-ink-3">+</span>
        <span className="min-w-0 flex-1 truncate text-[14px]">
          {phase === "added" ? (
            <span className="text-ink-3">New task</span>
          ) : (
            <>
              {PHRASE.slice(0, n)}
              <span className="ml-px inline-block h-4 w-[1.5px] translate-y-[3px] bg-accent" style={{ animation: "caret 1s steps(1) infinite" }} />
            </>
          )}
        </span>
        <kbd
          className={`flex h-6 min-w-6 items-center justify-center rounded-[6px] px-1.5 font-sans text-[12px] font-medium transition-[background-color,color,transform] duration-150 ${
            phase === "enter" ? "translate-y-px bg-accent text-on-accent" : "bg-surface-3 text-ink-2"
          }`}
        >
          ↵
        </kbd>
      </div>
      <ul className="space-y-1 rounded-[12px] bg-surface/70 p-2 shadow-[inset_0_0_0_1px_var(--line)]">
        {phase === "added" && (
          <li className="flex animate-rise items-center gap-2.5 rounded-[8px] bg-accent-soft px-2 py-1.5 text-[13.5px]">
            <Tick done={false} />
            {PHRASE}
          </li>
        )}
        <li className="flex items-center gap-2.5 px-2 py-1.5 text-[13.5px] text-ink-3">
          <Tick done />
          Renew passport
        </li>
        <li className="flex items-center gap-2.5 px-2 py-1.5 text-[13.5px]">
          <Tick done={false} />
          Pack for the weekend
        </li>
      </ul>
    </div>
  );
}

// 1 = done, 0 = still open; Thursday is "today".
const WEEK = [[1, 1], [1, 1, 1], [1, 0], [1, 1, 0], [0, 0], [0], []];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TODAY = 3;
const PILLS = WEEK.flat().length;

/** "Your week at a glance": the week fills in day by day. */
export function WeekVisual() {
  const [ref, inView] = useInView<HTMLDivElement>();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reduceMotion()) {
      setShown(PILLS);
      return;
    }
    const t = setTimeout(() => setShown((s) => (s >= PILLS + 14 ? 0 : s + 1)), shown === 0 ? 500 : 140);
    return () => clearTimeout(t);
  }, [inView, shown]);

  let k = 0;
  return (
    <div ref={ref} className="grid h-full grid-cols-7 items-center gap-1.5 px-4 sm:gap-2 sm:px-8">
      {WEEK.map((tasks, d) => (
        <div
          key={d}
          className={`flex h-[150px] flex-col items-center gap-1.5 rounded-[12px] px-1 pt-2.5 ${d === TODAY ? "bg-surface shadow-lift" : ""}`}
        >
          <span className={`text-[11px] font-medium ${d === TODAY ? "text-accent-ink" : "text-ink-3"}`}>{DAYS[d]}</span>
          <span className={`text-[15px] font-semibold ${d === TODAY ? "flex size-7 items-center justify-center rounded-full bg-accent text-on-accent" : "text-ink-2"}`}>
            {19 + d}
          </span>
          <div className="mt-1 flex w-full flex-col gap-1">
            {tasks.map((done, i) => {
              const visible = k++ < shown;
              return (
                <span
                  key={i}
                  className={`h-[7px] w-full rounded-full transition-[opacity,transform] duration-300 ${done ? "bg-accent" : "bg-accent-track"} ${
                    visible ? "scale-100 opacity-100" : "scale-75 opacity-0"
                  }`}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const BARS = [3, 5, 2, 6, 4, 7, 5];
const R = 42;
const C = 2 * Math.PI * R;

/** "Progress you can feel": a week of bars grows, the rate ring fills, the trend pops. Replays every few seconds. */
export function ProgressVisual() {
  const [ref, inView] = useInView<HTMLDivElement>();
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!inView || reduceMotion()) return;
    const t = setInterval(() => setRound((r) => r + 1), 5600);
    return () => clearInterval(t);
  }, [inView]);

  return (
    <div ref={ref} className="flex h-full items-center justify-center gap-6 px-6 sm:gap-10">
      <div className="relative flex flex-none items-center justify-center">
        <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true" className="-rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--accent-track)" strokeWidth="9" />
          {inView && (
            <circle
              key={round}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - 0.78)}
              style={{ "--c": C, animation: "ring-fill 1.2s cubic-bezier(0.2,0.8,0.2,1) both" } as React.CSSProperties}
            />
          )}
        </svg>
        <div className="absolute text-center">
          <div className="text-[22px] leading-6 font-bold tracking-[-0.02em]">78%</div>
          <div className="text-[10.5px] text-ink-3">done</div>
        </div>
      </div>
      <div className="flex flex-col items-start gap-2">
        <span key={`c${round}`} className="inline-flex animate-rise items-center gap-1 rounded-full bg-green-soft px-2 py-0.5 text-[12px] font-semibold text-green-ink">
          ▲ 18% <span className="font-normal opacity-80">vs last week</span>
        </span>
        <div key={`b${round}`} className="flex h-[92px] items-end gap-1.5">
          {BARS.map((v, i) => (
            <span
              key={i}
              className={`w-3.5 origin-bottom rounded-t-[4px] ${i === BARS.length - 2 ? "bg-accent" : "bg-accent-track"}`}
              style={{ height: `${(v / 7) * 100}%`, animation: inView ? `grow-y 0.7s ${i * 70}ms cubic-bezier(0.2,0.8,0.2,1) both` : undefined, opacity: inView ? 1 : 0 }}
            />
          ))}
        </div>
        <div className="flex gap-1.5 text-[10px] text-ink-3">
          {"MTWTFSS".split("").map((d, i) => (
            <span key={i} className="w-3.5 text-center">
              {d}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const KEYS = [
  { k: "N", label: "New task" },
  { k: "Space", label: "Done" },
  { k: "↵", label: "Edit" },
  { k: "⌫", label: "Delete" },
  { k: "← →", label: "Move" },
];

/** "Fast by design": the shortcuts press themselves in turn. */
export function KeysVisual() {
  return (
    <div className="flex h-full flex-wrap content-center items-start justify-center gap-x-3 gap-y-4 px-5">
      {KEYS.map((key, i) => (
        <div key={key.k} className="flex flex-col items-center gap-2">
          <kbd
            className="flex h-11 min-w-11 items-center justify-center rounded-[10px] bg-surface px-3 font-sans text-[14px] font-semibold text-ink"
            style={{ animation: `key-press 4.5s ${i * 0.7}s ease-in-out infinite`, boxShadow: "0 0 0 1px var(--line-2), 0 3px 0 var(--line-2)" }}
          >
            {key.k}
          </kbd>
          <span className="text-[11.5px] text-ink-2">{key.label}</span>
        </div>
      ))}
    </div>
  );
}
