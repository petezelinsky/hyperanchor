"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Task } from "@/lib/types";
import { disintegrate, shootCard, type CardShot } from "./dust";
import { CheckIcon, ChevronDown, PlusIcon, XIcon } from "./icons";
import { FOCUS_MINUTES, readFocusMinutes, saveFocusMinutes } from "./prefs";
import { Button, Checkbox, Kbd, Menu } from "./ui";
import { primeSound, soundTimer } from "./voice/sound";

/**
 * Focus mode: the whole screen for one task. The task is a small card, a row of the list grown large: its box and its
 * words, nothing else. It lies on top of a deck; the cards under it, one for each task still waiting, show as two even
 * edges. A finished card turns to dust (dust.ts) and the next one rises into its place at once; Later slips the card
 * to the back. Where the day stands and the timer sit in the bar above (a running timer also draws itself round the
 * card); a thought that comes up goes on the line below.
 */
export function FocusPanel({
  queue,
  done,
  total,
  isToday,
  onDone,
  onLater,
  onExit,
  onCapture,
}: {
  /** What's left, in the order it will come up; the first is the task in focus. Empty once nothing is left. */
  queue: Task[];
  done: number;
  total: number;
  isToday: boolean;
  onDone: (t: Task) => void;
  onLater: (t: Task) => void;
  onExit: () => void;
  /** Adds a task for later without leaving focus. */
  onCapture: (title: string) => void;
}) {
  const deck = queue.slice(0, 3);
  const task = deck[0];
  const leaving = useLeaving(deck, queue);
  const timer = useFocusTimer();
  const root = useRef<HTMLDivElement>(null);
  // The top card's picture, taken as it leaves the page: if it left because it's done, it turns to dust right where it
  // was, in the same frame (a card put off for later sinks to the back instead).
  const gone = useRef<{ id: string; shot: CardShot } | null>(null);
  useLayoutEffect(() => {
    const g = gone.current;
    gone.current = null;
    if (!g || !root.current || queue.some((t) => t.id === g.id)) return;
    disintegrate(root.current, g.shot);
  });
  // "Added for later", said on the line itself for a moment.
  const [kept, setKept] = useState(false);
  useEffect(() => {
    if (!kept) return;
    const id = setTimeout(() => setKept(false), 2000);
    return () => clearTimeout(id);
  }, [kept]);

  // The page behind holds still, and focus moves into the stage.
  useEffect(() => {
    root.current?.focus();
    const s = document.documentElement.style;
    const { overflow } = s;
    s.overflow = "hidden";
    return () => {
      s.overflow = overflow;
    };
  }, []);

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label="Focus"
      tabIndex={-1}
      className="fixed inset-0 z-[80] flex animate-[fade_var(--duration-base)_var(--ease-out)_both] flex-col bg-canvas outline-none"
    >
      {/* Three parts: on a wide bar the count sits in the very middle; on a phone's, the ends take what they need. */}
      <header className="@container/bar flex-none">
        <div className="grid h-[52px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 md:h-14 md:px-4 @min-[640px]/bar:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <div className="flex">
            <Button onClick={onExit} data-tip="Leave focus (Esc)" className="gap-2 pl-2.5">
              <XIcon size={14} />
              <span className="sm:hidden">Leave</span>
              <span className="max-sm:hidden">Leave focus</span>
              <span className="pointer-coarse:hidden">
                <Kbd>Esc</Kbd>
              </span>
            </Button>
          </div>
          <Where done={done} total={total} finished={!task} />
          <div className="flex justify-end">
            <TimerControl timer={timer} />
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-10 md:px-10">
        {task ? (
          <>
            <div className="relative w-full max-w-[560px]">
              {deck.map((t, i) => (
                <DeckCard key={t.id} task={t} index={i} onDone={onDone} onGone={(shot) => (gone.current = { id: t.id, shot })} />
              ))}
              {leaving && <DeckCard key={`${leaving.id}-leaving`} task={leaving} index={0} leaving />}
              <Fuse timer={timer} />
            </div>
            {/* The two ways on, quiet, under the deck (the box on the card finishes the task too). */}
            <div className="mt-12 flex items-center gap-1 text-ink-2">
              <Button variant="plain" onClick={() => onDone(task)} className="gap-2 pr-2 pl-2.5">
                <CheckIcon size={11} />
                Done
                <span className="pointer-coarse:hidden">
                  <Kbd>Space</Kbd>
                </span>
              </Button>
              {queue.length > 1 && (
                <Button variant="plain" onClick={() => !task.done && onLater(task)} className="gap-2 pr-2 pl-2.5">
                  Later
                  <span className="pointer-coarse:hidden">
                    <Kbd>→</Kbd>
                  </span>
                </Button>
              )}
            </div>
          </>
        ) : total > 0 ? (
          <AllDone isToday={isToday} onExit={onExit} />
        ) : (
          <p className="text-callout text-ink-2">Nothing is planned for this day.</p>
        )}
      </main>

      {/* A thought that comes up on the way: one quiet line at the foot (N), kept for later without leaving focus. */}
      <form
        className="mx-auto mb-[max(1rem,env(safe-area-inset-bottom))] flex h-10 w-[calc(100%-24px)] max-w-[400px] flex-none items-center gap-2.5 rounded-sm pr-2 pl-3 text-ink-3 opacity-45 transition-[background-color,box-shadow,color,opacity] duration-(--duration-base) focus-within:bg-surface focus-within:text-ink-2 focus-within:opacity-100 focus-within:shadow-ring-line-2 hover:text-ink-2 hover:opacity-100 md:mb-8"
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem("thought") as HTMLInputElement;
          const title = input.value.trim();
          if (!title) return;
          onCapture(title);
          input.value = "";
          setKept(true);
        }}
      >
        <span className="flex size-4 flex-none items-center justify-center">{kept ? <CheckIcon size={11} className="animate-pop-in text-ink" /> : <PlusIcon size={14} />}</span>
        <input
          id="focus-capture"
          name="thought"
          placeholder={kept ? "Added for later" : "Jot something down for later"}
          aria-label="Add a task for later"
          maxLength={500}
          autoComplete="off"
          enterKeyHint="done"
          className={`peer h-full min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none md:text-footnote ${kept ? "placeholder:text-ink" : "placeholder:text-current"}`}
          onInput={() => kept && setKept(false)}
          onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
        />
        <span className="peer-focus:hidden pointer-coarse:hidden">
          <Kbd>N</Kbd>
        </span>
        <span role="status" className="sr-only">
          {kept ? "Added for later" : ""}
        </span>
      </form>
    </div>
  );
}

