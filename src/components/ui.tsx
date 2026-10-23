"use client";

import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckIcon } from "./icons";

// ── Buttons (capsules) ───────────────────────────────────────────────────────

type Variant = "primary" | "secondary" | "plain";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "ink hover:brightness-[1.35] active:scale-[0.97] dark:hover:brightness-[0.92]",
  secondary: "control text-label hover:bg-control-hover active:scale-[0.97]",
  plain: "text-label-2 hover:bg-fill-2 hover:text-label active:bg-fill",
};
const sizes: Record<Size, string> = {
  sm: "h-7 px-3 text-[12.5px]",
  md: "h-8 px-3.5 text-[13px]",
  lg: "h-11 px-5 text-[15px]",
};
const iconSizes: Record<Size, string> = { sm: "size-7", md: "size-8", lg: "size-11" };
const base = "rounded-full transition-[background-color,color,box-shadow,filter,transform] duration-200 ease-glass select-none disabled:pointer-events-none";

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

// ── Segmented control: a glass lens slides over a recessed track ─────────────

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
      className={`track relative grid rounded-full p-[3px] ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="lens absolute inset-y-[3px] left-[3px] rounded-full transition-transform duration-500 ease-liquid"
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
            className={`relative h-[26px] rounded-full px-3.5 text-[12.5px] font-medium whitespace-nowrap transition-colors duration-200 ${
              on ? "text-label" : "text-label-2 hover:text-label"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Checkbox (round; fills with ink) ─────────────────────────────────────────

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
      style={{ width: size, height: size }}
      className={`flex flex-none items-center justify-center rounded-full transition-[background-color,box-shadow,transform] duration-200 ease-glass active:scale-90 ${
        checked
          ? "bg-ink bg-[image:var(--ink-sheen)] text-on-ink shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
          : "shadow-[inset_0_0_0_1.5px_var(--label-3)] hover:shadow-[inset_0_0_0_1.5px_var(--label-2)]"
      } ${className}`}
    >
      {checked && <CheckIcon size={Math.round(size * 0.52)} strokeWidth={2.4} className="animate-pop" />}
    </button>
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
  const { ref, style } = useFloating(anchor, align);
  useDismiss(ref, onClose, true, trigger);
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      data-floating=""
      style={style}
      className={`glass-float rim fixed z-[100] animate-glass-in rounded-[22px] ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}

export type MenuEntry =
  | { label: string; onSelect: () => void; disabled?: boolean; shortcut?: string; icon?: React.ReactNode }
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
  const { ref, style } = useFloating(anchor, align);
  const [active, setActive] = useState(-1);
  useDismiss(ref, onClose, true, trigger);
  const items = entries.map((e, i) => ({ e, i })).filter(({ e }) => "onSelect" in e && !e.disabled);

  useEffect(() => ref.current?.focus(), [ref]);

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
      className="glass-float rim fixed z-[100] min-w-[220px] animate-glass-in rounded-[16px] p-1.5 text-[13px] outline-none"
    >
      {entries.map((e, i) => {
        if ("separator" in e) return <div key={i} role="separator" className="mx-2.5 my-1 h-px bg-separator-strong" />;
        if ("heading" in e)
          return (
            <div key={i} className="px-2.5 pt-1.5 pb-1 text-[11.5px] font-semibold text-label-3">
              {e.heading}
            </div>
          );
        const on = i === active;
        return (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={e.disabled}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(-1)}
            onClick={() => run(e)}
            className={`flex h-[30px] w-full items-center gap-2 rounded-[9px] px-2.5 text-left whitespace-nowrap disabled:opacity-35 ${
              on ? "bg-ink text-on-ink" : "text-label"
            }`}
          >
            {e.icon && <span className={on ? "text-on-ink" : "text-label-2"}>{e.icon}</span>}
            <span className="flex-1">{e.label}</span>
            {e.shortcut && <span className={`pl-6 text-[12px] ${on ? "text-on-ink/60" : "text-label-3"}`}>{e.shortcut}</span>}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

/** Small key hint, e.g. ⏎ or N. */
export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="control rounded-[6px] px-1.5 py-px font-sans text-[11px] font-medium text-label-2">{children}</kbd>;
}
