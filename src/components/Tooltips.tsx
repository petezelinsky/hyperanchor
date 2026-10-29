"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Tip = { text: string; x: number; y: number; side: "top" | "bottom" | "right" };

const EDGE = 8;

/**
 * One shared tooltip for every element with `data-tip` (used instead of the native `title`, which pops up under the
 * pointer and covers neighbouring controls). It appears beside the element — above it, below it near the top of the
 * window, or to its right with `data-tip-side="right"` (for vertical lists) — after a short hover, at once on keyboard
 * focus, and never on touch. It is visual only: the element keeps its own accessible name.
 */
export function Tooltips() {
  const [tip, setTip] = useState<Tip | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: Element | null = null;
    // Where the last click happened: the page may change under a pointer that hasn't moved, which isn't a hover.
    let pressedAt = "";
    const show = (el: Element) => {
      const text = el.getAttribute("data-tip");
      if (!text || !el.isConnected) return;
      const r = el.getBoundingClientRect();
      if (el.getAttribute("data-tip-side") === "right") setTip({ text, x: r.right + EDGE, y: r.top + r.height / 2, side: "right" });
      else if (r.top < 44) setTip({ text, x: r.left + r.width / 2, y: r.bottom + EDGE, side: "bottom" });
      else setTip({ text, x: r.left + r.width / 2, y: r.top - EDGE, side: "top" });
    };
    const hide = () => {
      clearTimeout(timer);
      current = null;
      setTip(null);
    };
    const onDown = (e: PointerEvent) => {
      hide();
      pressedAt = `${e.clientX},${e.clientY}`;
    };
    const onOver = (e: PointerEvent) => {
      if (e.pointerType === "touch" || `${e.clientX},${e.clientY}` === pressedAt) return;
      const el = (e.target as Element).closest?.("[data-tip]") ?? null;
      if (el === current) return;
      hide();
      if (!el) return;
      current = el;
      timer = setTimeout(() => show(el), 450);
    };
    const onFocus = (e: FocusEvent) => {
      const el = (e.target as Element).closest?.("[data-tip]");
      if (!el || !el.matches(":focus-visible")) return;
      hide();
      current = el;
      show(el);
    };
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", hide, true);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", hide);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", hide, true);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", hide);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("blur", hide);
    };
  }, []);

  // Keep it inside the window: centered over the element where there's room, nudged in at the edges.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !tip || tip.side === "right") return;
    const w = el.offsetWidth;
    el.style.left = `${Math.min(window.innerWidth - EDGE - w, Math.max(EDGE, tip.x - w / 2))}px`;
  }, [tip]);

  if (!tip) return null;
  const place =
    tip.side === "right"
      ? { left: tip.x, top: tip.y, transform: "translateY(-50%)" }
      : { left: tip.x, top: tip.y, transform: tip.side === "top" ? "translateY(-100%)" : undefined };
  return createPortal(
    <span
      ref={ref}
      role="tooltip"
      style={place}
      className="pointer-events-none fixed z-[200] animate-[fade_0.12s_ease-out_both] rounded-[7px] bg-ink px-2 py-1 text-[12px] leading-4 font-medium whitespace-nowrap text-surface shadow-float"
    >
      {tip.text}
    </span>,
    document.body,
  );
}
