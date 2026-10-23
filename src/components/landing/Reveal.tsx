"use client";

import { useInView } from "./useInView";

/** Fades and lifts its content in when it scrolls into view (see [data-reveal] in globals.css). */
export function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} data-reveal={inView ? "in" : ""} style={{ "--delay": `${delay}ms` } as React.CSSProperties} className={className}>
      {children}
    </div>
  );
}
