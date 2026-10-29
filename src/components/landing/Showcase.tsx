"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, FlameIcon, PauseIcon, PlayIcon, PlusIcon } from "../icons";
import { Burst, Checkbox, ProgressRing } from "../ui";

// Each slide is a short scene drawn from its own clock `t` (ms since the slide appeared), so a scene can be
// replayed, frozen while it fades out, or shown finished (reduced motion) just by choosing `t`.
const STEP = 50;
const EASE = "cubic-bezier(0.2,0.8,0.2,1)";

// ── 1 · Today: the list ticks itself off, then celebrates ─────────────────────

const TASKS = [
  { title: "Plan the week", note: "Three things that matter most" },
  { title: "Send the proposal to Dana", note: "" },
  { title: "Gym, 45 minutes", note: "" },
  { title: "Pick up flowers for Sam", note: "Peonies, if they have them" },
];
const TICK_AT = [1600, 2550, 3500, 4450];

function TodayScene({ t }: { t: number }) {
  const done = TICK_AT.filter((at) => t >= at).length;
  const all = done === TASKS.length;
  return (
    <div className="relative">
      <div className="rounded-[22px] bg-surface p-5 shadow-float">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-display text-[20px] leading-7 font-bold tracking-[-0.02em]">Today</div>
            <div className={`tabular mt-0.5 text-[13px] transition-colors duration-300 ${all ? "font-medium text-ink" : "text-ink-3"}`}>
              {all ? "All done. Nice work!" : `${done} of ${TASKS.length} done`}
            </div>
          </div>
          <Burst active={all}>
            <ProgressRing value={done / TASKS.length} size={36} stroke={3.5} />
          </Burst>
        </div>
        <ul className="mt-4">
          {TASKS.map((task, i) => (
            <li key={task.title} className="flex items-start gap-3 border-t border-line py-2.5">
              <Checkbox checked={i < done} onToggle={() => {}} label={task.title} className="mt-px" />
              <div className="min-w-0">
                <div className={`truncate text-[14px] leading-5 transition-colors duration-300 ${i < done ? "text-ink-3" : "text-ink"}`}>{task.title}</div>
                {task.note && <div className="truncate text-[12.5px] text-ink-3">{task.note}</div>}
              </div>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3 border-t border-line pt-2.5 text-[14px] text-ink-3">
          <span className="flex size-5 items-center justify-center">
            <PlusIcon size={15} />
          </span>
          Add a task
        </div>
      </div>
      <Chips />
    </div>
  );
}

/** Two small cards floating over the list's corners, when the panel is wide enough for them. */
function Chips() {
  const chip = "absolute hidden items-center gap-2.5 rounded-[14px] bg-elevated text-[13px] whitespace-nowrap shadow-float @xl:flex";
  return (
    <>
      <div data-motion className={`${chip} -top-[30px] -left-14 py-2.5 pr-3.5 pl-2.5`} style={{ animation: "float-y 6s ease-in-out infinite" }}>
        <span className="flex size-8 flex-none items-center justify-center rounded-[10px] bg-surface-3 text-accent">
          <FlameIcon size={17} />
        </span>
        <span>
          <span className="block leading-4 font-semibold">12-day streak</span>
          <span className="block text-[11.5px] leading-[15px] text-ink-3">Keep it going</span>
        </span>
      </div>
      <div data-motion className={`${chip} top-[196px] -right-[70px] py-[9px] pr-3.5 pl-2.5`} style={{ animation: "float-y 7s 1s ease-in-out infinite" }}>
        <kbd
          data-motion
          className="flex h-7 min-w-7 items-center justify-center rounded-[7px] bg-surface font-sans text-[13px] font-semibold"
          style={{ animation: "key-press 3.2s 1.2s ease-in-out infinite", boxShadow: "0 0 0 1px var(--line-2), 0 3px 0 var(--line-2)" }}
        >
          N
        </kbd>
        <span className="font-medium">New task</span>
      </div>
    </>
  );
}

// ── 2 · Capture: a task types itself, Enter lights up, it drops into the list ──

const PHRASE = "Book flights to Lisbon";
const CHAR_AT: number[] = [];
for (let k = 0, at = 500; k < PHRASE.length; k++) CHAR_AT.push((at += 45 + (k % 4) * 18));
const ENTER_AT = CHAR_AT[CHAR_AT.length - 1] + 450;
const ADDED_AT = ENTER_AT + 320;

function Tick({ done = false }: { done?: boolean }) {
  return (
    <span className={`flex size-[18px] flex-none items-center justify-center rounded-full ${done ? "bg-accent text-on-accent" : "shadow-[inset_0_0_0_1.5px_var(--check-ring)]"}`}>
      {done && <CheckIcon size={9} strokeWidth={2.6} />}
    </span>
  );
}

function CaptureScene({ t }: { t: number }) {
  const typed = CHAR_AT.filter((at) => t >= at).length;
  const added = t >= ADDED_AT;
  const row = "flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px]";
  return (
    <div className="rounded-[22px] bg-surface p-3.5 shadow-float">
      <div className="flex h-12 items-center gap-2.5 rounded-[12px] bg-surface-2 pr-2.5 pl-3.5 shadow-[inset_0_0_0_1px_var(--line-2)]">
        <PlusIcon size={15} className="flex-none text-ink-3" />
        <span className="min-w-0 flex-1 truncate text-[14px] leading-5">
          {added ? (
            <span className="text-ink-3">New task</span>
          ) : (
            <>
              {PHRASE.slice(0, typed)}
              <span data-motion className="ml-px inline-block h-4 w-[1.5px] translate-y-[3px] bg-accent" style={{ animation: "caret 1s steps(1) infinite" }} />
            </>
          )}
        </span>
        <kbd
          className={`flex h-[26px] min-w-[26px] items-center justify-center rounded-[7px] px-1.5 font-sans text-[12px] font-medium transition-[background-color,color,transform] duration-150 ${
            t >= ENTER_AT && !added ? "translate-y-px bg-accent text-on-accent" : "bg-surface-3 text-ink-2"
          }`}
        >
          ↵
        </kbd>
      </div>
      {/* Four rows in a three-row window: the new task slides the list down into view. */}
      <div className="mt-2.5 h-28 overflow-hidden">
        <div className="flex flex-col gap-0.5 transition-transform duration-[450ms] ease-out" style={{ transform: `translateY(${added ? 0 : -38}px)` }}>
          <div
            className={row}
            style={{ opacity: added ? 1 : 0, backgroundColor: added && t < ADDED_AT + 1600 ? "var(--surface-3)" : "transparent", transition: "opacity 0.35s, background-color 0.8s" }}
          >
            <Tick />
            {PHRASE}
          </div>
          <div className={`${row} text-ink-3`}>
            <Tick done />
            Renew passport
          </div>
          <div className={row}>
            <Tick />
            Pack for the weekend
          </div>
          <div className={row}>
            <Tick />
            Water the plants
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 3 · Focus: one task; Done is pressed, it's ticked, the next one slides in ──

const QUEUE = ["Send the proposal to Dana", "Gym, 45 minutes", "Pick up flowers for Sam"];
const FOCUS_STEP = 2800;
const FOCUS_DONE = 1900;

function FocusScene({ t }: { t: number }) {
  const i = Math.min(QUEUE.length - 1, Math.floor(t / FOCUS_STEP));
  const local = t - i * FOCUS_STEP;
  const done = local >= FOCUS_DONE;
  const pressed = local >= FOCUS_DONE - 220 && !done;
  const finished = i + (done ? 1 : 0);
  const key = "ml-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] px-1 text-[10.5px] font-medium pointer-coarse:hidden";
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-3 text-[12px] text-ink-3">
        <span className="flex gap-1">
          {QUEUE.map((_, n) => (
            <span key={n} className={`h-1.5 w-5 rounded-full transition-colors duration-500 ${n < finished ? "bg-accent" : n === finished ? "bg-accent/45" : "bg-accent-track"}`} />
          ))}
        </span>
        <span className="tabular">
          Task {Math.min(finished + 1, QUEUE.length)} of {QUEUE.length}
        </span>
      </div>
      {/* The edges below the card are the tasks still waiting, as in the real focus mode. */}
      <div className="relative mt-4 w-full pb-[18px]">
        <span className="absolute inset-x-[9%] bottom-0 h-16 rounded-[18px] bg-surface-2 shadow-lift" />
        <span className="absolute inset-x-[4.5%] bottom-[9px] h-16 rounded-[20px] bg-surface shadow-lift" />
        <div key={i} className="relative animate-[focus-in_0.45s_var(--ease-out)_both] rounded-[22px] bg-surface p-6 shadow-float">
          <div className="flex items-start gap-3.5">
            <Checkbox checked={done} onToggle={() => {}} label={QUEUE[i]} size={24} className="mt-px" />
            <div className={`text-[20px] leading-[1.3] font-semibold tracking-[-0.02em] transition-colors duration-300 ${done ? "text-ink-3" : "text-ink"}`}>{QUEUE[i]}</div>
          </div>
          <div className="mt-5 flex gap-2 pl-[38px]">
            <span
              className={`inline-flex h-9 items-center gap-1.5 rounded-[10px] pr-2 pl-3 text-[13.5px] font-medium text-on-primary transition-[transform,background-color] duration-150 pointer-coarse:pr-3.5 ${
                pressed ? "scale-95 bg-primary-hover" : "bg-primary"
              }`}
            >
              <CheckIcon size={11} strokeWidth={2.2} />
              Done
              <span className={`${key} bg-on-primary/15 text-on-primary/75`}>Space</span>
            </span>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-surface pr-2 pl-3.5 text-[13.5px] font-medium shadow-lift pointer-coarse:pr-3.5">
              Not now
              <span className={`${key} bg-surface-3 text-ink-3`}>→</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 4 · Week: the days fill in one by one ─────────────────────────────────────

// 1 = done, 0 = still open; Thursday is "today".
const WEEK = [[1, 1], [1, 1, 1], [1, 0], [1, 1, 0], [0, 0], [0], []];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TODAY = 3;

function WeekScene({ t }: { t: number }) {
  const shown = t < 500 ? 0 : Math.floor((t - 500) / 140) + 1;
  let k = 0;
  return (
    <div className="grid grid-cols-7 gap-1 rounded-[22px] bg-surface p-3.5 shadow-float">
      {WEEK.map((tasks, d) => (
        <div key={d} className={`flex h-[152px] flex-col items-center gap-1.5 rounded-[12px] px-1 pt-3 sm:px-1.5 ${d === TODAY ? "bg-surface-3" : ""}`}>
          <span className={`text-[11px] leading-[14px] font-medium ${d === TODAY ? "text-accent-ink" : "text-ink-3"}`}>{DAYS[d]}</span>
          <span
            className={`flex h-7 items-center font-semibold ${d === TODAY ? "w-7 justify-center rounded-full bg-accent text-[14px] text-on-accent" : "text-[15px] text-ink-2"}`}
          >
            {19 + d}
          </span>
          <div className="mt-1.5 flex w-full flex-col gap-[5px]">
            {tasks.map((done, j) => {
              const visible = k++ < shown;
              return (
                <span
                  key={j}
                  className={`h-[7px] rounded-full transition-[opacity,transform] duration-300 ease-out ${done ? "bg-accent" : "bg-accent-track"} ${
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

// ── 5 · Progress: the ring fills, the bars grow, the trend pops in ──────────────

const BARS = [3, 5, 2, 6, 4, 7, 5];
const R = 45;
const C = 2 * Math.PI * R;

function ProgressScene({ t }: { t: number }) {
  const fill = t >= 150;
  const p = Math.min(1, Math.max(0, (t - 150) / 1200));
  const trend = t >= 900;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-9 gap-y-5 rounded-[22px] bg-surface px-6 py-7 shadow-float">
      <div className="relative flex size-[108px] flex-none items-center justify-center">
        <svg width="108" height="108" viewBox="0 0 108 108" aria-hidden="true" className="absolute inset-0 -rotate-90">
          <circle cx="54" cy="54" r={R} fill="none" stroke="var(--accent-track)" strokeWidth="9" />
          <circle
            cx="54"
            cy="54"
            r={R}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={C}
            style={{ strokeDashoffset: fill ? C * 0.22 : C, opacity: fill ? 1 : 0, transition: fill ? `stroke-dashoffset 1.2s ${EASE}` : "none" }}
          />
        </svg>
        <div className="relative text-center">
          <div className="tabular text-[24px] leading-[26px] font-bold tracking-[-0.02em]">{Math.round(78 * (1 - (1 - p) ** 3))}%</div>
          <div className="text-[11px] leading-[14px] text-ink-3">done</div>
        </div>
      </div>
      <div className="flex flex-col items-start gap-2.5">
        <span
          className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-[9px] py-[3px] text-[12px] leading-4 font-semibold transition-[opacity,transform] duration-[400ms] ease-out"
          style={{ opacity: trend ? 1 : 0, transform: `translateY(${trend ? 0 : 6}px)` }}
        >
          ▲ 18% <span className="font-normal text-ink-2">vs last week</span>
        </span>
        <div className="flex h-[88px] items-end gap-[7px]">
          {BARS.map((n, i) => (
            <span
              key={i}
              className={`w-3.5 origin-bottom rounded-t-[4px] ${i === 5 ? "bg-accent" : "bg-accent-track"}`}
              style={{ height: `${(n / 7) * 100}%`, transform: `scaleY(${fill ? 1 : 0})`, transition: fill ? `transform 0.7s ${100 + i * 70}ms ${EASE}` : "none" }}
            />
          ))}
        </div>
        <div className="flex gap-[7px] text-[10px] leading-3 text-ink-3">
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

// ── The carousel ───────────────────────────────────────────────────────────────

const SLIDES = [
  { name: "Your day", title: "Your day, calm and clear", text: "Everything planned for today on one quiet list. Tick things off and watch the ring fill.", ms: 7600, Scene: TodayScene },
  { name: "Quick capture", title: "Capture in a blink", text: "Press N anywhere, type, hit Enter. Every change can be undone.", ms: 6200, Scene: CaptureScene },
  { name: "Focus mode", title: "One thing at a time", text: "Focus mode shows just the next task. Finish it or set it aside — the rest waits quietly.", ms: 5400, Scene: FocusScene },
  { name: "Your week", title: "Your week at a glance", text: "Every day side by side. Move anything to tomorrow or next week in a click.", ms: 5000, Scene: WeekScene },
  { name: "Progress", title: "Progress you can feel", text: "Completion rate, streaks and your strongest days — clear numbers that stay private.", ms: 5600, Scene: ProgressScene },
];
const finished = (i: number) => SLIDES[i].ms - STEP;

type Clock = { slide: number; t: number; prev: number; prevAt: number; fade: number };

/**
 * The sign-in page's showcase: short animated scenes of the app, one at a time, each with a caption.
 * It moves on by itself and holds while focus is inside it; the pause button stops all motion on the page.
 * With reduced motion it shows each scene finished and only changes slides when asked.
 */
export function Showcase() {
  const [clock, setClock] = useState<Clock>({ slide: 0, t: 0, prev: -1, prevAt: 0, fade: 0 });
  const [still, setStill] = useState(false);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const { slide, t, prev, prevAt } = clock;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setStill(mq.matches);
      if (mq.matches) setClock((c) => ({ ...c, t: finished(c.slide), prev: -1 }));
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let visible = true;
    const sync = () => setOnScreen(visible && !document.hidden);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", sync);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  // Paused also stops the headline's rotating word and the floating cards (`data-motion`, see globals.css).
  useEffect(() => {
    const root = document.documentElement;
    if (paused) root.dataset.motion = "paused";
    else delete root.dataset.motion;
    return () => {
      delete root.dataset.motion;
    };
  }, [paused]);

  useEffect(() => {
    if (still || paused || !onScreen) return;
    const id = setInterval(() => {
      setClock((c) => {
        const next = { ...c, t: c.t + STEP };
        // The slide that faded out is dropped once its fade is over.
        if (next.prev >= 0 && (next.fade += STEP) >= 600) Object.assign(next, { prev: -1, fade: 0 });
        if (next.t >= SLIDES[next.slide].ms) {
          // Held: replay the scene instead of moving on.
          if (!held) Object.assign(next, { prev: next.slide, prevAt: finished(next.slide), fade: 0, slide: (next.slide + 1) % SLIDES.length });
          next.t = 0;
        }
        return next;
      });
    }, STEP);
    return () => clearInterval(id);
  }, [still, paused, onScreen, held]);

  // Without autoplay (paused, reduced motion) a chosen slide shows its scene finished, with no cross-fade.
  const pick = (i: number) =>
    setClock((c) => (i === c.slide ? c : { slide: i, t: still || paused ? finished(i) : 0, prev: still || paused ? -1 : c.slide, prevAt: c.t, fade: 0 }));
  const togglePause = () => {
    setClock((c) => ({ ...c, t: paused ? 0 : c.t, prev: -1 }));
    setPaused(!paused);
  };
  const moving = !still && !paused && !held;

  return (
    <div
      ref={ref}
      role="region"
      aria-roledescription="carousel"
      aria-label="What Hyperanchor does"
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHeld(false);
      }}
      className="@container relative isolate flex min-h-[640px] min-w-0 flex-1 flex-col overflow-hidden rounded-[24px] bg-canvas px-5 pt-12 pb-20 sm:px-8 lg:min-h-[620px] lg:pt-16 lg:pb-24"
    >
      <div aria-hidden="true" className="dot-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_60%_55%_at_50%_45%,#000_20%,transparent_78%)]" />

      <div aria-live={moving ? "off" : "polite"} className="grid flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] place-items-center">
        {(prev >= 0 ? [prev, slide] : [slide]).map((i) => {
          const { title, text, Scene } = SLIDES[i];
          const leaving = i !== slide;
          return (
            <div
              key={i}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${SLIDES.length}`}
              aria-hidden={leaving || undefined}
              className={`flex w-full max-w-[400px] flex-col items-center text-center [grid-area:1/1] ${
                leaving ? "pointer-events-none animate-[slide-out_0.45s_ease_both]" : "animate-[slide-in_0.6s_var(--ease-out)_both]"
              }`}
            >
              <div inert className="w-full text-left">
                <Scene t={leaving ? prevAt : t} />
              </div>
              <h2 className="mt-9 font-display text-[20px] leading-[1.3] font-semibold tracking-[-0.02em]">{title}</h2>
              <p className="mt-2 max-w-[340px] text-[14.5px] leading-[1.55] text-balance text-ink-2">{text}</p>
            </div>
          );
        })}
      </div>

      <div className="absolute inset-x-0 bottom-7 flex justify-center gap-0.5 lg:bottom-8">
        {SLIDES.map((s, i) => (
          <button
            key={s.name}
            type="button"
            onClick={() => pick(i)}
            aria-label={`Show slide ${i + 1} of ${SLIDES.length}: ${s.name}`}
            aria-current={i === slide || undefined}
            className="flex h-6 items-center rounded-full px-1"
          >
            <span className={`relative block h-1.5 overflow-hidden rounded-full bg-ink-3 transition-[width] duration-[350ms] ease-out ${i === slide ? "w-7" : "w-1.5"}`}>
              {i === slide && (
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-ink transition-[width] duration-[50ms] ease-linear"
                  style={{ width: `${moving ? Math.min(100, (t / s.ms) * 100) : 100}%` }}
                />
              )}
            </span>
          </button>
        ))}
      </div>
      {!still && (
        <button
          type="button"
          onClick={togglePause}
          aria-label={paused ? "Play the slideshow" : "Pause the slideshow"}
          className="absolute right-4 bottom-7 flex size-6 items-center justify-center rounded-full text-ink-3 transition-colors hover:text-ink sm:right-6 lg:bottom-8"
        >
          {paused ? <PlayIcon size={11} /> : <PauseIcon size={11} />}
        </button>
      )}
    </div>
  );
}
