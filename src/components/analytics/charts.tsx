"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Insights, Point } from "@/lib/insights";

import { tr, trn } from "@/lib/i18n";
import { fmt1 } from "./format";

/** A round top for an axis whose middle line is round too: 4, 8, 10, 20, 40, 50, 80, 100, 200… */
function niceMax(v: number) {
  for (let k = 1; ; k *= 10) for (const m of [1, 2, 4, 5, 8]) if (m * k >= 4 && m * k >= v) return m * k;
}

/**
 * The charts of Detailed analytics, drawn in SVG at the size they are shown (so lines stay crisp and text never
 * stretches). One look for all of them: hairline grid, the accent for what the chart is about, greys for what it is
 * read against, and a small card that follows the pointer.
 */

/** The width an element has on screen, kept up to date. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

type XY = [number, number];
const path = (pts: XY[]) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("");
/** A curve through the points (Catmull-Rom as Béziers): the moving average reads as one stroke, not as corners. */
function curve(pts: XY[]) {
  if (pts.length < 3) return path(pts);
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[i];
    const c = pts[i + 1];
    const e = pts[Math.min(pts.length - 1, i + 2)];
    d += `C${(b[0] + (c[0] - a[0]) / 6).toFixed(1)} ${(b[1] + (c[1] - a[1]) / 6).toFixed(1)} ${(c[0] - (e[0] - b[0]) / 6).toFixed(1)} ${(c[1] - (e[1] - b[1]) / 6).toFixed(1)} ${c[0].toFixed(1)} ${c[1].toFixed(1)}`;
  }
  return d;
}

const GUTTER = 26; // px for the numbers of the vertical axis
const LABEL = "tabular text-caption-2 text-ink-3";

