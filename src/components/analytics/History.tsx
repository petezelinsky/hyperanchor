"use client";

import { useState } from "react";
import { pct } from "@/lib/stats";
import type { Task } from "@/lib/types";
import { ChevronDown, ChevronUp } from "../icons";
import { Card } from "./parts";

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

export function HistoryCard({ rows, unit }: { rows: HistoryRow[]; unit: "days" | "months" }) {
  // Rows arrive oldest first; "date desc" shows the latest first.
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: -1 });
  const order = rows.map((r, i) => ({ r, i }));
  order.sort((a, b) => {
    const v = sort.key === "date" ? a.i - b.i : sort.key === "done" ? a.r.done - b.r.done : (a.r.rate ?? -1) - (b.r.rate ?? -1);
    return v * sort.dir || (b.i - a.i);
  });

  const th = (key: SortKey, label: string, right = false, pad = "") => {
    const on = sort.key === key;
    return (
      <th className={`py-2 font-medium ${right ? "text-right" : "text-left"} ${pad}`}>
        <button
          type="button"
          onClick={() => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 }))}
          className={`inline-flex items-center gap-1 hover:text-label ${on ? "text-label" : ""}`}
        >
          {label}
          {on && (sort.dir === 1 ? <ChevronUp size={11} strokeWidth={2} /> : <ChevronDown size={11} strokeWidth={2} />)}
        </button>
      </th>
    );
  };

  return (
    <Card title="History" aside={<span className="tabular text-[12px] text-label-2">{rows.length ? `${rows.length} ${unit} with tasks` : ""}</span>}>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-label-2">No tasks in this period yet.</p>
      ) : (
        <div className="-mx-4 overflow-x-auto md:-mx-5">
          <table className="w-full min-w-[560px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-separator text-[12px] text-label-2 [&>th:first-child]:pl-4 md:[&>th:first-child]:pl-5 [&>th:last-child]:pr-4 md:[&>th:last-child]:pr-5">
                {th("date", unit === "days" ? "Date" : "Month")}
                {th("done", "Completed", true)}
                <th className="py-2 pl-4 text-right font-medium">Planned</th>
                {th("rate", "Rate", false, "pl-5")}
                <th className="py-2 pl-2 text-left font-medium">{unit === "days" ? "Tasks" : "Active days"}</th>
              </tr>
            </thead>
            <tbody>
              {order.map(({ r }) => (
                <tr
                  key={r.key}
                  onClick={r.onPick}
                  className="border-b border-separator transition-colors last:border-0 hover:bg-fill-3 [&>td:first-child]:pl-4 md:[&>td:first-child]:pl-5 [&>td:last-child]:pr-4 md:[&>td:last-child]:pr-5"
                >
                  <td className="py-2.5 whitespace-nowrap">
                    <button type="button" className="font-medium hover:underline">
                      {r.label}
                    </button>
                  </td>
                  <td className="tabular py-2.5 text-right">{r.done}</td>
                  <td className="tabular py-2.5 pl-4 text-right text-label-2">{r.planned}</td>
                  <td className="py-2.5 pl-5">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-fill-2">
                        <span className="block h-full rounded-full bg-accent" style={{ width: `${(r.rate ?? 0) * 100}%` }} />
                      </span>
                      <span className="tabular w-9 text-[12.5px] text-label-2">{r.rate == null ? "—" : pct(r.rate)}</span>
                    </span>
                  </td>
                  <td className="w-[44%] max-w-0 py-2.5 pl-2">
                    {r.tasks ? (
                      <span className="block truncate">
                        {[...r.tasks]
                          .sort((a, b) => Number(b.done) - Number(a.done))
                          .map((t, i) => (
                            <span key={t.id} className={t.done ? "text-label" : "text-label-3"}>
                              {i > 0 && <span className="text-label-3">, </span>}
                              {t.title}
                            </span>
                          ))}
                      </span>
                    ) : (
                      <span className="tabular text-label-2">{r.activeDays}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
