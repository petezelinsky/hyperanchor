"use client";

import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ── Buttons ──────────────────────────────────────────────────────────────────

type Variant = "primary" | "secondary" | "plain";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary shadow-[0_1px_2px_rgba(0,0,0,0.14)] hover:bg-primary-hover active:scale-[0.98]",
  secondary: "bg-surface text-ink shadow-lift hover:bg-surface-2 active:scale-[0.98]",
  plain: "text-ink-2 hover:bg-surface-3 hover:text-ink active:bg-line",
};
const sizes: Record<Size, string> = {
  sm: "h-7 rounded-[8px] px-2.5 text-[12.5px]",
  md: "h-8 rounded-[9px] px-3 text-[13px]",
  lg: "h-11 rounded-[12px] px-5 text-[15px]",
};
const iconSizes: Record<Size, string> = { sm: "size-7 rounded-[8px]", md: "size-8 rounded-[9px]", lg: "size-11 rounded-[12px]" };
const base = "transition-[background-color,color,box-shadow,transform] duration-150 ease-out select-none disabled:pointer-events-none";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className = "", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap disabled:opacity-40 ${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { label: string }>(function IconButton(
  { variant = "plain", size = "md", className = "", label, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={props.title ?? label}
      className={`inline-flex flex-none items-center justify-center disabled:opacity-35 ${base} ${variants[variant]} ${iconSizes[size]} ${className}`}
      {...props}
    />
  );
});

// ── Segmented control: a raised thumb slides over a recessed track ──────────

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  className = "",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`relative grid rounded-[10px] bg-surface-3 p-[3px] ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-[3px] left-[3px] rounded-[7px] bg-surface shadow-lift transition-transform duration-300 ease-spring"
        style={{ width: `calc((100% - 6px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`relative h-[26px] rounded-[7px] px-3 text-[12.5px] font-medium whitespace-nowrap transition-colors duration-150 ${
              on ? "text-ink" : "text-ink-2 hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Checkbox: round; completing it pops, draws the tick and ripples ─────────

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
      style={{ width: size, height: size, animation: celebrate ? "check-pop 0.35s cubic-bezier(0.2,0.8,0.2,1)" : undefined }}
      className={`relative flex flex-none items-center justify-center rounded-full transition-[background-color,box-shadow] duration-200 ${
        checked
          ? "bg-accent text-on-accent"
          : "shadow-[inset_0_0_0_1.5px_var(--check-ring)] hover:bg-accent-soft hover:shadow-[inset_0_0_0_1.5px_var(--accent)]"
      } ${className}`}
    >
      {celebrate && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full bg-accent" style={{ animation: "ripple 0.55s ease-out both" }} />
      )}
      {checked && (
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 12 12" fill="none" aria-hidden="true" className="relative">
          <path
            d="M2.6 6.3 5 8.6 9.4 3.7"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="16"
            style={{ animation: celebrate ? "check-draw 0.32s 0.06s ease-out both" : undefined }}
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
        className="transition-[stroke-dashoffset] duration-700 ease-out"
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
              style={{ background: c, "--a": `${i * 45 + 20}deg`, "--r": `${16 + (i % 3) * 5}px`, animation: `burst 0.8s ${i * 15}ms cubic-bezier(0.2,0.8,0.2,1) both` } as React.CSSProperties}
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

/**
 * Closes on Escape, on pointer down outside `ref` (and outside `ignore`, usually the trigger that toggles it),
 * on resize and when the page scrolls under it.
 */
export function useDismiss(ref: React.RefObject<HTMLElement | null>, onClose: () => void, enabled = true, ignore?: HTMLElement | null) {
  useEffect(() => {
    if (!enabled) return;
    const opened = performance.now();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current && !ref.current.contains(t) && !ignore?.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
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
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [ref, onClose, enabled, ignore]);
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
      className={`fixed z-[100] animate-pop-in rounded-[14px] bg-elevated shadow-float ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}

export type MenuEntry =
  /** `checked` makes the item one of a set of choices (a tick marks the current one). */
  | { label: string; onSelect: () => void; destructive?: boolean; disabled?: boolean; shortcut?: string; icon?: React.ReactNode; checked?: boolean }
  | { separator: true }
  | { heading: string };

export function Menu({
  anchor,
  entries,
  onClose,
  align = "start",
  label = "Menu",
  trigger,
}: {
  anchor: Anchor;
  entries: MenuEntry[];
  onClose: () => void;
  align?: "start" | "end";
  label?: string;
  trigger?: HTMLElement | null;
}) {
  const { ref, style, ready } = useFloating(anchor, align);
  const [active, setActive] = useState(-1);
  useDismiss(ref, onClose, true, trigger);
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
      className="fixed z-[100] min-w-[220px] animate-pop-in rounded-[12px] bg-elevated p-1 text-[13px] shadow-float outline-none"
    >
      {entries.map((e, i) => {
        if ("separator" in e) return <div key={i} role="separator" className="mx-2 my-1 h-px bg-line" />;
        if ("heading" in e)
          return (
            <div key={i} className="px-2.5 pt-1.5 pb-1 text-[11.5px] font-medium text-ink-3">
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
            className={`flex h-8 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left whitespace-nowrap disabled:opacity-35 ${
              e.destructive ? `text-red-ink ${on ? "bg-red-soft" : ""}` : `text-ink ${on ? "bg-surface-3" : ""}`
            }`}
          >
            {e.icon && <span className={e.destructive ? "text-red-ink" : "text-ink-3"}>{e.icon}</span>}
            <span className="flex-1">{e.label}</span>
            {e.checked ? (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="ml-6 text-ink-2">
                <path d="M2.5 6.2 4.9 8.6 9.5 3.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              e.shortcut && <span className="pl-6 text-[12px] text-ink-3">{e.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

/** A centered sheet over a dimmed page; closes on Escape or a click outside. */
export function Modal({ label, onClose, className = "", children }: { label: string; onClose: () => void; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, onClose);
  useEffect(() => ref.current?.focus(), []);
  return createPortal(
    <div className="fixed inset-0 z-[110] flex animate-[fade_0.2s_ease-out_both] items-center justify-center bg-black/30 p-4 backdrop-blur-[2px] dark:bg-black/50">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        data-floating=""
        className={`w-full animate-pop-in rounded-[18px] bg-elevated shadow-float outline-none ${className}`}
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
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-surface px-1.5 font-sans text-[11px] font-medium text-ink-2 shadow-[0_0_0_1px_var(--line-2),0_1px_0_var(--line-2)]">
      {children}
    </kbd>
  );
}
