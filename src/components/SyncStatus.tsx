"use client";

import { useEffect, useState } from "react";
import { CloudOffIcon } from "./icons";

/** Quiet unless it matters: "Saving…" when a save takes a while, "Offline" while the network is gone. */
export function SyncStatus({ saving, className = "" }: { saving: boolean; className?: string }) {
  const [online, setOnline] = useState(true);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  useEffect(() => {
    if (!saving) {
      setSlow(false);
      return;
    }
    const id = setTimeout(() => setSlow(true), 700);
    return () => clearTimeout(id);
  }, [saving]);

  return (
    <span role="status" className={`flex items-center gap-1.5 text-[12px] text-ink-3 ${className}`}>
      {!online ? (
        <>
          <CloudOffIcon size={13} />
          Offline
        </>
      ) : slow ? (
        <>
          <span className="size-1.5 animate-pulse rounded-full bg-accent" />
          Saving…
        </>
      ) : null}
    </span>
  );
}
