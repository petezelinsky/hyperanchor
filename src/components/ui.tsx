"use client";

import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ── Buttons ──────────────────────────────────────────────────────────────────

type Variant = "primary" | "outline" | "text";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "rounded-full bg-ink text-on-ink active:scale-[0.98]",
  outline: "rounded-full border border-edge bg-paper text-ink hover:border-ink",
  text: "rounded-[10px] text-muted hover:bg-fill hover:text-ink",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-4 text-[13.5px]",
  lg: "h-11 px-5 text-[14.5px]",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "outline", size = "md", className = "", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap transition-[transform,background-color,border-color,color] duration-150 select-none disabled:pointer-events-none disabled:opacity-35 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
});

export const IconButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: "sm" | "md" }>(
  function IconButton({ size = "md", className = "", label, type = "button", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={props.title ?? label}
        className={`inline-flex flex-none items-center justify-center rounded-full text-ink transition-colors duration-150 hover:bg-fill disabled:pointer-events-none disabled:opacity-30 ${size === "sm" ? "size-7" : "size-9"} ${className}`}
        {...props}
      />
    );
  },
);

// ── Dot toggles: a dot and a word, not a pill switch ─────────────────────────

export function DotTabs<T extends string>({
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
    <div role="radiogroup" aria-label={label} className={`flex items-center ${className}`}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`group inline-flex h-9 items-center gap-2 rounded-full pr-3 pl-2.5 text-[13.5px] font-medium transition-[color,background-color] duration-200 hover:bg-fill ${
              on ? "text-ink" : "text-muted hover:text-ink"
            }`}
          >
            <span
              className={`size-2 rounded-full border-[1.3px] transition-[background-color,border-color,transform] duration-300 ease-quiet ${
                on ? "scale-115 border-ink bg-ink" : "border-current bg-transparent"
              }`}
            />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Checkbox: ink circle, the check draws itself when completed ──────────────

export function Checkbox({ checked, onToggle, label, size = 20, className = "" }: { checked: boolean; onToggle: () => void; label: string; size?: number; className?: string }) {
  const [fresh, setFresh] = useState(false);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        setFresh(!checked);
        onToggle();
      }}
      onAnimationEnd={() => setFresh(false)}
      style={{ width: size, height: size }}
      className={`flex flex-none items-center justify-center rounded-full border-[1.5px] transition-[background-color,border-color] duration-200 ${
        checked ? "border-ink bg-ink text-on-ink" : "border-ghost bg-transparent hover:border-ink"
      } ${fresh ? "animate-bump" : ""} ${className}`}
    >
      {checked && (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 10 10" aria-hidden="true">
          <path
            d="M2 5.3 4.1 7.3 8 3"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={12}
            className={fresh ? "animate-draw" : ""}
          />
        </svg>
      )}
    </button>
  );
}

// ── Floating surfaces ────────────────────────────────────────────────────────

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
      top = anchor.bottom + 6;
      if (top + h > vh - m && anchor.top - h - 6 > m) top = anchor.top - h - 6;
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
    <div ref={ref} role="dialog" aria-label={label} data-floating="" style={style} className={`fixed z-[100] animate-pop rounded-[22px] bg-paper shadow-card ${className}`}>
      {children}
    </div>,
    document.body,
  );
}

export function Modal({ onClose, label, className = "", children }: { onClose: () => void; label: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, onClose);
  return createPortal(
    <div data-floating="" className="fixed inset-0 z-[110] flex animate-fade items-center justify-center bg-scrim p-4">
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} className={`w-full animate-pop rounded-[22px] bg-paper shadow-lift ${className}`}>
        {children}
      </div>
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
      className="fixed z-[100] min-w-[220px] animate-pop rounded-[14px] bg-paper p-1.5 shadow-menu outline-none"
    >
      <>
        {entries.map((e, i) => {
          if ("separator" in e) return <div key={i} role="separator" className="mx-2 my-1.5 h-px bg-line" />;
          if ("heading" in e)
            return (
              <div key={i} className="mono-label px-3 pt-2 pb-1.5">
                {e.heading}
              </div>
            );
          return (
            <button
              key={i}
              type="button"
              role="menuitem"
              disabled={e.disabled}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(-1)}
              onClick={() => run(e)}
              className={`flex h-9 w-full items-center gap-3 rounded-[9px] px-3 text-left text-[13.5px] whitespace-nowrap text-ink transition-colors duration-100 disabled:text-ghost ${
                i === active ? "bg-fill" : ""
              }`}
            >
              {e.icon && <span className="text-muted">{e.icon}</span>}
              <span className="flex-1">{e.label}</span>
              {e.shortcut && <span className="pl-6 font-mono text-[11px] text-faint">{e.shortcut}</span>}
            </button>
          );
        })}
      </>
    </div>,
    document.body,
  );
}

/** Key cap, e.g. N or ⏎. */
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[6px] border border-edge bg-paper px-1.5 font-mono text-[11px] text-ink-2">
      {children}
    </kbd>
  );
}

/** Thin progress line (0…1). */
export function ProgressLine({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`block h-[2px] overflow-hidden rounded-full bg-track ${className}`}>
      <span className="block h-full rounded-full bg-ink transition-[width] duration-700 ease-quiet" style={{ width: `${Math.min(1, Math.max(0, value)) * 100}%` }} />
    </span>
  );
}
