"use client";

import { useState } from "react";
import { pct } from "@/lib/stats";
import type { Task } from "@/lib/types";
import { ChevronDown, ChevronUp } from "../icons";
import { Section } from "./parts";

export type HistoryRow = {
  key: string;
  label: string;
  done: number;
  planned: number;
  rate: number | null;
  tasks?: Task[];
  activeDays?: string;
  onPick: () => void;
};

type SortKey = "date" | "done" | "rate";

export function HistorySection({ rows, unit }: { rows: HistoryRow[]; unit: "days" | "months" }) {
  // Rows arrive oldest first; "date desc" shows the latest first.
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: -1 });
  const order = rows.map((r, i) => ({ r, i }));
  order.sort((a, b) => {
    const v = sort.key === "date" ? a.i - b.i : sort.key === "done" ? a.r.done - b.r.done : (a.r.rate ?? -1) - (b.r.rate ?? -1);
    return v * sort.dir || b.i - a.i;
  });

  const th = (key: SortKey, label: string, cls = "") => {
    const on = sort.key === key;
    return (
      <th className={`pb-3 font-normal ${cls}`}>
        <button
          type="button"
          onClick={() => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 }))}
          className={`inline-flex items-center gap-1 uppercase transition-colors hover:text-ink ${on ? "text-ink" : ""}`}
        >
          {label}
          {on && (sort.dir === 1 ? <ChevronUp size={10} strokeWidth={2} /> : <ChevronDown size={10} strokeWidth={2} />)}
        </button>
      </th>
    );
  };

  return (
    <Section label="History" aside={<span className="tabular mono-label">{rows.length ? `${rows.length} ${unit} with tasks` : ""}</span>}>
      {rows.length === 0 ? (
        <p className="text-[17px] leading-snug font-medium tracking-[-0.015em]">
          No history yet. <span className="text-faint">Plan something and it will show up here.</span>
        </p>
      ) : (
        <div className="-mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[14px]">
            <thead>
              <tr className="font-mono text-[10.5px] tracking-[0.06em] text-faint">
                {th("date", unit === "days" ? "Date" : "Month", "text-left")}
                {th("done", "Done", "text-right")}
                <th className="pb-3 pl-5 text-right font-normal uppercase">Planned</th>
                {th("rate", "Rate", "pl-6 text-left")}
                <th className="pb-3 pl-2 text-left font-normal uppercase">{unit === "days" ? "Tasks" : "Active days"}</th>
              </tr>
            </thead>
            <tbody>
              {order.map(({ r }) => (
                <tr key={r.key} onClick={r.onPick} className="cursor-pointer border-t border-line transition-colors hover:bg-fill-row">
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <button type="button" className="text-ink">
                      {r.label}
                    </button>
                  </td>
                  <td className="tabular py-3 text-right font-mono text-[12.5px]">{r.done}</td>
                  <td className="tabular py-3 pl-5 text-right font-mono text-[12.5px] text-faint">{r.planned}</td>
                  <td className="py-3 pl-6">
                    <span className="flex items-center gap-3">
                      <span className="h-[2px] w-16 overflow-hidden rounded-full bg-track">
                        <span className="block h-full rounded-full bg-ink" style={{ width: `${(r.rate ?? 0) * 100}%` }} />
                      </span>
                      <span className="tabular w-9 font-mono text-[11.5px] text-muted">{r.rate == null ? "—" : pct(r.rate)}</span>
                    </span>
                  </td>
                  <td className="w-[44%] max-w-0 py-3 pl-2">
                    {r.tasks ? (
                      <span className="block truncate">
                        {[...r.tasks]
                          .sort((a, b) => Number(b.done) - Number(a.done))
                          .map((t, i) => (
                            <span key={t.id} className={t.done ? "text-ink-2" : "text-ghost"}>
                              {i > 0 && <span className="text-ghost"> · </span>}
                              {t.title}
                            </span>
                          ))}
                      </span>
                    ) : (
                      <span className="tabular font-mono text-[12px] text-muted">{r.activeDays}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
