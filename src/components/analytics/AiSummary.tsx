"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SummaryInput } from "@/lib/summary";
import { toUnlock, UNLOCK, type SavedSummary, type SummaryState } from "@/lib/summaries";
import type { Usage } from "@/lib/types";
import { ChevronDown, HistoryIcon, SparkIcon } from "../icons";
import { Orb } from "../voice/Orb";
import { LiquidLens } from "../lens";
import { motion, reducedMotion } from "../motion";
import { Accordion, Button } from "../ui";
import { PANEL } from "./parts";
import { SummaryBody, writtenAt } from "./SummaryBody";
import { SummaryHistory } from "./SummaryHistory";

/** About what a summary costs (the server sets this much aside, and counts what it really cost). */
const ABOUT = 3000;
const count = new Intl.NumberFormat("en-US");
const HIDDEN = "hyperanchor:summary-hidden";

/** Each period's state, kept while the page is open: coming back to a period shows its summary at once. */
const known = new Map<string, SummaryState>();

/**
 * Asks for several periods' states at once (the day, week, month and year on screen), so switching between them
 * finds each summary already there instead of opening a moment later.
 */
export function preloadSummaries(account: string, keys: string[]) {
  const missing = keys.filter((k) => !known.has(`${account}:${k}`));
  if (!missing.length) return;
  fetch(`/api/summaries?keys=${missing.join(",")}`)
    .then((r) => (r.ok ? (r.json() as Promise<{ states: Record<string, SummaryState> }>) : null))
    .then((b) => {
      if (b) for (const [k, s] of Object.entries(b.states)) if (!known.has(`${account}:${k}`)) known.set(`${account}:${k}`, s);
    })
    .catch(() => {});
}

const PROBLEMS: Record<string, string> = {
  limit: "That’s all of today’s AI tokens. More tomorrow.",
  not_configured: "The summary isn’t set up on this server yet.",
  refused: "This one couldn’t be summarized.",
  busy: "Claude is busy right now. Try again in a moment.",
  failed: "The summary didn’t come through. Try again.",
  offline: "You’re offline. Try again when you’re back.",
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Height follows the content: when what's inside changes (a skeleton becomes a summary), the box grows to it smoothly. */
function Morph({ k, children }: { k: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    const from = last.current;
    last.current = h;
    if (from == null || from === h || reducedMotion()) return;
    const a = el.animate([{ height: `${from}px`, overflow: "hidden" }, { height: `${h}px`, overflow: "hidden" }], { duration: 460, easing: motion().out });
    return () => a.cancel();
  }, [k]);
  return <div ref={ref}>{children}</div>;
}

/** While Claude reads: the shape of a summary, with a soft band of light passing over it. */
function Skeleton() {
  return (
    <div aria-hidden="true" className="border-t border-line px-5 pt-5 pb-6 md:px-6">
      <div className="skeleton h-[26px] w-[52%] rounded-md" />
      <div className="skeleton mt-2.5 h-[26px] w-[30%] rounded-md" />
      <div className="mt-5 grid gap-2.5 @3xl/analytics:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2 rounded-[12px] bg-surface-2 p-4 shadow-[inset_0_0_0_1px_var(--line)]">
            <div className="skeleton h-3 w-full rounded-full" style={{ animationDelay: `${i * 120}ms` }} />
            <div className="skeleton h-3 w-[86%] rounded-full" style={{ animationDelay: `${i * 120 + 60}ms` }} />
            <div className="skeleton h-3 w-[52%] rounded-full" style={{ animationDelay: `${i * 120 + 120}ms` }} />
          </div>
        ))}
      </div>
      <div className="skeleton mt-2.5 h-12 rounded-[12px]" />
    </div>
  );
}

