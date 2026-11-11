"use client";

/**
 * How things move, from the motion tokens (design/tokens.json, as CSS variables on :root). Only transform and opacity
 * animate, with the Web Animations API, and only for what's on screen; the two exceptions are the height of a list
 * opening or closing and a deleted row folding away. With reduced motion a move becomes a short fade.
 */

type Tokens = { press: number; fast: number; base: number; move: number; data: number; reduced: number; out: string; in: string; spring: string };

let tokens: Tokens | null = null;
export function motion(): Tokens {
  if (tokens) return tokens;
  const css = getComputedStyle(document.documentElement);
  // The built CSS may write a duration either way ("240ms" or ".24s").
  const ms = (name: string, fallback: number) => {
    const v = css.getPropertyValue(`--duration-${name}`).trim();
    const n = parseFloat(v);
    return Number.isNaN(n) ? fallback : v.endsWith("ms") ? n : n * 1000;
  };
  const ease = (name: string) => css.getPropertyValue(`--ease-${name}`).trim() || "ease";
  return (tokens = {
    press: ms("press", 100),
    fast: ms("fast", 160),
    base: ms("base", 240),
    move: ms("move", 360),
    data: ms("data", 600),
    reduced: ms("reduced", 120),
    out: ease("out"),
    in: ease("in"),
    spring: ease("spring"),
  });
}

export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** An exit takes about 70% of the entrance, easing in. */
export const exitMs = () => Math.round(motion().fast * 0.7);

const onScreen = (r: DOMRect) => r.bottom > 0 && r.top < window.innerHeight && r.width > 0;

// ── Rows that change place (FLIP) ────────────────────────────────────────────

/** A task's row anywhere on the page: a list row or card, or a line in the earlier-days and left-open lists. */
const rowsOnPage = () => document.querySelectorAll<HTMLElement>("[data-task-row], [data-flip]");
const idOf = (el: HTMLElement) => el.dataset.taskRow ?? el.dataset.flip ?? "";
const rowOf = (id: string) => document.querySelector<HTMLElement>(`[data-task-row="${id}"], [data-flip="${id}"]`);

// What waits for the next render, with when it was asked for: anything that doesn't get its render within a second is
// dropped, so it can't play later, out of place.
let before: Map<string, DOMRect> | null = null;
let beforeAt = 0;
let lead: string | null = null;
const unfold = new Map<string, number>();
const appear = new Map<string, number>();
const pulses = new Map<string, number>();
const STALE = 1000;
const fresh = (at: number) => performance.now() - at < STALE;

/**
 * Call right before a change that moves rows: remembers where every row on screen is. `leadId` is the row that travels
 * (it lands with a little spring); the others make room.
 */
export function prepareFlip(leadId?: string) {
  before = new Map();
  beforeAt = performance.now();
  for (const el of rowsOnPage()) {
    const r = el.getBoundingClientRect();
    if (onScreen(r)) before.set(idOf(el), r);
  }
  lead = leadId ?? null;
}

/** A row that comes back (Undo after a delete) opens up in its place on the next render. */
export const unfoldOnRender = (id: string) => unfold.set(id, performance.now());

/** A row that arrives from off screen (Undo after a move to another day) fades in on the next render. */
export const appearOnRender = (id: string) => appear.set(id, performance.now());

/** A day in the calendar answers with its dot on the next render: a task just moved there. */
export const pulseDayOnRender = (date: string) => pulses.set(date, performance.now());

/** After React has changed the page (a layout effect): moves each row from where it was to where it is. */
export function playFlip() {
  const m = motion();
  const still = reducedMotion();
  if (before && !fresh(beforeAt)) before = null;
  if (before) {
    const was = before;
    before = null;
    for (const el of rowsOnPage()) {
      const id = idOf(el);
      const a = was.get(id);
      if (!a) continue;
      const b = el.getBoundingClientRect();
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      if (still) {
        if (id === lead) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: m.reduced });
        continue;
      }
      const isLead = id === lead;
      if (isLead) el.style.zIndex = "1";
      const anim = el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
        duration: isLead ? m.move : m.base,
        easing: isLead ? m.spring : m.out,
      });
      if (isLead) anim.finished.catch(() => {}).then(() => (el.style.zIndex = ""));
    }
  }
  for (const [id, at] of unfold) {
    const el = rowOf(id);
    if (!el || !fresh(at)) {
      if (!fresh(at)) unfold.delete(id);
      continue;
    }
    unfold.delete(id);
    if (still) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: m.reduced });
      continue;
    }
    const h = el.offsetHeight;
    el.style.overflow = "hidden";
    el.animate([{ height: "0px", opacity: 0 }, { height: `${h}px`, opacity: 1 }], { duration: m.base, easing: m.out })
      .finished.catch(() => {})
      .then(() => (el.style.overflow = ""));
  }
  for (const [id, at] of appear) {
    const el = rowOf(id);
    if (!el && fresh(at)) continue;
    appear.delete(id);
    if (el) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: still ? m.reduced : m.fast, easing: m.out });
  }
  for (const [date, at] of pulses) {
    pulses.delete(date);
    if (fresh(at)) pulseDay(date);
  }
}

