"use client";

import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { exitCopy } from "./motion";

// ── Buttons ──────────────────────────────────────────────────────────────────

type Variant = "primary" | "secondary" | "plain" | "danger" | "danger-quiet";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover active:scale-[0.98]",
  secondary: "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-surface-3 active:scale-[0.98]",
  plain: "text-ink-2 hover:bg-surface-3 hover:text-ink active:bg-line",
  // Red only for what can't be undone.
  danger: "bg-red-ink text-surface hover:opacity-90 active:scale-[0.98]",
  "danger-quiet": "bg-surface text-red-ink shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-red-soft active:scale-[0.98]",
};
const sizes: Record<Size, string> = {
  sm: "h-7 rounded-sm px-2.5 text-footnote",
  md: "h-8 rounded-sm px-3 text-footnote",
  lg: "h-11 rounded-sm px-5 text-callout",
};
const iconSizes: Record<Size, string> = { sm: "size-7 rounded-sm", md: "size-8 rounded-sm", lg: "size-11 rounded-sm" };
const base = "tap relative transition-[background-color,color,box-shadow,transform] duration-(--duration-fast) ease-out select-none disabled:pointer-events-none";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

/** A button's look, for the odd link that should read as a button (a download, say). */
export const buttonClass = (variant: Variant = "secondary", size: Size = "md") =>
  `inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap disabled:opacity-40 ${base} ${variants[variant]} ${sizes[size]}`;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className = "", type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={`${buttonClass(variant, size)} ${className}`} {...props} />;
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { label: string; tip?: string }>(function IconButton(
  { variant = "plain", size = "md", className = "", label, tip, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      data-tip={tip ?? label}
      className={`inline-flex flex-none items-center justify-center disabled:opacity-35 ${base} ${variants[variant]} ${iconSizes[size]} ${className}`}
      {...props}
    />
  );
});

// ── Segmented control: a raised thumb slides over a recessed track ──────────

