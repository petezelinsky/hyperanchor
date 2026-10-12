"use client";

import { useEffect, useState } from "react";
import { signOutAction } from "@/app/actions";
import type { AppUser } from "@/lib/types";
import { Avatar } from "./Avatar";
import { LogoPill } from "./Logo";

type View = "day" | "calendar";

export function Header({
  user,
  view,
  onView,
  onNewTask,
}: {
  user: AppUser;
  view: View;
  onView: (v: View) => void;
  onNewTask: () => void;
}) {
  const [accountOpen, setAccountOpen] = useState(false);
  const firstName = user.name.trim().split(/\s+/)[0] || user.email;

  useEffect(() => {
    if (!accountOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAccountOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [accountOpen]);

  const tab = (v: View, label: string) => (
    <button
      type="button"
      onClick={() => onView(v)}
      aria-pressed={view === v}
      className={`mono h-8 rounded-full px-3 transition-colors duration-150 hover:text-ink sm:px-4 ${view === v ? "bg-white text-ink" : "bg-transparent text-muted-2"}`}
    >
      {label}
    </button>
  );

  return (
    <header className="sticky top-0 z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 bg-[rgba(237,237,235,0.94)] px-4 py-4 sm:gap-4 sm:px-6">
      <div className="justify-self-start">
        <LogoPill compact />
      </div>

      <nav className="mono flex h-10 items-center gap-0.5 rounded-full bg-white/60 p-1 text-xs">
        {tab("day", "Day")}
        {tab("calendar", "Calendar")}
      </nav>

      <div className="flex items-center gap-2 justify-self-end">
        <button
          type="button"
          onClick={() => {
            setAccountOpen(false);
            onNewTask();
          }}
          aria-label="New task"
          className="mono flex h-10 items-center gap-2.5 rounded-full bg-primary px-3.5 text-xs text-white shadow-pill-dark transition-colors duration-150 hover:bg-primary-hover sm:px-[18px]"
        >
          <span className="max-sm:hidden">Task</span>
          <span className="text-[15px] leading-none">+</span>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setAccountOpen((o) => !o)}
            aria-expanded={accountOpen}
            aria-haspopup="true"
            aria-label="Account"
            className="mono flex h-10 items-center gap-2.5 rounded-full bg-white/60 pr-1.5 pl-1.5 text-xs text-ink transition-colors duration-150 hover:bg-white sm:pl-3.5"
          >
            <span className="max-w-[120px] truncate max-sm:hidden">{firstName}</span>
            <Avatar name={user.name} image={user.image} size={28} className="text-[11px]" />
          </button>

          {accountOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setAccountOpen(false)} />
              <div className="absolute top-[52px] right-0 z-21 w-[300px] max-w-[calc(100vw-32px)] rounded-3xl bg-dropdown p-5 shadow-dropdown">
                <div className="mono text-[11px] text-muted-2">Account</div>
                <div className="mt-4 flex items-center gap-3">
                  <Avatar name={user.name} image={user.image} size={44} className="text-sm" />
                  <div className="min-w-0">
                    <div className="truncate text-base font-medium">{user.name}</div>
                    <div className="truncate text-[13px] text-muted-2">{user.email}</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-[14px] bg-fill px-3 py-2.5 text-[12.5px] text-muted">
                  <span className="size-[7px] rounded-full bg-done" />
                  <span>Signed in with Google</span>
                </div>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="mono mt-3 h-11 w-full rounded-full bg-transparent text-[11px] text-ink shadow-[inset_0_0_0_1px_#E2E2DF] transition-colors duration-150 hover:bg-white"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