/**
 * One card of the deck. The first lies on top and shows its task; the two under it are the same card, a step down and a
 * step smaller each, so their edges show as even strips. When the top one goes, the rest move up into place; as it goes,
 * it hands over its picture (`onGone`), taken while it is still on the page.
 */
function DeckCard({
  task,
  index,
  onDone,
  onGone,
  leaving = false,
}: {
  task: Task;
  index: number;
  onDone?: (t: Task) => void;
  onGone?: (shot: CardShot) => void;
  leaving?: boolean;
}) {
  const top = index === 0;
  const card = useRef<HTMLElement>(null);
  const latest = useRef({ top, onGone });
  latest.current = { top, onGone };
  // Runs while the card is being taken off the page, before it is gone from it.
  useLayoutEffect(
    () => () => {
      const el = card.current;
      if (el && latest.current.top && el.isConnected) latest.current.onGone?.(shootCard(el));
    },
    [],
  );
  const place = leaving
    ? "pointer-events-none absolute inset-x-0 top-0 z-0 animate-[focus-later_var(--duration-move)_var(--ease-out)_both]"
    : top
      ? "relative z-[3]"
      : `absolute inset-0 overflow-hidden ${index === 1 ? "z-[2]" : "z-[1]"}`;
  return (
    <article
      ref={card}
      inert={leaving || !top}
      aria-hidden={leaving || !top || undefined}
      data-deck={leaving ? "leaving" : index}
      style={leaving ? undefined : { transform: `translateY(${index * 10}px) scale(${1 - index * 0.05})` }}
      className={`flex origin-bottom items-start gap-4 rounded-[18px] px-5 py-5 text-left transition-[transform,background-color,box-shadow] duration-(--duration-move) ease-(--ease-spring) md:gap-[18px] md:px-7 md:py-6 ${place} ${
        top || leaving
          ? "bg-surface shadow-sheet"
          : index === 1
            ? "bg-[color-mix(in_srgb,var(--surface)_78%,var(--canvas))] shadow-[0_0_0_1px_color-mix(in_srgb,var(--ink)_8%,transparent)]"
            : "bg-[color-mix(in_srgb,var(--surface)_50%,var(--canvas))] shadow-[0_0_0_1px_color-mix(in_srgb,var(--ink)_7%,transparent)]"
      }`}
    >
      <span className={`flex flex-none pt-[1px] transition-opacity duration-(--duration-base) md:pt-[3px] ${top || leaving ? "delay-75" : "opacity-0"}`}>
        <Checkbox size={26} checked={task.done} onToggle={() => onDone?.(task)} label={task.done ? `“${task.title}” is done` : `Mark “${task.title}” as done`} />
      </span>
      <h2
        className={`min-w-0 flex-1 text-[20px] leading-[28px] font-semibold tracking-[-0.018em] break-words transition-[color,opacity] duration-(--duration-base) md:text-[24px] md:leading-[34px] md:tracking-[-0.022em] ${
          top || leaving ? "delay-75" : "opacity-0"
        } ${task.done ? "text-ink-3" : "text-ink"}`}
      >
        <span data-done={task.done} className="strike">
          {task.title}
        </span>
      </h2>
    </article>
  );
}

