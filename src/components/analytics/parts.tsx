"use client";

import { useEffect, useRef, useState } from "react";
import { fmt1, type Period, type Summary } from "@/lib/stats";

/** A titled section: mono label on a hairline, content below. No boxes. */
export function Section({ label, aside, className = "", children }: { label: string; aside?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <h2 className="mono-label text-ink-2">{label}</h2>
        {aside}
      </div>
      <div className="pt-6">{children}</div>
    </section>
  );
}

/** Animates a number towards `value` (ease-out), e.g. for KPI counters. */
export function useCountUp(value: number, ms = 700) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const v = a + (value - a) * (1 - Math.pow(1 - k, 3));
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

function Count({ value, format }: { value: number; format: (n: number) => string }) {
  return <>{format(useCountUp(value))}</>;
}

/** Progress ring (0…1). */
export function Ring({ value, size = 44, stroke = 4 }: { value: number | null; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [v, setV] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setV(value ?? 0));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="flex-none -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--ink)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(1, v))}
        className={`transition-[stroke-dashoffset] duration-1000 ease-quiet ${v > 0 ? "" : "opacity-0"}`}
      />
    </svg>
  );
}

function Delta({ value, unit, digits, suffix = "" }: { value: number; unit: string; digits: number; suffix?: string }) {
  const r = Number(value.toFixed(digits));
  if (r === 0) return <>Same as the previous {unit}</>;
  return (
    <>
      <span className={r > 0 ? "font-medium text-ink" : "text-ink-2"}>
        {r > 0 ? "↑" : "↓"} {Math.abs(r).toFixed(digits).replace(/\.0$/, "")}
        {suffix}
      </span>{" "}
      vs previous {unit}
    </>
  );
}

const BORDERS = ["max-lg:pl-0 lg:pl-0", "border-l", "max-lg:border-t max-lg:pl-0 lg:border-l", "border-l max-lg:border-t"];

export function KpiStrip({ sum, prev, period, className = "" }: { sum: Summary; prev: Summary; period: Period; className?: string }) {
  const prevHas = prev.planned > 0;
  const none = <>No data for the previous {period}</>;
  const tiles: { label: string; value: React.ReactNode; foot: React.ReactNode; visual?: React.ReactNode }[] = [
    { label: "Completed", value: <Count value={sum.completed} format={(n) => String(Math.round(n))} />, foot: sum.planned ? `of ${sum.planned} planned` : "Nothing planned yet" },
    {
      label: "Completion rate",
      value: sum.rate == null ? "—" : <Count value={sum.rate * 100} format={(n) => `${Math.round(n)}%`} />,
      visual: <Ring value={sum.rate} />,
      foot: sum.rate == null ? "Plan tasks to see it" : prevHas && prev.rate != null ? <Delta value={(sum.rate - prev.rate) * 100} unit={period} digits={0} suffix=" pts" /> : none,
    },
    { label: "Daily average", value: <Count value={sum.avg} format={fmt1} />, foot: prevHas ? <Delta value={sum.avg - prev.avg} unit={period} digits={1} /> : none },
    {
      label: "Active days",
      value: (
        <>
          <Count value={sum.activeDays} format={(n) => String(Math.round(n))} />
          <span className="text-[20px] tracking-normal text-faint"> / {sum.elapsedDays}</span>
        </>
      ),
      foot: "Days with something done",
    },
  ];
  return (
    <div className={`grid grid-cols-2 border-y border-line lg:grid-cols-4 ${className}`}>
      {tiles.map((t, i) => (
        <div key={t.label} className={`border-line px-5 py-6 ${BORDERS[i]}`}>
          <div className="mono-label">{t.label}</div>
          <div className="mt-4 flex items-end justify-between gap-2">
            <span className="tabular text-[40px] leading-none font-medium tracking-[-0.045em] md:text-[46px]">{t.value}</span>
            {t.visual}
          </div>
          <div className="mt-3 text-[12.5px] leading-snug text-muted">{t.foot}</div>
        </div>
      ))}
    </div>
  );
}
