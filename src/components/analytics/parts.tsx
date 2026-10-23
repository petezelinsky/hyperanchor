import { fmt1, pct, type Period, type Summary } from "@/lib/stats";

export function Card({ title, aside, className = "", children }: { title: string; aside?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={`card animate-rise rounded-[24px] p-4 md:p-6 ${className}`}>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[16px] font-semibold tracking-[-0.015em]">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

/** Activity-ring style progress (0…1). */
export function Ring({ value, size = 42, stroke = 5 }: { value: number | null; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="flex-none -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill)" strokeWidth={stroke} />
      {value != null && value > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, value))}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      )}
    </svg>
  );
}

function Delta({ value, unit, digits, suffix = "" }: { value: number; unit: string; digits: number; suffix?: string }) {
  const r = Number(value.toFixed(digits));
  if (r === 0) return <>Same as previous {unit}</>;
  return (
    <>
      <span className={r > 0 ? "font-semibold text-label" : "font-medium text-label-2"}>
        {r > 0 ? "▲" : "▼"} {Math.abs(r).toFixed(digits).replace(/\.0$/, "")}
        {suffix}
      </span>{" "}
      vs previous {unit}
    </>
  );
}

function Tile({ label, value, extra, foot, visual }: { label: string; value: React.ReactNode; extra?: string; foot: React.ReactNode; visual?: React.ReactNode }) {
  return (
    <div className="card flex min-w-0 animate-rise flex-col rounded-[24px] p-4 md:p-5">
      <div className="text-[12px] font-medium text-label-2">{label}</div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="tabular font-display text-[32px] leading-9 font-bold tracking-[-0.035em]">
          {value}
          {extra && <span className="text-[15px] font-medium tracking-normal text-label-3">{extra}</span>}
        </div>
        {visual}
      </div>
      <div className="mt-2 text-[12px] leading-4 text-label-2">{foot}</div>
    </div>
  );
}

export function Kpis({ sum, prev, period }: { sum: Summary; prev: Summary; period: Period }) {
  const prevHas = prev.planned > 0;
  const none = <>No data for the previous {period}</>;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label="Completed" value={sum.completed} foot={sum.planned ? `of ${sum.planned} planned` : "Nothing planned yet"} />
      <Tile
        label="Completion rate"
        value={sum.rate == null ? "—" : pct(sum.rate)}
        visual={<Ring value={sum.rate} />}
        foot={sum.rate == null ? "Plan tasks to see your rate" : prevHas && prev.rate != null ? <Delta value={(sum.rate - prev.rate) * 100} unit={period} digits={0} suffix=" pts" /> : none}
      />
      <Tile label="Daily average" value={fmt1(sum.avg)} foot={prevHas ? <Delta value={sum.avg - prev.avg} unit={period} digits={1} /> : none} />
      <Tile label="Active days" value={sum.activeDays} extra={` / ${sum.elapsedDays}`} foot="Days with completed tasks" />
    </div>
  );
}
