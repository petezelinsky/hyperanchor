"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Summary, SummaryInput } from "@/lib/summary";
import type { Usage } from "@/lib/types";
import { SparkIcon } from "../icons";
import { LiquidLens } from "../lens";
import { Accordion, Button } from "../ui";
import { PANEL } from "./parts";

/** About what a summary costs (the server sets this much aside, and counts what it really cost). */
const ABOUT = 3000;
const count = new Intl.NumberFormat("en-US");

type Saved = { hash: string; summary: Summary; tokens: number; at: number };

const PROBLEMS: Record<string, string> = {
  limit: "That’s all of today’s AI tokens. More tomorrow.",
  not_configured: "The summary isn’t set up on this server yet.",
  refused: "This one couldn’t be summarized.",
  busy: "Claude is busy right now. Try again in a moment.",
  failed: "The summary didn’t come through. Try again.",
  offline: "You’re offline. Try again when you’re back.",
};

/** A short, stable fingerprint of the data a summary was written from: a new one means the page has changed since. */
function fingerprint(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function read(key: string): Saved | null {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null") as Saved | null;
    return v && typeof v.hash === "string" && v.summary?.headline ? v : null;
  } catch {
    return null;
  }
}

/**
 * The AI summary at the top of Progress: a few lines on how the period went, written by Claude from the page's own
 * numbers and task titles, within the day's token allowance. It is kept on this device for the period, so coming back
 * costs nothing; a summary written before the data changed says so and can be written again. The press that asks for
 * it sends a ring of liquid glass over the whole page (lens.ts) while Claude reads.
 */
export function AiSummary({ input, store, noun }: { input: SummaryInput; store: string; noun: string }) {
  const hash = useMemo(() => fingerprint(JSON.stringify(input)), [input]);
  const [saved, setSaved] = useState<Saved | null>(() => read(store));
  useEffect(() => setSaved(read(store)), [store]);
  const [writing, setWriting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
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
    fetch("/api/usage")
      .then((r) => (r.ok ? (r.json() as Promise<Usage>) : null))
      .then((u) => alive.current && u && setLeft(u.today.left))
      .catch(() => {});
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => setProblem(null), [store]);

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
    // After the charts have grown in, and again whenever the page comes to rest after scrolling (phones have no hover to
    // take it on, and a picture is never taken at the press itself).
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
  }, [hash, saved, writing, problem]);

  const write = async () => {
    if (writing) return;
    setWriting(true);
    setProblem(null);
    try {
      const res = await fetch("/api/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!alive.current) return;
      if (res.status === 401) return window.location.reload();
      const body = (await res.json().catch(() => null)) as { summary?: Summary; tokens?: number; left?: number; error?: string } | null;
      if (!res.ok || !body?.summary) {
        setProblem(PROBLEMS[body?.error ?? "failed"] ?? PROBLEMS.failed);
        if (body?.error === "limit") setLeft(0);
      } else {
        const next: Saved = { hash, summary: body.summary, tokens: body.tokens ?? 0, at: Date.now() };
        setSaved(next);
        if (typeof body.left === "number") setLeft(body.left);
        try {
          localStorage.setItem(store, JSON.stringify(next));
        } catch {}
      }
    } catch {
      if (alive.current) setProblem(PROBLEMS.offline);
    }
    if (alive.current) setWriting(false);
  };

  // The ring starts where the button is pressed (held: deeper); a key press sends a light one from the button's middle.
  const press = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button > 0 || writing || !lens.current) return;
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
    if (e.detail === 0 && lens.current) {
      const r = e.currentTarget.getBoundingClientRect();
      lens.current.tap(r.left + r.width / 2, r.top + r.height / 2);
    }
    void write();
  };

  const stale = !!saved && saved.hash !== hash;
  const short = left !== null && left < ABOUT;
  const when = saved ? new Date(saved.at) : null;
  const written = when
    ? new Date().toDateString() === when.toDateString()
      ? `Written at ${when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
      : `Written on ${when.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : "";
  const leftText = left === null ? "" : `${count.format(left)} tokens left today`;

  return (
    <section ref={panel} aria-labelledby="ai-summary" aria-busy={writing} className={`min-w-0 overflow-hidden ${PANEL}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-5 md:px-6">
        <span aria-hidden="true" className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-surface-2 text-ink shadow-ring-line">
          <SparkIcon size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="ai-summary" className="text-body font-semibold text-ink">
            AI summary
          </h2>
          <p className="mt-0.5 text-footnote text-ink-3">
            {writing
              ? `Claude is reading your ${noun}…`
              : saved
                ? stale
                  ? `Written before your latest changes. ${leftText}`
                  : [written, `${count.format(saved.tokens)} tokens`, leftText].filter(Boolean).join(" · ")
                : `How this ${noun} went, in a few lines, written by Claude. Uses about ${count.format(ABOUT)} tokens${left === null ? "" : ` of your ${count.format(left)} left today`}.`}
          </p>
        </div>
        <Button
          variant={saved && !stale ? "secondary" : "primary"}
          disabled={writing || short}
          onPointerEnter={(e) => e.pointerType === "mouse" && void lens.current?.prepare()}
          onFocus={(e) => e.currentTarget.matches(":focus-visible") && void lens.current?.prepare()}
          onPointerDown={press}
          onClick={click}
          data-tip={short ? "Not enough tokens left today" : undefined}
          className="gap-2 max-sm:w-full"
        >
          {writing ? <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-[1.5px] border-current/30 border-t-current" /> : <SparkIcon size={14} />}
          {writing ? "Writing…" : saved ? "Write again" : "Summarize"}
        </Button>
      </div>

      {problem && !writing && (
        <p role="alert" className="border-t border-line px-5 py-3 text-footnote text-ink-2 md:px-6">
          {problem}
        </p>
      )}

      <Accordion open={!!saved}>
        {saved && (
          <div className={`grid gap-x-10 gap-y-5 border-t border-line px-5 pt-5 pb-6 transition-opacity duration-(--duration-base) md:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] ${writing || stale ? "opacity-55" : ""}`}>
            <div key={`${saved.at}-h`} className="min-w-0 animate-rise">
              <p className="font-display text-[20px] leading-[28px] font-semibold tracking-[-0.016em] text-ink text-pretty">{saved.summary.headline}</p>
              {saved.summary.next && (
                <p className="mt-4 text-body text-ink-2">
                  <span className="font-semibold text-ink">Next {noun}: </span>
                  {saved.summary.next}
                </p>
              )}
            </div>
            <ul className="min-w-0">
              {saved.summary.points.map((p, i) => (
                <li
                  key={`${saved.at}-${i}`}
                  className="flex animate-rise gap-3 border-b border-line py-2.5 text-body text-ink first:pt-0 last:border-0 last:pb-0"
                  style={{ animationDelay: `${80 + i * 70}ms` }}
                >
                  <span aria-hidden="true" className="mt-[7px] size-1.5 flex-none rounded-full bg-ink-3" />
                  <span className="min-w-0 text-pretty">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Accordion>
    </section>
  );
}
