"use client";

import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckIcon } from "./icons";

// ── Buttons ──────────────────────────────────────────────────────────────────

type Variant = "primary" | "secondary" | "plain";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white shadow-[0_0.5px_1px_rgba(0,0,0,0.18)] hover:bg-accent-hover",
  secondary: "bg-control text-label shadow-control hover:bg-fill-3 active:bg-fill-2",
  plain: "text-label-2 hover:bg-fill-2 hover:text-label active:bg-fill",
};
const sizes: Record<Size, string> = {
  sm: "h-6 rounded-[6px] px-2 text-[12px]",
  md: "h-7 rounded-[7px] px-3 text-[13px]",
  lg: "h-9 rounded-[8px] px-4 text-[14px]",
};
const iconSizes: Record<Size, string> = { sm: "size-6 rounded-[6px]", md: "size-7 rounded-[7px]", lg: "size-9 rounded-[8px]" };

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className = "", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 select-none disabled:pointer-events-none disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
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
      className={`inline-flex flex-none items-center justify-center transition-[background-color,color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-35 ${variants[variant]} ${iconSizes[size]} ${className}`}
      {...props}
    />
  );
});

// ── Segmented control ────────────────────────────────────────────────────────

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
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex rounded-[8px] bg-fill p-[2px] ${className}`}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`h-6 flex-1 rounded-[6px] px-3 text-[12.5px] font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 ${
              on ? "bg-control text-label shadow-raised" : "text-label/75 hover:text-label"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Checkbox (round, Reminders-style) ────────────────────────────────────────

export function Checkbox({
  checked,
  onToggle,
  label,
  size = 18,
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
      className={`flex flex-none items-center justify-center rounded-full border-[1.5px] transition-colors duration-150 ${
        checked ? "border-accent bg-accent text-white" : "border-label-4 bg-transparent hover:border-accent"
      } ${className}`}
    >
      {checked && <CheckIcon size={Math.round(size * 0.56)} strokeWidth={2.2} />}
    </button>
  );
}

// ── Floating surfaces (menus, popovers) ──────────────────────────────────────

export type Anchor = DOMRect | { x: number; y: number };

/** Positions a floating panel next to an anchor rect (or at a point), flipped and clamped into the viewport. */
function useFloating(anchor: Anchor, align: "start" | "end") {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width: w, height: h } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const m = 8;
    let left: number;
    let top: number;
    if ("width" in anchor) {
      left = align === "end" ? anchor.right - w : anchor.left;
      top = anchor.bottom + 4;
      if (top + h > vh - m && anchor.top - h - 4 > m) top = anchor.top - h - 4;
    } else {
      left = anchor.x;
      top = anchor.y;
      if (left + w > vw - m) left = anchor.x - w;
      if (top + h > vh - m) top = anchor.y - h;
    }
    setPos({ left: Math.min(Math.max(m, left), vw - w - m), top: Math.min(Math.max(m, top), vh - h - m) });
  }, [anchor, align]);

  return { ref, style: { left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? "visible" : "hidden" } as const };
}

/** Closes on Escape and on pointer down outside `ref` (and outside `ignore`, usually the trigger that toggles it). */
export function useDismiss(ref: React.RefObject<HTMLElement | null>, onClose: () => void, enabled = true, ignore?: HTMLElement | null) {
  useEffect(() => {
    if (!enabled) return;
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
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onClose);
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
      className={`material fixed z-[100] rounded-[12px] bg-elevated shadow-popover ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}

export type MenuEntry =
  | { label: string; onSelect: () => void; destructive?: boolean; disabled?: boolean; shortcut?: string; icon?: React.ReactNode }
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
      className="material fixed z-[100] min-w-[210px] rounded-[10px] bg-elevated p-[5px] text-[13px] shadow-popover outline-none"
    >
      {entries.map((e, i) => {
        if ("separator" in e) return <div key={i} role="separator" className="mx-2 my-[5px] h-px bg-separator-strong" />;
        if ("heading" in e)
          return (
            <div key={i} className="px-2.5 pt-1 pb-1 text-[11.5px] font-semibold text-label-3">
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
            className={`flex h-[26px] w-full items-center gap-2 rounded-[5px] px-2.5 text-left whitespace-nowrap disabled:opacity-40 ${
              on ? (e.destructive ? "bg-red text-white" : "bg-accent text-white") : e.destructive ? "text-red" : "text-label"
            }`}
          >
            {e.icon && <span className={on ? "text-white" : "text-label-2"}>{e.icon}</span>}
            <span className="flex-1">{e.label}</span>
            {e.shortcut && <span className={`pl-6 text-[12px] ${on ? "text-white/75" : "text-label-3"}`}>{e.shortcut}</span>}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

/** Small key hint, e.g. ⏎ or N. */
export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-[4px] bg-fill-2 px-1 font-sans text-[11px] text-label-3">{children}</kbd>;
}