/** Arrow keys move through a radio group and select (WAI-ARIA radio pattern); only the checked radio is tabbable. */
export function radioKeys<T>(e: React.KeyboardEvent<HTMLElement>, values: T[], value: T, onChange: (v: T) => void) {
  const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
  if (!step) return;
  e.preventDefault();
  const i = (Math.max(0, values.indexOf(value)) + step + values.length) % values.length;
  onChange(values[i]);
  e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[i]?.focus();
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
  className = "",
}: {
  /** null: none of them (the view switch while Progress is on screen). */
  value: T | null;
  /** With `iconOnly`, the label becomes the radio's accessible name and tooltip. */
  options: { value: T; label: string; icon?: React.ReactNode; iconOnly?: boolean; tip?: string }[];
  onChange: (v: T) => void;
  label: string;
  size?: "md" | "lg";
  className?: string;
}) {
  const found = options.findIndex((o) => o.value === value);
  const index = Math.max(0, found);
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={(e) =>
        radioKeys(
          e,
          options.map((o) => o.value),
          value ?? options[0].value,
          onChange,
        )
      }
      className={`relative grid rounded-[9px] bg-surface-2 p-0.5 shadow-[inset_0_0_0_1px_var(--line)] ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0.5 left-0.5 rounded-[7px] bg-surface shadow-lift transition-[transform,opacity] duration-(--duration-base) ease-out ${found < 0 ? "opacity-0" : ""}`}
        style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.iconOnly ? o.label : undefined}
            data-tip={o.iconOnly ? o.label : o.tip}
            tabIndex={on || (found < 0 && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`tap relative flex items-center justify-center gap-1.5 rounded-[7px] whitespace-nowrap transition-colors duration-(--duration-fast) ${
              size === "lg" ? "h-8 px-3 text-footnote" : "h-7 px-3 text-footnote"
            } ${on ? "font-semibold text-ink" : "font-medium text-ink-3 hover:text-ink"}`}
          >
            {o.icon}
            {!o.iconOnly && o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Checkbox: a soft square with a firm edge; completing it pops, fills and draws the tick ──

export function Checkbox({
  checked,
  onToggle,
  label,
  size = 20,
  className = "",
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  size?: number;
  className?: string;
}) {
  // The tick keeps the same weight on screen (about 1.6px) in a box of any size.
  const tick = (1.6 * 12) / (size * 0.72);
  // Animate only a change the user just made, not tasks that were already done when they rendered.
  const [celebrate, setCelebrate] = useState(false);
  const prev = useRef(checked);
  useEffect(() => {
    if (prev.current === checked) return;
    prev.current = checked;
    setCelebrate(checked);
  }, [checked]);

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      style={{
        width: size,
        height: size,
        borderRadius: size <= 16 ? 5 : size <= 20 ? 6 : 8,
        animation: celebrate ? "check-pop var(--duration-move) var(--ease-out)" : undefined,
      }}
      className={`group/check relative flex flex-none items-center justify-center border-[1.5px] transition-[background-color,border-color] duration-(--duration-fast) before:absolute before:-inset-1.5 before:content-[''] pointer-coarse:before:inset-auto pointer-coarse:before:top-1/2 pointer-coarse:before:left-1/2 pointer-coarse:before:size-11 pointer-coarse:before:-translate-1/2 ${
        checked ? "border-accent bg-accent text-on-accent" : "border-check-ring bg-surface text-ink-4 hover:border-ink"
      } ${className}`}
    >
      {celebrate && (
        <span aria-hidden="true" className="pointer-events-none absolute -inset-[1.5px] rounded-[inherit] bg-accent" style={{ animation: "ripple var(--duration-data) var(--ease-out) both" }} />
      )}
      {/* Under the pointer an open box shows the tick it would get. */}
      {!checked && (
        <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 12 12" fill="none" aria-hidden="true" className="opacity-0 transition-opacity duration-(--duration-fast) pointer-fine:group-hover/check:opacity-100">
          <path d="M2.6 6.3 5 8.6 9.4 3.7" stroke="currentColor" strokeWidth={tick} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {checked && (
        <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 12 12" fill="none" aria-hidden="true" className="relative">
          <path
            d="M2.6 6.3 5 8.6 9.4 3.7"
            stroke="currentColor"
            strokeWidth={tick}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="16"
            style={{ animation: celebrate ? "check-draw var(--duration-base) 60ms var(--ease-out) both" : undefined }}
          />
        </svg>
      )}
    </button>
  );
}

// ── Progress ring ────────────────────────────────────────────────────────────

/** A small ring that fills with the accent (0…1). */
export function ProgressRing({ value, size = 16, stroke = 2.5, className = "" }: { value: number | null; size?: number; stroke?: number; className?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value ?? 0));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className={`flex-none -rotate-90 ${className}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent-track)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - v)}
        style={{ opacity: v > 0 ? 1 : 0 }}
        className="transition-[stroke-dashoffset] duration-(--duration-data) ease-out"
      />
    </svg>
  );
}

// ── Celebration ──────────────────────────────────────────────────────────────

const BURST = ["var(--accent)", "var(--ink-3)", "var(--accent-track)", "var(--accent)", "var(--ink-4)", "var(--accent)", "var(--accent-track)", "var(--ink-3)"];

/** Wraps a small mark; when `active` turns on (not on first render), a ring of confetti bursts from it. */
export function Burst({ active, children }: { active: boolean; children: React.ReactNode }) {
  const [key, setKey] = useState(0);
  const prev = useRef(active);
  useEffect(() => {
    if (active && !prev.current) setKey((k) => k + 1);
    prev.current = active;
  }, [active]);
  return (
    <span className="relative inline-flex">
      {children}
      {key > 0 && (
        <span key={key} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/2">
          {BURST.map((c, i) => (
            <span
              key={i}
              className="absolute top-0 left-0 size-[5px] rounded-full"
              style={{ background: c, "--a": `${i * 45 + 20}deg`, "--r": `${16 + (i % 3) * 5}px`, animation: `burst var(--duration-data) ${i * 15}ms var(--ease-out) both` } as React.CSSProperties}
            />
          ))}
        </span>
      )}
    </span>
  );
}

// ── Floating surfaces (menus, popovers) ──────────────────────────────────────

export type Anchor = DOMRect | { x: number; y: number };

/** Positions a floating panel next to an anchor rect (or at a point), flipped and clamped into the viewport. */
function useFloating(anchor: Anchor, align: "start" | "end") {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; origin: string } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Layout size, not getBoundingClientRect: the panel is mid scale-in animation here.
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const m = 8;
    let left: number;
    let top: number;
    let below = true;
    if ("width" in anchor) {
      left = align === "end" ? anchor.right - w : anchor.left;
      top = anchor.bottom + 6;
      if (top + h > vh - m && anchor.top - h - 6 > m) {
        top = anchor.top - h - 6;
        below = false;
      }
    } else {
      left = anchor.x;
      top = anchor.y;
      if (left + w > vw - m) left = anchor.x - w;
      if (top + h > vh - m) {
        top = anchor.y - h;
        below = false;
      }
    }
    const x = Math.min(Math.max(m, left), vw - w - m);
    const y = Math.min(Math.max(m, top), vh - h - m);
    setPos({ left: x, top: y, origin: `${align === "end" ? "right" : "left"} ${below ? "top" : "bottom"}` });
  }, [anchor, align]);

  return {
    ref,
    /** Positioned and visible: only now can it take focus. */
    ready: !!pos,
    style: { left: pos?.left ?? 0, top: pos?.top ?? 0, transformOrigin: pos?.origin, visibility: pos ? "visible" : "hidden" } as const,
  };
}

/** Everything that's open and can be dismissed, in the order it opened: only the last one answers Escape and clicks. */
const layers: object[] = [];

/**
 * Closes on Escape and on pointer down outside `ref` (and outside `ignore`, usually the trigger that toggles it).
 * Layers close one at a time, the top one first: a menu opened from a window takes the Escape (or the click outside)
 * and the window stays. Anchored panels (menus, popovers) also close on resize and when the page scrolls under them;
 * modals don't.
 */
export function useDismiss(
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  enabled = true,
  ignore?: HTMLElement | null,
  anchored = true,
) {
  // Its place among the layers is taken once, when it opens (not again whenever a handler changes).
  const self = useRef({});
  useEffect(() => {
    if (!enabled) return;
    const layer = self.current;
    layers.push(layer);
    return () => void layers.splice(layers.indexOf(layer), 1);
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    const opened = performance.now();
    const onTop = () => layers[layers.length - 1] === self.current;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (onTop() && ref.current && !ref.current.contains(t) && !ignore?.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onTop()) {
        e.stopPropagation();
        onClose();
      }
    };
    // Ignore the scroll that opening may cause (keeping a selected row in view) and scrolling inside the panel.
    const onScroll = (e: Event) => {
      if (performance.now() - opened < 400 || ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    if (anchored) {
      window.addEventListener("resize", onClose);
      window.addEventListener("scroll", onScroll, true);
    }
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [ref, onClose, enabled, ignore, anchored]);
}

/** A menu or popover leaving: a copy of it fades out in its place (motion.ts) as React removes it. */
function useLeaveGently(ref: React.RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    return () => exitCopy(el);
  }, [ref]);
}

export function Popover({
  anchor,
  onClose,
  align = "start",
  className = "",
  label,
  trigger,
  children,
}: {
  anchor: Anchor;
  onClose: () => void;
  align?: "start" | "end";
  className?: string;
  label: string;
  trigger?: HTMLElement | null;
  children: React.ReactNode;
}) {
  const { ref, style, ready } = useFloating(anchor, align);
  useDismiss(ref, onClose, true, trigger);
  useLeaveGently(ref);
  // Focus the field marked data-autofocus once the panel is visible (focus() does nothing while it's hidden).
  useEffect(() => {
    if (ready) ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, [ready, ref]);
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      data-floating=""
      style={style}
      className={`fixed z-[100] animate-pop-in rounded-lg bg-elevated shadow-float ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}

export type MenuEntry =
  /** `checked` makes the item one of a set of choices (a tick marks the current one). */
  | { label: string; onSelect: () => void; destructive?: boolean; disabled?: boolean; shortcut?: string; hint?: string; icon?: React.ReactNode; checked?: boolean }
  | { separator: true }
  | { heading: string };

export function Menu({
  anchor,
  entries,
  onClose,
  align = "start",
  label = "Menu",
  trigger,
  header,
  className = "min-w-[220px]",
}: {
  anchor: Anchor;
  entries: MenuEntry[];
  onClose: () => void;
  align?: "start" | "end";
  label?: string;
  trigger?: HTMLElement | null;
  /** Shown above the items (who is signed in, in the account menu). */
  header?: React.ReactNode;
  className?: string;
}) {
  const { ref, style, ready } = useFloating(anchor, align);
  const [active, setActive] = useState(-1);
  useDismiss(ref, onClose, true, trigger);
  useLeaveGently(ref);
  const items = entries.map((e, i) => ({ e, i })).filter(({ e }) => "onSelect" in e && !e.disabled);

  // Take focus once visible, so the arrow keys and Enter work right away; on close, hand it back to the
  // button that opened the menu unless something else (an editor, a dialog) has taken it.
  useEffect(() => {
    if (!ready) return;
    ref.current?.focus();
    return () => {
      if (trigger?.isConnected && document.activeElement === document.body) trigger.focus({ preventScroll: true });
    };
  }, [ready, ref, trigger]);

  const run = (e: MenuEntry) => {
    if (!("onSelect" in e) || e.disabled) return;
    onClose();
    e.onSelect();
  };

  const onKeyDown = (ev: React.KeyboardEvent) => {
    const at = items.findIndex(({ i }) => i === active);
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      const next = ev.key === "ArrowDown" ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
      setActive(items[next]?.i ?? -1);
    } else if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      if (active >= 0) run(entries[active]);
    } else if (ev.key === "Tab") {
      onClose();
    }
  };

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      tabIndex={-1}
      data-floating=""
      onKeyDown={onKeyDown}
      style={style}
      className={`fixed z-[140] animate-pop-in rounded-lg bg-elevated p-1 text-footnote shadow-float outline-none ${className}`}
    >
      {header}
      {entries.map((e, i) => {
        if ("separator" in e) return <div key={i} role="separator" className="mx-2 my-1 h-px bg-line" />;
        if ("heading" in e)
          return (
            <div key={i} className="px-2.5 pt-1.5 pb-1 text-caption font-medium text-ink-3">
              {e.heading}
            </div>
          );
        const on = i === active;
        return (
          <button
            key={i}
            type="button"
            role={e.checked === undefined ? "menuitem" : "menuitemradio"}
            aria-checked={e.checked}
            disabled={e.disabled}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(-1)}
            onClick={() => run(e)}
            className={`flex h-8 w-full items-center gap-2.5 rounded-sm px-2.5 text-left whitespace-nowrap disabled:opacity-35 pointer-coarse:h-11 ${
              e.destructive ? `text-red-ink ${on ? "bg-red-soft" : ""}` : `text-ink ${on ? "bg-surface-3" : ""}`
            }`}
          >
            {e.icon && <span className={e.destructive ? "text-red-ink" : "text-ink-3"}>{e.icon}</span>}
            <span className="flex-1">{e.label}</span>
            {e.checked ? (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="ml-6 text-ink-2">
                <path d="M2.5 6.2 4.9 8.6 9.5 3.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : e.hint ? (
              <span className="pl-6 text-caption text-ink-3">{e.hint}</span>
            ) : (
              e.shortcut && <span className="pl-6 text-caption text-ink-3 pointer-coarse:hidden">{e.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

/**
 * A sheet over a dimmed page; closes on Escape or a click outside, never because something scrolled. The page
 * behind holds still while it's open, and a sheet taller than the screen scrolls inside. `top` pins it near the
 * top of the screen, so a sheet that changes height (Settings tabs) grows downward instead of jumping.
 */
export function Modal({
  label,
  onClose,
  top = false,
  sheet = false,
  className = "",
  children,
}: {
  label: string;
  onClose: () => void;
  top?: boolean;
  /** Phones: at the bottom of the screen, where the thumb is. */
  sheet?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, onClose, true, null, false);
  useEffect(() => {
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
  }, []);
  useEffect(() => {
    // The gutter stays, so locking the page doesn't shift it sideways where scrollbars take space.
    const root = document.documentElement;
    const s = root.style;
    const { overflow, scrollbarGutter } = s;
    const scrolls = root.scrollHeight > root.clientHeight;
    s.overflow = "hidden";
    if (scrolls) s.scrollbarGutter = "stable";
    return () => {
      s.overflow = overflow;
      s.scrollbarGutter = scrollbarGutter;
    };
  }, []);
  return createPortal(
    <div
      className={`fixed inset-0 z-[110] flex animate-[fade_var(--duration-fast)_var(--ease-out)_both] justify-center bg-[var(--scrim)] ${
        sheet
          ? `items-end p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:p-4 ${top ? "md:items-start md:pt-[max(1rem,10vh)]" : "md:items-center"}`
          : top
            ? "items-start p-4 pt-[max(1rem,10vh)]"
            : "items-center p-4"
      }`}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        data-floating=""
        className={`max-h-full w-full animate-pop-in overflow-y-auto overscroll-contain rounded-card bg-elevated shadow-float outline-none ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Small key hint, e.g. ⏎ or N. */
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-surface-2 px-1.5 font-sans text-caption-2 font-medium text-ink-3 shadow-ring-line">
      {children}
    </kbd>
  );
}

/**
 * A list that opens and closes by its height (one of the two things whose layout animates). Its content exists only
 * while open or closing, and it clips only while it moves.
 */
export function Accordion({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [moving, setMoving] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setMoving(true);
    if (open) setMounted(true);
  }, [open]);
  return (
    <div
      // One column that never grows past the space it has (long single lines inside truncate instead of widening the page).
      className={`grid grid-cols-[minmax(0,1fr)] transition-[grid-template-rows] duration-(--duration-base) ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      onTransitionEnd={(e) => {
        if (e.target !== e.currentTarget) return;
        setMoving(false);
        if (!open) setMounted(false);
      }}
    >
      <div className={`min-h-0 ${open && !moving ? "" : "overflow-hidden"}`} inert={!open}>
        {(open || mounted) && children}
      </div>
    </div>
  );
}