/** The day's dot in the calendar (and in the phone's week strip) answers: something just arrived there. */
export function pulseDay(date: string) {
  if (reducedMotion()) return;
  const m = motion();
  for (const dot of document.querySelectorAll<HTMLElement>(`[data-day-dot="${date}"]`)) {
    if (!onScreen(dot.getBoundingClientRect())) continue;
    dot.animate([{ transform: "scale(1)" }, { transform: "scale(2)" }, { transform: "scale(1)" }], { duration: m.move, easing: m.out });
  }
}

/**
 * A task dropped on a day in the calendar: the card that followed the pointer shrinks into a dot and flies into that
 * day, which answers when it lands.
 */
export function flyIntoDay(card: HTMLElement | null, date: string) {
  const day = document.querySelector<HTMLElement>(`[data-drop-zone="calendar"][data-drop-date="${date}"]`);
  if (!card || !day || reducedMotion()) return;
  const m = motion();
  const from = card.getBoundingClientRect();
  const to = day.getBoundingClientRect();
  const copy = card.cloneNode(true) as HTMLElement;
  copy.setAttribute("aria-hidden", "true");
  for (const el of [copy, ...copy.querySelectorAll<HTMLElement>("*")]) el.style.animation = "none";
  copy.style.transformOrigin = "center";
  document.body.appendChild(copy);
  const at = (x: number, y: number, s: number) => `translate(${x}px, ${y}px) scale(${s})`;
  copy
    .animate(
      [
        { transform: at(from.left, from.top, 1), opacity: 1 },
        { transform: at(to.left + to.width / 2 - from.width / 2, to.top + to.height / 2 - from.height / 2, 0.08), opacity: 0.3 },
      ],
      { duration: m.fast + m.move, easing: m.in, fill: "forwards" },
    )
    .finished.catch(() => {})
    .then(() => {
      copy.remove();
      pulseDay(date);
    });
}

/**
 * A row leaves its list (deleted): it folds away (its height closes, so the rows below rise with it), then `done` runs.
 * Off screen, or without motion, `done` runs at once (after a short fade without motion).
 */
export function foldAway(id: string, done: () => void) {
  const el = rowOf(id);
  const m = motion();
  if (!el || !onScreen(el.getBoundingClientRect())) return done();
  if (reducedMotion()) {
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: m.reduced, fill: "forwards" }).finished.catch(() => {}).then(done);
    return;
  }
  el.style.overflow = "hidden";
  el.style.pointerEvents = "none";
  el.animate([{ height: `${el.offsetHeight}px`, opacity: 1 }, { height: "0px", opacity: 0 }], { duration: m.base, easing: m.in, fill: "forwards" })
    .finished.catch(() => {})
    .then(done);
}

/**
 * A row leaves for another day that isn't on screen: it slides 24px toward that day and fades, then `done` runs (and
 * the day answers in the calendar). Without motion, or off screen, `done` runs at once.
 */
export function slideAway(id: string, later: boolean, done: () => void) {
  const el = rowOf(id);
  if (!el || reducedMotion() || !onScreen(el.getBoundingClientRect())) return done();
  const m = motion();
  el.style.pointerEvents = "none";
  el.animate([{ transform: "none", opacity: 1 }, { transform: `translateX(${later ? 24 : -24}px)`, opacity: 0 }], { duration: m.base, easing: m.in, fill: "forwards" })
    .finished.catch(() => {})
    .then(done);
}

/** Calls off a row's fold or slide (Undo arrived while it was leaving): it's back as it was. */
export function cancelLeaving(id: string) {
  const el = rowOf(id);
  if (!el) return;
  for (const a of el.getAnimations()) a.cancel();
  el.style.overflow = "";
  el.style.pointerEvents = "";
}

// ── Exits ────────────────────────────────────────────────────────────────────

/**
 * Lets an element that React is about to remove leave gently: a copy stays in its place for the length of an exit,
 * fading (and settling a little), and is then removed. Call from a layout effect's cleanup.
 */
export function exitCopy(node: HTMLElement | null, settle: "down" | "shrink" | "fade" = "shrink") {
  if (!node || !node.isConnected || reducedMotion()) return;
  const parent = node.parentElement;
  if (!parent) return;
  const copy = node.cloneNode(true) as HTMLElement;
  copy.setAttribute("aria-hidden", "true");
  copy.inert = true;
  copy.style.pointerEvents = "none";
  copy.removeAttribute("id");
  parent.appendChild(copy);
  copy
    .animate(settle === "fade" ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: settle === "down" ? "translateY(6px)" : "scale(0.98)" }], {
      duration: exitMs(),
      easing: motion().in,
      fill: "forwards",
    })
    .finished.catch(() => {})
    .then(() => copy.remove());
}
