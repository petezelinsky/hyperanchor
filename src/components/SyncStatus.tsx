"use client";

import { useEffect, useState } from "react";
import { tr, trn } from "@/lib/i18n";
import { CloudOffIcon } from "./icons";
import type { Trouble } from "./useTasks";

/** Saving, as the sidebar and the phone header show it. */
export type Sync = { saving: boolean; waiting: number; trouble: Trouble };

/**
 * Quiet unless it matters: "Saving…" when a save takes a while, "Offline · 3 changes waiting" without a network, and
 * "3 changes waiting" while the server can't take them (they go out by themselves once it can). Phones, short of room
 * in the header, say "3 waiting".
 */
export function SyncStatus({ sync, className = "" }: { sync: Sync; className?: string }) {
  const [online, setOnline] = useState(true);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!sync.saving) {
      setSlow(false);
      return;
    }
    const id = setTimeout(() => setSlow(true), 700);
    return () => clearTimeout(id);
  }, [sync.saving]);

  const n = sync.waiting;
  const waiting = n ? (
    <>
      <span className="max-sm:hidden">{trn(n, "{n} change waiting", "{n} changes waiting")}</span>
      <span className="sm:hidden">{tr("{n} waiting", { n })}</span>
    </>
  ) : null;
  return (
    <span role="status" className={`flex items-center gap-1.5 text-caption whitespace-nowrap text-ink-3 ${className}`}>
      {!online || sync.trouble === "offline" ? (
        <>
          <CloudOffIcon size={13} className="flex-none" />
          {waiting ? <span>{tr("Offline")} · {waiting}</span> : tr("Offline")}
        </>
      ) : sync.trouble === "error" && waiting ? (
        <span>{waiting}</span>
      ) : slow ? (
        <>
          <span className="size-1.5 animate-pulse rounded-full bg-accent" />
          {tr("Saving…")}
        </>
      ) : null}
    </span>
  );
}