/**
 * The AI summary at the top of Analytics: a few lines on how the period went, written by Claude from the page's own
 * numbers and task titles, within the day's token allowance, and kept (on the server) so it reads the same anywhere.
 *
 * It waits for the period to have something in it: UNLOCK tasks done (2 for a day, 8 for a week, 32 for a month), and
 * after each summary as many more again before the next one. Until then the button is off and says, on hover (or on a
 * tap), how many are still to go. A summary can be hidden; once there are two, they gather in a history where each can
 * be read again or deleted. The press that asks for one sends a ring of liquid glass over the page (lens.ts) while the
 * panel opens on a skeleton, which grows into the summary as it comes into focus.
 */
export function AiSummary({ input, done, noun, account }: { input: SummaryInput & { start: string; end: string }; done: number; noun: string; account: string }) {
  const { period, start } = input;
  const key = `${account}:${period}:${start}`;
  const [state, setState] = useState<SummaryState | null>(() => known.get(key) ?? null);
  const [writing, setWriting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [hidden, setHidden] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [history, setHistory] = useState(false);
  // While the lens plays over the page (on a picture of it), the panel holds what it showed; what changed underneath
  // starts to show once the picture has faded, so the summary is seen arriving rather than appearing in a cut.
  const [held, setHeld] = useState(false);
  const alive = useRef(true);
  const panel = useRef<HTMLElement>(null);
  const lens = useRef<LiquidLens | null>(null);
  // Every redraw of the page counts as a change: a picture taken before it is not played.
  const drawn = useRef(0);
  useEffect(() => {
    drawn.current += 1;
  });

  useEffect(() => {
    alive.current = true;
    try {
      setHidden(localStorage.getItem(HIDDEN) === "1");
      // Summaries used to be kept in this browser; they live on the server now, so the old copies go.
      for (const k of Object.keys(localStorage)) if (k.startsWith("hyperanchor:summary:")) localStorage.removeItem(k);
    } catch {}
    fetch("/api/usage")
      .then((r) => (r.ok ? (r.json() as Promise<Usage>) : null))
      .then((u) => alive.current && u && setLeft(u.today.left))
      .catch(() => {});
    return () => {
      alive.current = false;
    };
  }, []);

  // The period's summary: what's known at once, then what the server says.
  useEffect(() => {
    setState(known.get(key) ?? null);
    setProblem(null);
    setFresh(null);
    let live = true;
    fetch(`/api/summaries?period=${period}&start=${start}`)
      .then((r) => (r.ok ? (r.json() as Promise<SummaryState>) : null))
      .then((s) => {
        if (!live || !s) return;
        known.set(key, s);
        setState(s);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [key, period, start]);

  const keep = (s: SummaryState) => {
    known.set(key, s);
    setState(s);
  };

  // The lens: its picture of the page is taken once the page has settled, and again when it changes or the pointer comes
  // near the button; never at the press itself.
  useEffect(() => {
    if (!LiquidLens.supported()) return;
    const l = new LiquidLens(
      () => panel.current?.closest("main") ?? null,
      () => panel.current?.closest<HTMLElement>("[data-lens]") ?? null,
      () => String(drawn.current),
    );
    lens.current = l;
    return () => {
      l.destroy();
      lens.current = null;
    };
  }, []);
  useEffect(() => {
    const l = lens.current;
    if (!l) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const later = (ms: number) =>
      setTimeout(() => {
        if (w.requestIdleCallback) w.requestIdleCallback(() => void l.prepare(), { timeout: 2000 });
        else void l.prepare();
      }, ms);
    let timer = later(900);
    const scrolled = () => {
      clearTimeout(timer);
      timer = later(300);
    };
    window.addEventListener("scroll", scrolled, { capture: true, passive: true });
    window.addEventListener("resize", scrolled, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", scrolled, { capture: true });
      window.removeEventListener("resize", scrolled);
    };
  }, [state, writing, problem, hidden]);

  const current = state?.current ?? null;
  const since = state?.since ?? null;
  const remaining = state ? toUnlock(period, done, since) : 0;
  const short = left !== null && left < ABOUT;
  const phrase = period === "day" ? (input.current ? "today" : "that day") : `this ${noun}`;
  const tasks = (n: number) => plural(n, "more task");
  const why = !state
    ? undefined
    : remaining > 0
      ? current || since != null
        ? `Write again after ${tasks(remaining)} done ${phrase}`
        : `Finish ${tasks(remaining)} ${phrase} to unlock the summary`
      : short
        ? "Not enough AI tokens left today. More tomorrow."
        : undefined;
  const can = !!state && !writing && !why;

  const write = async () => {
    setWriting(true);
    setProblem(null);
    setFresh(null);
    try {
      const res = await fetch("/api/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!alive.current) return;
      if (res.status === 401) return window.location.reload();
      const body = (await res.json().catch(() => null)) as { saved?: SavedSummary | null; left?: number; error?: string; done?: number; need?: number } | null;
      if (!res.ok || !body?.saved) {
        if (body?.error === "locked" && typeof body.done === "number" && typeof body.need === "number") {
          // The server counts the period's tasks itself: its numbers stand.
          const n = body.need - body.done;
          setProblem(`${tasks(n)} to finish ${phrase} before the ${current ? "next " : ""}summary.`);
        } else {
          setProblem(PROBLEMS[body?.error ?? "failed"] ?? PROBLEMS.failed);
          if (body?.error === "limit") setLeft(0);
        }
      } else {
        const saved = body.saved;
        keep({ current: saved, since: saved.done, total: (state?.total ?? 0) + 1 });
        setFresh(saved.id);
        if (typeof body.left === "number") setLeft(body.left);
        if (hidden) toggleHidden(false);
      }
    } catch {
      if (alive.current) setProblem(PROBLEMS.offline);
    }
    if (alive.current) setWriting(false);
  };

  const toggleHidden = (next = !hidden) => {
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN, next ? "1" : "0");
    } catch {}
  };

  // The ring starts where the button is pressed (held: deeper); a key press sends a light one from the button's middle.
  const press = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button > 0 || !can || !lens.current) return;
    if (!lens.current.press(e.clientX, e.clientY)) return;
    const up = () => {
      lens.current?.release();
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const click = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!can) {
      // Off: a tap (no hover on phones) says why, in the panel.
      if (why) setProblem(`${why}.`);
      return;
    }
    const l = lens.current;
    if (e.detail === 0 && l) {
      const r = e.currentTarget.getBoundingClientRect();
      l.tap(r.left + r.width / 2, r.top + r.height / 2);
    }
    if (l?.playing()) {
      setHeld(true);
      void l.ended().then(() => alive.current && setHeld(false));
    }
    void write();
  };

  // What the panel's body shows: the skeleton while Claude reads, the summary, or nothing; held still under the lens.
  type View = { kind: "none" } | { kind: "skeleton" } | { kind: "summary"; s: SavedSummary; fresh: boolean };
  const actual: View = writing ? { kind: "skeleton" } : current && !hidden ? { kind: "summary", s: current, fresh: fresh === current.id } : { kind: "none" };
  const frozen = useRef<View>(actual);
  if (!held) frozen.current = actual;
  const view = held ? frozen.current : actual;
  // What it last showed stays in place while the panel folds away (an empty box can't fold smoothly).
  const body = useRef<View>(view);
  if (view.kind !== "none") body.current = view;
  const shown = body.current;

  const doneSince = Math.max(0, done - (since ?? 0));
  const line = writing
    ? `Claude is reading your ${noun}…`
    : current
      ? [`Written ${writtenAt(current.createdAt)}`, `${count.format(current.tokens)} tokens`, hidden ? "hidden" : ""].filter(Boolean).join(" · ")
      : !state
        ? `How this ${noun} went, in a few lines, written by Claude.`
        : remaining > 0
          ? since != null
            ? `The next summary unlocks after ${tasks(remaining)} done ${phrase}.`
            : `Unlocks once ${UNLOCK[period]} tasks are done ${phrase}: ${remaining} to go.`
          : `How this ${noun} went, in a few lines, written by Claude. About ${count.format(ABOUT)} tokens${left === null ? "" : ` of your ${count.format(left)} left today`}.`;

  return (
    <section ref={panel} aria-labelledby="ai-summary" aria-busy={writing} className={`min-w-0 overflow-hidden ${PANEL}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-5 md:px-6">
        {/* The sphere stands for the AI; it thinks for as long as the summary is being written. */}
        <span aria-hidden="true" className="flex size-10 flex-none items-center justify-center rounded-full bg-surface-2 shadow-ring-line">
          <Orb size={30} active={writing} className="text-ink" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="ai-summary" className="text-body font-semibold text-ink">
            AI summary
          </h2>
          <p className="mt-0.5 text-footnote text-ink-3">{line}</p>
          {state && !writing && !current && remaining > 0 && (
            // How close the summary is: a pill for every task it takes (a line for the many a year takes).
            <div aria-hidden="true" className="mt-2.5 flex h-1.5 max-w-[280px] gap-[3px]">
              {UNLOCK[period] <= 32 ? (
                Array.from({ length: UNLOCK[period] }, (_, i) => <span key={i} className={`min-w-0 flex-1 rounded-full ${i < doneSince ? "bg-accent" : "bg-surface-3"}`} />)
              ) : (
                <span className="flex-1 overflow-hidden rounded-full bg-surface-3">
                  <span className="block h-full origin-left rounded-full bg-accent" style={{ transform: `scaleX(${Math.min(1, doneSince / UNLOCK[period])})` }} />
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 @max-xl/analytics:w-full">
          {!!state && state.total >= 2 && (
            <Button variant="plain" size="sm" onClick={() => setHistory(true)} aria-haspopup="dialog" data-tip="Every summary written" className="gap-1.5 text-ink-2!">
              <HistoryIcon size={14} />
              History
            </Button>
          )}
          {current && !writing && (
            <Button variant="plain" size="sm" onClick={() => toggleHidden()} aria-expanded={!hidden} className="gap-1 text-ink-2!">
              {hidden ? "Show" : "Hide"}
              <ChevronDown size={13} className={`transition-transform duration-(--duration-base) ${hidden ? "" : "rotate-180"}`} />
            </Button>
          )}
          <Button
            variant={current ? "secondary" : "primary"}
            aria-disabled={!can}
            onPointerEnter={(e) => e.pointerType === "mouse" && can && void lens.current?.prepare()}
            onFocus={(e) => e.currentTarget.matches(":focus-visible") && can && void lens.current?.prepare()}
            onPointerDown={press}
            onClick={click}
            data-tip={why}
            className={`ml-1 gap-2 @max-xl/analytics:ml-auto ${can || writing ? "" : "cursor-default opacity-40"}`}
          >
            {writing ? <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-[1.5px] border-current/30 border-t-current" /> : <SparkIcon size={14} />}
            {writing ? "Writing…" : current ? "Write again" : "Summarize"}
          </Button>
        </div>
      </div>

      {problem && !writing && (
        <p role="status" className="animate-[fade_var(--duration-fast)_var(--ease-out)_both] border-t border-line px-5 py-3 text-footnote text-ink-2 md:px-6">
          {problem}
        </p>
      )}

      <Accordion open={view.kind !== "none"}>
        <Morph k={shown.kind === "summary" ? shown.s.id : shown.kind}>
          {shown.kind === "skeleton" ? (
            <Skeleton />
          ) : shown.kind === "summary" ? (
            <SummaryBody s={shown.s} noun={noun} fresh={shown.fresh} className="border-t border-line px-5 pt-5 pb-6 md:px-6" />
          ) : null}
        </Morph>
      </Accordion>

      {history && (
        <SummaryHistory
          onClose={() => setHistory(false)}
          onDeleted={(id) => {
            // Deleted here: the period shows no summary, and the next still waits (the count it was written at stays).
            known.forEach((s, k) => {
              const gone = s.current?.id === id;
              known.set(k, { ...s, current: gone ? null : s.current, total: Math.max(0, s.total - 1) });
            });
            const s = known.get(key);
            if (s) setState(s);
          }}
        />
      )}
    </section>
  );
}
