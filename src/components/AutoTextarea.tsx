"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string };

/** Borderless textarea that grows with its content (CSS `field-sizing` where supported, JS fallback elsewhere). */
export const AutoTextarea = forwardRef<HTMLTextAreaElement, Props>(function AutoTextarea({ style, ...props }, ref) {
  const inner = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement);

  const grow = useCallback(() => {
    const el = inner.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(grow, [grow, props.value]);
  useEffect(() => {
    window.addEventListener("resize", grow);
    document.fonts?.ready.then(grow);
    return () => window.removeEventListener("resize", grow);
  }, [grow]);

  return (
    <textarea
      ref={inner}
      rows={1}
      {...props}
      style={{ fieldSizing: "content", ...style } as React.CSSProperties}
      className={`block w-full resize-none overflow-hidden border-none bg-transparent p-0 outline-none focus-visible:outline-none ${props.className ?? ""}`}
    />
  );
});