/** Where the day stands: a dot per task (a plain bar for long days), the one in hand outlined, and "3 of 7". */
function Where({ done, total, finished }: { done: number; total: number; finished: boolean }) {
  if (!total) return <span />;
  const at = Math.min(done + 1, total);
  return (
    <span
      role="img"
      aria-label={finished ? `All ${total} done` : `Task ${at} of ${total}`}
      className="flex min-w-0 items-center justify-center gap-2.5 justify-self-center text-footnote font-medium whitespace-nowrap text-ink-3"
    >
      {/* A dot per task while they fit (a dozen in a wide bar, five in a phone's); a plain bar beyond that. */}
      {total <= 12 && (
        <span aria-hidden="true" className={`flex gap-[5px] ${total > 5 ? "@max-[480px]/bar:hidden" : ""}`}>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`size-1.5 rounded-full transition-[background-color,box-shadow] duration-(--duration-data) ${
                i < done ? "bg-ink" : i === done ? "shadow-[inset_0_0_0_1.5px_var(--ink)]" : "bg-line-2"
              }`}
            />
          ))}
        </span>
      )}
      {total > 5 && (
        <span aria-hidden="true" className={`block h-1 w-24 flex-none overflow-hidden rounded-full bg-line-2 @max-[480px]/bar:w-10 @max-[380px]/bar:hidden ${total <= 12 ? "@min-[480px]/bar:hidden" : ""}`}>
          <span className="block h-full origin-left rounded-full bg-ink transition-transform duration-(--duration-data) ease-out" style={{ transform: `scaleX(${done / total})` }} />
        </span>
      )}
      <span aria-hidden="true" className="tabular">
        {finished ? `${total} of ${total}` : `${at} of ${total}`}
      </span>
    </span>
  );
}

/**
 * An optional timer for a stretch of focus. It lives in the panel, because two things show it: the clock in the bar,
 * and a line that travels round the card in hand. When the time is up a soft sound plays (and phones buzz), and it
 * rests until the next round.
 */
type Timer = {
  minutes: number;
  /** Picks the timer's length (remembered). */
  pick: (minutes: number) => void;
  running: boolean;
  /** Just finished: said for a few seconds. */
  over: boolean;
  /** Milliseconds left of the round, and its whole length. */
  left: number;
  total: number;
  start: () => void;
  stop: () => void;
};

function useFocusTimer(): Timer {
  const [minutes, setMinutes] = useState(readFocusMinutes);
  const [end, setEnd] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [over, setOver] = useState(false);

  useEffect(() => {
    if (!end) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t < end) return;
      setEnd(null);
      setOver(true);
      soundTimer();
      navigator.vibrate?.([90, 70, 90]);
    };
    const id = setInterval(tick, 1000);
    // A tab that was asleep catches up the moment it's looked at again.
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [end]);
  useEffect(() => {
    if (!over) return;
    const id = setTimeout(() => setOver(false), 10_000);
    return () => clearTimeout(id);
  }, [over]);

  const total = minutes * 60_000;
  return {
    minutes,
    pick: (m) => {
      setMinutes(m);
      saveFocusMinutes(m);
    },
    running: end != null,
    over,
    left: end ? Math.max(0, end - now) : total,
    total,
    start: () => {
      // Asked for during the click, so the browser lets the sound play when the time is up.
      primeSound();
      const t = Date.now();
      setNow(t);
      setOver(false);
      setEnd(t + total);
    },
    stop: () => setEnd(null),
  };
}

/**
 * The timer in the bar: a strip of tape with a tick for every second, and the time in figures. One click starts it,
 * another stops it, and the arrow beside it picks its length. While it runs the tape slides under the needle, a tick a
 * second, and each figure rolls over as it changes.
 */
