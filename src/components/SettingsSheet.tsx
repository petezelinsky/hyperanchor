"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { signOutAction } from "@/app/actions";
import type { WeekStart } from "@/lib/dates";
import type { AppUser } from "@/lib/types";
import { Avatar } from "./Avatar";
import { DownloadIcon, KeyboardIcon, SlidersIcon, XIcon } from "./icons";
import { applyTheme, readTheme, type Theme } from "./prefs";
import { THEMES } from "./ThemeSwitch";
import { Button, buttonClass, IconButton, Kbd, Modal, SegmentedControl } from "./ui";

export type SettingsTab = "general" | "shortcuts";

/** The shortcuts, with the modifier spelled the way this keyboard labels it. */
function shortcuts(): { title: string; items: [string, string][] }[] {
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  return [
    {
      title: "Anywhere",
      items: [
        ["N", "New task"],
        ["F", "Focus: one task at a time"],
        ["/", "Search all tasks"],
        ["T", "Go to today"],
        ["← →", "Previous / next"],
        ["D W M A", "Switch view"],
        [`${mac ? "⌘" : "Ctrl"} Z`, "Undo the last action"],
        ["?", "Keyboard shortcuts"],
        [",", "Settings"],
      ],
    },
    {
      title: "In a list",
      items: [
        ["↑ ↓", "Select a task"],
        [`${mac ? "⌥" : "Alt"} ↑ ↓`, "Move it up or down"],
        ["Space", "Complete"],
        ["↵", "Edit the title"],
        ["Tab", "Title or notes"],
        ["⌫", "Delete"],
        ["Esc", "Cancel or deselect"],
      ],
    },
    {
      title: "In focus",
      items: [
        ["Space", "Done"],
        ["→", "Not now"],
        ["N", "Jot something down"],
        ["Esc", "Leave focus"],
      ],
    },
  ];
}

/**
 * Settings: appearance, the first day of the week, your data and the account, with the keyboard shortcuts on a tab of
 * their own (computers only; phones have no keys to learn). Every change applies at once.
 */
export function SettingsSheet({
  tab: initialTab,
  user,
  weekStart,
  onWeekStart,
  onClose,
}: {
  tab: SettingsTab;
  user: AppUser;
  weekStart: WeekStart;
  onWeekStart: (w: WeekStart) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState(initialTab);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [signingOut, startSignOut] = useTransition();

  return (
    <Modal label="Settings" onClose={onClose} top className="max-w-[560px]">
      <div className="flex items-center justify-between gap-4 px-6 pt-5">
        <h2 className="text-[18px] font-semibold tracking-[-0.015em]">Settings</h2>
        <IconButton label="Close" size="sm" onClick={onClose} className="-mr-2">
          <XIcon size={14} />
        </IconButton>
      </div>
      <div className="px-6 pt-3 pointer-coarse:hidden">
        <SegmentedControl
          label="Settings section"
          value={tab}
          options={[
            { value: "general", label: "General", icon: <SlidersIcon size={14} /> },
            { value: "shortcuts", label: "Keyboard shortcuts", icon: <KeyboardIcon size={14} /> },
          ]}
          onChange={setTab}
          size="lg"
          className="w-full"
        />
      </div>

      {tab === "general" ? (
        <div className="px-6 pt-1 pb-5">
          <Row title="Appearance">
            <SegmentedControl
              label="Appearance"
              value={theme}
              options={THEMES}
              onChange={(t) => {
                applyTheme(t);
                setTheme(t);
              }}
              size="lg"
              className="w-[184px]"
            />
          </Row>
          <Row title="Week starts on" hint="In Week, Month and Analytics.">
            <SegmentedControl
              label="Week starts on"
              value={weekStart === 0 ? "sunday" : "monday"}
              options={[
                { value: "monday", label: "Monday" },
                { value: "sunday", label: "Sunday" },
              ]}
              onChange={(v) => onWeekStart(v === "sunday" ? 0 : 1)}
              size="lg"
              className="w-[184px]"
            />
          </Row>
          <Row title="Your tasks" hint="Every task as a CSV file, for any spreadsheet.">
            <a href="/api/export" download className={`${buttonClass()} w-[184px] no-underline`}>
              <DownloadIcon size={14} />
              Export
            </a>
          </Row>
          <div className="flex items-center gap-3 border-b border-line py-4">
            <Avatar name={user.name} image={user.image} size={36} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-medium">{user.name}</div>
              <div className="truncate text-[12.5px] text-ink-3">{user.email}</div>
            </div>
            <Button onClick={() => startSignOut(() => signOutAction())} disabled={signingOut}>
              Sign out
            </Button>
          </div>
          <DeleteAccount />
          <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 pt-4 text-[12px] text-ink-3">
            <p>Appearance and the first day of the week are saved on this device.</p>
            <nav aria-label="Help and legal" className="flex gap-4">
              {[
                ["/privacy", "Privacy"],
                ["/terms", "Terms"],
                ["/support", "Support"],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="text-ink-2 no-underline hover:underline pointer-coarse:-my-2.5 pointer-coarse:py-2.5">
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 px-6 pt-4 pb-6 sm:grid-cols-2">
          {shortcuts().map((g) => (
            <div key={g.title}>
              <div className="mb-1 text-[12px] font-medium text-ink-3">{g.title}</div>
              {g.items.map(([keys, what]) => (
                <div key={what} className="flex h-9 items-center justify-between gap-4 border-b border-line text-[13.5px] last:border-0">
                  <span className="text-ink-2">{what}</span>
                  <span className="flex gap-1">
                    {keys.split(" ").map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/** One setting: its name (and a hint) on the left, the control on the right. */
function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-4">
      <div className="min-w-0">
        <div className="text-[14px] font-medium">{title}</div>
        {hint && <div className="mt-0.5 text-[12.5px] text-ink-3">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

/** Deleting the account takes a second, deliberate step; then everything goes and you're signed out. */
function DeleteAccount() {
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, startDelete] = useTransition();
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (asking) cancel.current?.focus();
  }, [asking]);

  const erase = () =>
    startDelete(async () => {
      setFailed(false);
      const res = await fetch("/api/account", { method: "DELETE" }).catch(() => null);
      if (!res?.ok) return setFailed(true);
      await signOutAction();
    });

  if (!asking)
    return (
      <Row title="Delete account" hint="Your tasks and account, erased for good.">
        <Button variant="danger-quiet" onClick={() => setAsking(true)} className="w-[184px]">
          Delete account…
        </Button>
      </Row>
    );
  return (
    <div role="group" aria-labelledby="delete-title" className="mt-4 animate-rise rounded-[14px] bg-red-soft p-4">
      <div id="delete-title" className="text-[14px] font-semibold text-red-ink">
        Delete your account?
      </div>
      <p className="mt-1 text-[13px] leading-[1.5] text-ink-2">
        Every task is erased right away, here and in the iPhone app, and you’re signed out. This can’t be undone, so export your tasks
        first if you might want them.
      </p>
      {failed && (
        <p role="alert" className="mt-2 text-[13px] font-medium text-red-ink">
          Couldn’t delete your account. Check your connection and try again.
        </p>
      )}
      <div className="mt-3.5 flex justify-end gap-2">
        <Button ref={cancel} onClick={() => setAsking(false)} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" onClick={erase} disabled={busy}>
          {busy ? "Deleting…" : "Delete for good"}
        </Button>
      </div>
    </div>
  );
}
