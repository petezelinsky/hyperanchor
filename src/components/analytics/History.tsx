"use client";

import { useState } from "react";

import type { Task } from "@/lib/types";
import { tr, trn } from "@/lib/i18n";
import { ChevronDown, ChevronUp } from "../icons";
import { pct } from "./format";
import { Card } from "./parts";

export type HistoryRow = {
  key: string;
  label: string;
  done: number;
  planned: number;
  rate: number | null;
  tasks?: Task[];
  activeDays?: string;
  /** Opens the row's day (or month) beside it. */
  onPick: (el: HTMLElement) => void;
};

type SortKey = "date" | "done" | "rate";
const LIMIT = 10;

/** Every number behind the charts, as a sortable table (the charts' table view). */
export function HistoryCard({ rows, unit, className = "" }: { rows: HistoryRow[]; unit: "days" | "months"; className?: string }) {
  // Rows arrive oldest first; "date desc" shows the latest first.
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: -1 });
  const [all, setAll] = useState(false);
  const order = rows.map((r, i) => ({ r, i }));
  order.sort((a, b) => {
    const v = sort.key === "date" ? a.i - b.i : sort.key === "done" ? a.r.done - b.r.done : (a.r.rate ?? -1) - (b.r.rate ?? -1);
    return v * sort.dir || b.i - a.i;
  });
  const shown = all ? order : order.slice(0, LIMIT);

  const th = (key: SortKey, label: string, right = false, pad = "") => {
    const on = sort.key === key;
    return (
      <th className={`py-2 font-medium ${right ? "text-right" : "text-left"} ${pad}`}>
        <button
          type="button"
          onClick={() => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 }))}
          className={`tap relative inline-flex items-center gap-1 hover:text-ink ${on ? "text-ink" : ""}`}
        >
          {label}
          {on && (sort.dir === 1 ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
        </button>
      </th>
    );
  };

  return (
    <Card title={tr("History")} className={className} aside={<span className="tabular text-caption text-ink-3">{rows.length ? (unit === "days" ? trn(rows.length, "{n} day with tasks", "{n} days with tasks") : trn(rows.length, "{n} month with tasks", "{n} months with tasks")) : ""}</span>}>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-footnote text-ink-2">{tr("No tasks in this period yet.")}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-footnote @2xl/analytics:min-w-[560px]">
              <thead>
                <tr className="border-b border-line text-caption text-ink-3">
                  {th("date", unit === "days" ? tr("Date") : tr("Month"), false, "pl-2")}
                  {th("done", tr("Done"), true)}
                  <th className="py-2 pl-4 text-right font-medium @max-2xl/analytics:hidden">{tr("Planned")}</th>
                  {th("rate", tr("Rate"), true, "pl-5")}
                  <th className="py-2 pl-6 text-left font-medium @max-2xl/analytics:hidden">{unit === "days" ? tr("Tasks") : tr("Active days")}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ r }) => (
                  <tr
                    key={r.key}
                    onClick={(e) => r.onPick(e.currentTarget)}
                    className="group cursor-pointer border-b border-line transition-colors duration-(--duration-fast) last:border-0 hover:bg-surface-2"
                  >
                    <td className="py-2.5 pl-2 whitespace-nowrap">
                      <button type="button" aria-haspopup="dialog" className="font-medium decoration-ink-4 underline-offset-[3px] group-hover:underline">
                        {r.label}
                      </button>
                    </td>
                    <td className="tabular py-2.5 text-right">{r.done}</td>
                    <td className="tabular py-2.5 pl-4 text-right text-ink-2 @max-2xl/analytics:hidden">{r.planned}</td>
                    <td className={`tabular py-2.5 pl-5 text-right ${r.rate === 1 ? "font-medium text-ink" : "text-ink-2"}`}>{r.rate == null ? "—" : pct(r.rate)}</td>
                    <td className="w-[50%] max-w-0 py-2.5 pl-6 @max-2xl/analytics:hidden">
                      {r.tasks ? (
                        <span className="block truncate">
                          {[...r.tasks]
                            .sort((a, b) => Number(b.done) - Number(a.done))
                            .map((t, i) => (
                              <span key={t.id} className={t.done ? "text-ink" : "text-ink-3"}>
                                {i > 0 && <span className="text-ink-3">, </span>}
                                {t.title}
                              </span>
                            ))}
                        </span>
                      ) : (
                        <span className="tabular text-ink-2">{r.activeDays}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > LIMIT && (
            <button type="button" onClick={() => setAll((a) => !a)} className="tap relative mt-3 text-caption font-medium text-ink-2 underline decoration-ink-4 underline-offset-[3px] hover:text-ink hover:decoration-current">
              {all ? tr("Show less") : tr("Show all {n}", { n: rows.length })}
            </button>
          )}
        </>
      )}
    </Card>
  );
}