function TimerControl({ timer }: { timer: Timer }) {
  const { minutes, running, over, left } = timer;
  const [menu, setMenu] = useState<{ anchor: DOMRect; trigger: HTMLElement } | null>(null);
  const secs = Math.ceil(left / 1000);
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const shell = "flex h-9 flex-none items-center rounded-full bg-surface shadow-[inset_0_0_0_1px_var(--line-2)]";
  const cell = "tap relative flex h-9 items-center text-ink transition-colors duration-(--duration-fast) hover:bg-surface-3 active:bg-line";

  if (over)
    return (
      <>
        <button
          type="button"
          onClick={timer.start}
          aria-label={`${minutes} minutes are up. Start another round`}
          data-tip={`Start another ${minutes} minutes`}
          className={`${shell} ${cell} animate-pop-in gap-2 pr-3.5 pl-3 text-footnote font-medium whitespace-nowrap`}
        >
          <span aria-hidden="true" className="size-1.5 flex-none rounded-full bg-accent" />
          <span className="@max-[420px]/bar:hidden">{minutes} minutes are up</span>
          <span className="@min-[420px]/bar:hidden">Time’s up</span>
        </button>
        <span role="status" className="sr-only">
          {minutes} minutes are up
        </span>
      </>
    );

  return (
    <div role="group" aria-label="Timer" className={shell}>
      <button
        type="button"
        onClick={running ? timer.stop : timer.start}
        aria-label={running ? `Stop the timer, ${Math.ceil(secs / 60)} minutes left` : `Start a ${minutes}-minute timer`}
        data-tip={running ? "Stop the timer" : `Start a ${minutes}-minute timer`}
        className={`${cell} gap-2.5 pl-3 ${running ? "rounded-full pr-3.5" : "rounded-l-full pr-2.5"}`}
      >
        <Tape running={running} />
        <span aria-hidden="true" className="tabular flex font-display text-[15px] leading-5 font-semibold tracking-[-0.01em]">
          {[...clock].map((c, i) => (c === ":" ? <span key={i} className="px-px text-ink-3">:</span> : <Figure key={i} value={c} />))}
        </span>
      </button>
      {!running && (
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={!!menu}
          aria-label={`Timer length: ${minutes} minutes. Change`}
          data-tip="Timer length"
          onClick={(e) => {
            const trigger = e.currentTarget;
            setMenu((m) => (m ? null : { anchor: trigger.getBoundingClientRect(), trigger }));
          }}
          className={`${cell} w-8 justify-center rounded-r-full border-l border-line-2 pr-0.5 text-ink-2!`}
        >
          <ChevronDown size={12} />
        </button>
      )}
      {menu && (
        <Menu
          anchor={menu.anchor}
          trigger={menu.trigger}
          align="end"
          label="Timer length"
          className="min-w-[148px]"
          onClose={() => setMenu(null)}
          entries={[{ heading: "Timer" }, ...FOCUS_MINUTES.map((m) => ({ label: `${m} min`, checked: m === minutes, onSelect: () => timer.pick(m) }))]}
        />
      )}
    </div>
  );
}

/**
 * The tape: ticks five pixels apart, every fifth one taller, under a needle. Running, it moves a tick a second (so the
 * strip repeats every five); at rest it lies still and pale.
 */
function Tape({ running }: { running: boolean }) {
  return (
    <span aria-hidden="true" className="relative block h-3.5 w-[52px] flex-none @max-[350px]/bar:hidden">
      <span
        className={`absolute inset-0 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_26%,#000_74%,transparent)] transition-opacity duration-(--duration-move) ${
          running ? "" : "opacity-45"
        }`}
      >
        <span
          className={`absolute inset-y-0 -right-[25px] left-0 ${running ? "animate-[tape_5s_linear_infinite]" : ""}`}
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, var(--ink) 0 1px, transparent 1px 25px), repeating-linear-gradient(90deg, color-mix(in srgb, var(--ink) 34%, transparent) 0 1px, transparent 1px 5px)",
            backgroundSize: "100% 10px, 100% 5px",
            backgroundPosition: "1px 50%, 1px 50%",
            backgroundRepeat: "no-repeat",
          }}
        />
      </span>
      <span
        className={`absolute -inset-y-px left-1/2 w-[2px] -translate-x-1/2 rounded-full transition-colors duration-(--duration-move) ${running ? "bg-accent" : "bg-ink-3"}`}
      />
    </span>
  );
}