/** The card by the pointer: kept inside the chart's sides, above the point it speaks of. */
function Tip({ x, y, width, children }: { x: number; y: number; width: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState<number | null>(null);
  useLayoutEffect(() => {
    const w = ref.current?.offsetWidth ?? 0;
    setLeft(Math.min(Math.max(0, x - w / 2), Math.max(0, width - w)));
  }, [x, width, children]);
  return (
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none absolute z-10 w-max max-w-[240px] -translate-y-full rounded-[10px] bg-elevated px-3 py-2 shadow-float"
      style={{ left: left ?? 0, top: Math.max(0, y - 10), visibility: left == null ? "hidden" : "visible" }}
    >
      {children}
    </div>
  );
}

/** Hairlines across the plot with their numbers, top to bottom: max, half, zero. */
function Grid({ w, h, top, max }: { w: number; h: number; top: number; max: number }) {
  return (
    <g>
      {[max, max / 2, 0].map((v, i) => {
        const y = top + (h * i) / 2;
        return (
          <g key={i}>
            <path d={`M${GUTTER} ${y}H${w}`} stroke={i === 2 ? "var(--line-2)" : "var(--line)"} />
            <text x={GUTTER - 8} y={y + 3.5} textAnchor="end" className="fill-ink-3 text-[11px]" style={{ fontVariantNumeric: "tabular-nums" }}>
              {fmt1(v)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/**
 * The period adding up: tasks done so far as a rising line over a soft fill, the period before as a quiet line to read
 * it against, and from today on where it is heading at the recent pace (dashed), inside a cone that widens with the
 * days: how far such a stretch usually strays.
 */
export function BurnChart({ burn, dayLabel, vs }: { burn: NonNullable<Insights["burn"]>; dayLabel: (i: number) => string; vs: string }) {
  const [ref, w] = useWidth();
  const [at, setAt] = useState<number | null>(null);
  const H = 196;
  const top = 12;
  const h = H - top - 6;
  const n = burn.length;
  const today = burn.now.length - 1;
  const cone = (k: number) => burn.spread * Math.sqrt(k);
  const peak = Math.max(1, ...burn.now, ...(burn.before ?? []), ...(burn.ahead ?? []).map((v, k) => v + cone(k)));
  const max = niceMax(peak);
  const x = (i: number) => GUTTER + (n > 1 ? (i / (n - 1)) * (w - GUTTER - 8) : (w - GUTTER) / 2);
  const y = (v: number) => top + h - (v / max) * h;
  const now: XY[] = burn.now.map((v, i) => [x(i), y(v)]);
  const before: XY[] = (burn.before ?? []).slice(0, n).map((v, i) => [x(i), y(v)]);
  const ahead: XY[] = burn.ahead && today >= 0 ? [[x(today), y(burn.now[today])], ...burn.ahead.slice(1).map((v, k): XY => [x(today + k + 1), y(v)])] : [];
  const fan =
    burn.ahead && burn.ahead.length > 1 && today >= 0
      ? [
          ...burn.ahead.map((v, k): XY => [x(today + k), y(Math.min(max, (k ? v : burn.now[today]) + cone(k)))]),
          ...burn.ahead.map((v, k): XY => [x(today + k), y(Math.max(burn.now[today], (k ? v : burn.now[today]) - cone(k)))]).reverse(),
        ]
      : [];
  const hover = at != null ? Math.min(n - 1, Math.max(0, at)) : null;
  const value = (i: number) => (i <= today ? burn.now[i] : burn.ahead ? Math.round(burn.ahead[i - today]) : null);

  return (
    <div>
      <div
        ref={ref}
        className="relative"
        style={{ height: H }}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAt(n > 1 ? Math.round(((e.clientX - r.left - GUTTER) / (w - GUTTER - 8)) * (n - 1)) : 0);
        }}
        onMouseLeave={() => setAt(null)}
      >
        {w > 0 && (
          <svg width={w} height={H} className="block overflow-visible" aria-hidden="true">
            <Grid w={w} h={h} top={top} max={max} />
            {before.length > 1 && <path d={path(before)} fill="none" stroke="var(--ink-4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
            {fan.length > 2 && <path d={`${path(fan)}Z`} fill="var(--accent)" fillOpacity="0.07" />}
            {now.length > 1 && <path d={`${path(now)}L${now[now.length - 1][0]} ${y(0)}L${now[0][0]} ${y(0)}Z`} fill="var(--accent)" fillOpacity="0.08" />}
            {ahead.length > 1 && <path d={path(ahead)} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="1 5" strokeLinecap="round" />}
            {now.length > 1 && <path d={path(now)} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} style={{ strokeDasharray: 1, animation: "draw-line 900ms var(--ease-out) both" }} />}
            {now.length > 0 && <circle cx={now[now.length - 1][0]} cy={now[now.length - 1][1]} r="4" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />}
            {hover != null && (
              <g>
                <path d={`M${x(hover)} ${top}V${top + h}`} stroke="var(--ink-4)" strokeDasharray="2 3" />
                {value(hover) != null && <circle cx={x(hover)} cy={y(value(hover)!)} r="3.5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />}
                {burn.before && burn.before[hover] != null && <circle cx={x(hover)} cy={y(burn.before[hover])} r="3" fill="var(--surface)" stroke="var(--ink-3)" strokeWidth="1.5" />}
              </g>
            )}
          </svg>
        )}
        {hover != null && w > 0 && (
          <Tip x={x(hover)} y={y(Math.max(value(hover) ?? 0, burn.before?.[hover] ?? 0))} width={w}>
            <div className="text-caption text-ink-3">{dayLabel(hover)}</div>
            <div className="tabular mt-0.5 text-footnote">
              <span className="font-semibold text-ink">{value(hover) ?? "–"}</span>
              <span className="text-ink-2">{hover <= today ? ` ${tr("done by then")}` : ` ${tr("expected by then")}`}</span>
            </div>
            {burn.before && burn.before[hover] != null && (
              <div className="tabular text-caption text-ink-3">
                {burn.before[hover]} {vs}
              </div>
            )}
          </Tip>
        )}
      </div>
      <div className={`mt-1.5 flex justify-between ${LABEL}`} style={{ paddingLeft: GUTTER }}>
        <span>{dayLabel(0)}</span>
        <span>{dayLabel(n - 1)}</span>
      </div>
    </div>
  );
}

/**
 * Momentum: each day's (a year: each week's) count as a quiet bar, its moving average as one curve over them, and the
 * straight line that fits the counts best (least squares), dashed.
 */
export function TrendChart({ momentum, dayLabel }: { momentum: NonNullable<Insights["momentum"]>; dayLabel: (p: Point) => string }) {
  const [ref, w] = useWidth();
  const [at, setAt] = useState<number | null>(null);
  const H = 196;
  const top = 12;
  const h = H - top - 6;
  const pts = momentum.points;
  const n = pts.length;
  const max = niceMax(Math.max(1, ...pts.map((p) => p.done), momentum.from, momentum.to));
  const step = (w - GUTTER) / n;
  const x = (i: number) => GUTTER + step * (i + 0.5);
  const y = (v: number) => top + h - (v / max) * h;
  const bar = Math.max(2, Math.min(14, step * 0.56));
  const hover = at != null ? Math.min(n - 1, Math.max(0, at)) : null;
  // The average starts once it has a few days to average (its first points would only repeat the bars).
  const lead = Math.min(3, Math.max(0, n - 4));
  return (
    <div>
      <div
        ref={ref}
        className="relative"
        style={{ height: H }}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAt(Math.floor((e.clientX - r.left - GUTTER) / step));
        }}
        onMouseLeave={() => setAt(null)}
      >
        {w > 0 && (
          <svg width={w} height={H} className="block overflow-visible" aria-hidden="true">
            <Grid w={w} h={h} top={top} max={max} />
            {pts.map((p, i) => (
              <rect
                key={p.key}
                x={x(i) - bar / 2}
                y={y(p.done)}
                width={bar}
                height={Math.max(0, top + h - y(p.done))}
                rx={Math.min(2, bar / 2)}
                fill={hover === i ? "var(--ink-3)" : "var(--ink-4)"}
              />
            ))}
            <path d={path([[x(0), y(momentum.from)], [x(n - 1), y(momentum.to)]])} stroke="var(--ink-2)" strokeWidth="1.25" strokeDasharray="4 4" strokeLinecap="round" />
            <path
              d={curve(momentum.average.map((v, i): XY => [x(i), y(v)]).slice(lead))}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              style={{ strokeDasharray: 1, animation: "draw-line 1000ms var(--ease-out) both" }}
            />
            {hover != null && hover >= lead && <circle cx={x(hover)} cy={y(momentum.average[hover])} r="3.5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />}
          </svg>
        )}
        {hover != null && w > 0 && (
          <Tip x={x(hover)} y={y(Math.max(pts[hover].done, momentum.average[hover]))} width={w}>
            <div className="text-caption text-ink-3">{dayLabel(pts[hover])}</div>
            <div className="tabular mt-0.5 text-footnote">
              <span className="font-semibold text-ink">{pts[hover].done}</span>
              <span className="text-ink-2"> {tr("done")}</span>
            </div>
            <div className="tabular text-caption text-ink-3">{tr("average around it: {n}", { n: fmt1(momentum.average[hover]) })}</div>
          </Tip>
        )}
      </div>
      <div className={`mt-1.5 flex justify-between ${LABEL}`} style={{ paddingLeft: GUTTER }}>
        <span>{dayLabel(pts[0])}</span>
        <span>{dayLabel(pts[n - 1])}</span>
      </div>
    </div>
  );
}

/**
 * How the days spread: a bar for every count of tasks done (how many days ended with 0, with 1, with 2…). The middle
 * half of the days is in the accent, with a bracket under it; a tick marks the median.
 */
export function SpreadChart({ spread }: { spread: NonNullable<Insights["spread"]> }) {
  const [ref, w] = useWidth();
  const [at, setAt] = useState<number | null>(null);
  const H = 150;
  const base = H - 30;
  const bins = spread.bins;
  const n = bins.length;
  const top = Math.max(1, ...bins);
  const step = w / n;
  const bar = Math.max(4, Math.min(34, step - 6));
  const x = (i: number) => step * (i + 0.5);
  const every = n > 14 ? Math.ceil(n / 8) : 1;
  return (
    <div ref={ref} className="relative" style={{ height: H }} onMouseLeave={() => setAt(null)}>
      {w > 0 && (
        <svg width={w} height={H} className="block overflow-visible" aria-hidden="true">
          <path d={`M0 ${base + 0.5}H${w}`} stroke="var(--line-2)" />
          {bins.map((days, i) => {
            const bh = (days / top) * (base - 14);
            const mid = i >= spread.low && i <= spread.high;
            return (
              <g key={i} onMouseEnter={() => setAt(i)}>
                <rect x={x(i) - step / 2} y={0} width={step} height={base} fill="transparent" />
                {days > 0 && (
                  <rect
                    x={x(i) - bar / 2}
                    y={base - bh}
                    width={bar}
                    height={bh}
                    rx="3"
                    fill={mid ? "var(--accent)" : "var(--ink-4)"}
                    fillOpacity={at != null && at !== i ? 0.55 : 1}
                    style={{ transformBox: "fill-box", transformOrigin: "bottom", animation: `grow-y var(--duration-data) ${i * 30}ms var(--ease-out) both` }}
                  />
                )}
                {i % every === 0 && (
                  <text x={x(i)} y={base + 14} textAnchor="middle" className={`text-[11px] ${at === i ? "fill-ink" : "fill-ink-3"}`} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {i}
                  </text>
                )}
              </g>
            );
          })}
          {/* The middle half of the days, and the median within it. */}
          <path d={`M${x(spread.low) - bar / 2} ${base + 22}H${x(spread.high) + bar / 2}`} stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
          <circle cx={x(spread.median)} cy={base + 22} r="3.5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
        </svg>
      )}
      {at != null && w > 0 && (
        <Tip x={x(at)} y={base - (bins[at] / top) * (base - 14)} width={w}>
          <div className="tabular text-footnote">
            <span className="font-semibold text-ink">
              {trn(bins[at], "{n} day", "{n} days")}
            </span>
            <span className="text-ink-2"> {tr("with {n} done", { n: at })}</span>
          </div>
        </Tip>
      )}
    </div>
  );
}

/** The weekdays side by side: what a day like it brings on average; the best one in the accent. */
export function WeekdayChart({ weekdays, names }: { weekdays: Insights["weekdays"]; names: string[] }) {
  const [at, setAt] = useState<number | null>(null);
  const top = Math.max(0.01, ...weekdays.map((d) => d.avg));
  const best = weekdays.reduce((b, d) => (d.avg > b.avg ? d : b), weekdays[0]);
  return (
    <div className="grid h-[150px] grid-cols-7 items-end gap-1.5" onMouseLeave={() => setAt(null)}>
      {weekdays.map((d) => {
        const on = best.avg > 0 && d.index === best.index;
        return (
          <div key={d.index} className="flex h-full min-w-0 flex-col items-center justify-end" onMouseEnter={() => setAt(d.index)}>
            <span className={`tabular mb-1 text-caption-2 transition-colors duration-(--duration-fast) ${on || at === d.index ? "font-semibold text-ink" : "text-ink-3"}`}>{d.days ? fmt1(d.avg) : ""}</span>
            <span
              className={`w-full max-w-[34px] origin-bottom rounded-t-[4px] rounded-b-[1px] transition-opacity duration-(--duration-fast) ${on ? "bg-accent" : "bg-ink-4"} ${at != null && at !== d.index ? "opacity-55" : ""}`}
              style={{ height: `${Math.max(d.avg > 0 ? 3 : 1, (d.avg / top) * 96)}px`, animation: `grow-y var(--duration-data) ${d.index * 40}ms var(--ease-out) both` }}
            />
            <span className={`mt-2 text-caption-2 ${on ? "font-semibold text-ink" : "text-ink-3"}`}>{names[d.index]}</span>
            <span className="tabular h-3.5 text-[10px] leading-[14px] text-ink-3">{d.rate == null ? "" : `${Math.round(d.rate * 100)}%`}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Plan against done: every day as a dot (what was planned across, what got done up; bigger where days coincide). The
 * dashed diagonal is a day where everything planned gets done; the solid line is the share that usually does.
 */
export function PlanChart({ plan }: { plan: NonNullable<Insights["plan"]> }) {
  const [ref, w] = useWidth();
  const [at, setAt] = useState<number | null>(null);
  const H = 150;
  const top = 8;
  const h = H - top - 22;
  const max = niceMax(plan.max);
  const x = (v: number) => GUTTER + (v / max) * (w - GUTTER - 10);
  const y = (v: number) => top + h - (v / max) * h;
  const dot = at != null ? plan.dots[at] : null;
  return (
    <div ref={ref} className="relative" style={{ height: H }} onMouseLeave={() => setAt(null)}>
      {w > 0 && (
        <svg width={w} height={H} className="block overflow-visible" aria-hidden="true">
          <Grid w={w} h={h} top={top} max={max} />
          <path d={`M${x(0)} ${y(0)}L${x(max)} ${y(max)}`} stroke="var(--ink-4)" strokeWidth="1.25" strokeDasharray="4 4" strokeLinecap="round" />
          <path d={`M${x(0)} ${y(0)}L${x(max)} ${y(Math.min(max, plan.share * max))}`} stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
          {plan.dots.map((d, i) => (
            <circle
              key={i}
              cx={x(d.planned)}
              cy={y(d.done)}
              r={3 + 1.6 * Math.sqrt(d.days - 1)}
              fill="var(--ink-2)"
              fillOpacity={at === i ? 1 : 0.5}
              stroke="var(--surface)"
              strokeWidth="1.5"
              onMouseEnter={() => setAt(i)}
            />
          ))}
          <text x={w - 4} y={top + h + 16} textAnchor="end" className="fill-ink-3 text-[11px]">
            {tr("planned →")}
          </text>
          <text x={GUTTER + 4} y={top + 9} className="fill-ink-3 text-[11px]">
            {tr("↑ done")}
          </text>
        </svg>
      )}
      {dot && w > 0 && (
        <Tip x={x(dot.planned)} y={y(dot.done)} width={w}>
          <div className="tabular text-footnote">
            <span className="font-semibold text-ink">{dot.done}</span>
            <span className="text-ink-2"> {tr("of {n} done", { n: dot.planned })}</span>
          </div>
          <div className="tabular text-caption text-ink-3">
            {trn(dot.days, "on {n} day", "on {n} days")}
          </div>
        </Tip>
      )}
    </div>
  );
}
