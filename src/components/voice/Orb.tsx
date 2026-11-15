"use client";

import { useEffect, useRef } from "react";
import { lightRamp } from "../light";
import { ParticleRing } from "./ParticleRing";

/**
 * The sphere, small: the voice screen's own ring of dots, drawn once and still, as the sign of everything spoken (the
 * Speak buttons) and of the AI at work. `active`: it thinks (a wave goes round it) for as long as that lasts. It takes
 * the color of the text around it and is drawn again when the theme changes. `lit`: its dots take the colours of the
 * light instead (analytics), green at the top through to violet at the bottom.
 */
export function Orb({ size = 20, active = false, lit = false, className = "" }: { size?: number; active?: boolean; lit?: boolean; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ring = useRef<ParticleRing | null>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    // Fewer, larger dots than on the voice screen, so the ring still reads as dots at the size of an icon.
    const r = new ParticleRing(el, { count: 700, dotSize: 14, spread: 56, mode: "silent", intro: false, color: getComputedStyle(el).color, colors: lit ? lightRamp(el, 28) : undefined });
    ring.current = r;
    r.still(0.4);
    const repaint = () => {
      const color = getComputedStyle(el).color;
      const colors = lit ? lightRamp(el, 28) : undefined;
      if (color === r.o.color && colors?.join() === r.o.colors?.join()) return;
      r.o.color = color;
      r.o.colors = colors;
      r.still();
    };
    const theme = new MutationObserver(() => requestAnimationFrame(repaint));
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-accent"] });
    return () => {
      theme.disconnect();
      r.stop();
      ring.current = null;
    };
  }, [lit]);
  useEffect(() => {
    const r = ring.current;
    if (!r) return;
    r.o.mode = active ? "think" : "silent";
    if (active) r.start();
    else {
      r.stop();
      r.still(0.3);
    }
  }, [active]);
  return <canvas ref={canvas} aria-hidden="true" width={size * 2} height={size * 2} style={{ width: size, height: size }} className={`block flex-none ${className}`} />;
}