/** A figure of the clock: when it changes, the old one leaves upward as the new one comes up from below. */
function Figure({ value }: { value: string }) {
  const last = useRef(value);
  const prev = last.current;
  useEffect(() => {
    last.current = value;
  }, [value]);
  return (
    <span className="relative block overflow-hidden">
      {prev !== value && (
        <span key={`${prev}${value}`} className="absolute inset-0 animate-[figure-out_var(--duration-base)_var(--ease-out)_both]">
          {prev}
        </span>
      )}
      <span key={value} className="block animate-[figure-in_var(--duration-base)_var(--ease-out)_both]">
        {value}
      </span>
    </span>
  );
}

/** The card's corner, and how far inside its edge the line runs. */
const CARD_RADIUS = 18;
const FUSE_INSET = 0.75;

/**
 * The timer on the task itself: a line that sets off from the top of the card in hand and travels round it clockwise,
 * so the frame closes as the time runs out. Its head glows a little. Stopped, the line reels back in; when the time is
 * up, the closed frame sends out one soft ring.
 */
function Fuse({ timer }: { timer: Timer }) {
  const box = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current?.parentElement;
    if (!el) return;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { running, over } = timer;
  const share = over ? 1 : running ? Math.min(1, 1 - timer.left / timer.total) : 0;
  let d = "";
  if (size) {
    const i = FUSE_INSET;
    const r = CARD_RADIUS - i;
    const [x0, y0, x1, y1] = [i, i, size.w - i, size.h - i];
    d = `M${size.w / 2} ${y0}H${x1 - r}A${r} ${r} 0 0 1 ${x1} ${y0 + r}V${y1 - r}A${r} ${r} 0 0 1 ${x1 - r} ${y1}H${x0 + r}A${r} ${r} 0 0 1 ${x0} ${y1 - r}V${y0 + r}A${r} ${r} 0 0 1 ${x0 + r} ${y0}Z`;
  }
  // A second at a time while it runs (so it glides); quicker when it's reeled back in.
  const glide = running ? "stroke-dashoffset 1s linear" : "stroke-dashoffset 520ms var(--ease-out)";
  const head = `opacity var(--duration-base) var(--ease-out), ${glide}`;
  return (
    <>
      <svg
        ref={box}
        aria-hidden="true"
        width={size?.w ?? 0}
        height={size?.h ?? 0}
        className={`pointer-events-none absolute inset-0 z-[4] overflow-visible transition-opacity duration-500 ${running || over ? "" : "opacity-0"}`}
        fill="none"
        stroke="var(--accent)"
      >
        {size && (
          <>
            <path d={d} pathLength={1} strokeWidth={1.5} strokeDasharray="1 1" strokeDashoffset={1 - share} style={{ transition: glide }} />
            <g strokeLinecap="round" strokeDasharray="0.0001 1" style={{ opacity: running ? 1 : 0, transition: "opacity var(--duration-base)" }}>
              <path d={d} pathLength={1} strokeWidth={13} strokeDashoffset={-share} className="animate-[fuse-halo_2.4s_ease-in-out_infinite]" style={{ transition: head }} />
              <path d={d} pathLength={1} strokeWidth={5} strokeDashoffset={-share} style={{ transition: head }} />
            </g>
          </>
        )}
      </svg>
      {over && <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-[4] animate-[fuse-over_1.5s_var(--ease-out)_2_both] rounded-[18px]" />}
    </>
  );
}

/**
 * The card that just left the deck because it was put off behind more than two others, kept for a moment as it last
 * looked so it can sink. A card that only moved within the deck isn't one: it travels there itself. (A finished card
 * isn't either: it turns to dust.)
 */
function useLeaving(deck: Task[], queue: Task[]) {
  const [leaving, setLeaving] = useState<Task | null>(null);
  const shown = useRef<Task | undefined>(deck[0]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const top = deck[0];
  const inDeck = deck.map((t) => t.id).join(" ");
  const waiting = queue.map((t) => t.id).join(" ");
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const was = shown.current;
    shown.current = top;
    if (!was || was.id === top?.id || inDeck.split(" ").includes(was.id) || !waiting.split(" ").includes(was.id)) return;
    setLeaving(was);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setLeaving(null), 420);
  }, [top, inDeck, waiting]);
  return leaving;
}

function AllDone({ isToday, onExit }: { isToday: boolean; onExit: () => void }) {
  // The dots above have all filled; this only says where things stand.
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-title-2 font-semibold tracking-[-0.02em]">{isToday ? "That was the last one." : "Everything on this day is done."}</p>
      <p className="mt-1 text-body text-ink-2">{isToday ? "Today’s list is finished." : "Nothing is left open here."}</p>
      <Button onClick={onExit} className="mt-6">
        Back to the list
      </Button>
    </div>
  );
}
