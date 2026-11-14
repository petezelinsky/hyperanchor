"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { signOutAction } from "@/app/actions";
import type { WeekStart } from "@/lib/dates";
import type { AppUser } from "@/lib/types";
import { Avatar } from "./Avatar";
import { ArrowLeftIcon, ChevronDown, ChevronRight, DownloadIcon, SignOutIcon, XIcon } from "./icons";
import { applyTheme, readSounds, readTheme, saveSounds, type Theme } from "./prefs";
import { THEMES } from "./ThemeSwitch";
import { Button, buttonClass, IconButton, Kbd, Menu, Modal, SegmentedControl, type MenuEntry } from "./ui";
import { canListen, guessLanguage, languageName, readLanguageChoice, saveLanguageChoice, spokenLanguages } from "./voice/dictation";
import { canRecord } from "./voice/recorder";
import { primeSound, soundTimer } from "./voice/sound";

type Page = "settings" | "shortcuts" | "account";

export type SettingsTab = "general" | "shortcuts";

/** The shortcuts, with the modifier spelled the way this keyboard labels it. */
function shortcuts(voice: boolean): { title: string; items: [string, string][] }[] {
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  return [
    {
      title: "Anywhere",
      items: [
        ["N", "New task"],
        ...(voice ? ([["V", "Speak your tasks"]] as [string, string][]) : []),
        ["F", "Focus: one task at a time"],
        ["/", "Search all tasks"],
        ["T", "Go to today"],
        ["← →", "Previous / next"],
        ["D W M", "Day, week, month"],
        ["A", "Analytics"],
        ["[", "Show or hide the sidebar"],
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
        ["⌫", "Delete"],
        ["Esc", "Cancel or deselect"],
      ],
    },
    {
      title: "In focus",
      items: [
        ["Space", "Done"],
        ["→", "Later"],
        ["N", "Jot something down"],
        ["Esc", "Leave focus"],
      ],
    },
  ];
}

/**
 * Settings: a window. Sections are named, not painted: General (appearance, the first day of the week, sounds, the
 * keyboard shortcuts on computers; the order of tasks is on the task pages themselves), Voice (the spoken language: worked out by itself unless one is
 * named here), your data, and the account, which opens one level down (where deleting it lives, at the very end).
 * Signing out sits at the foot. Every change applies at once.
 */
export function SettingsSheet({
  tab,
  user,
  weekStart,
  onWeekStart,
  voice,
  transcribe,
  sample,
  onClose,
}: {
  tab: SettingsTab;
  user: AppUser;
  weekStart: WeekStart;
  onWeekStart: (w: WeekStart) => void;
  /** Whether the Speak screen is offered (its settings and its shortcut are listed only then). */
  voice: boolean;
  /** Whether speech is written down on the server (any language, worked out from the voice itself). */
  transcribe: boolean;
  /** The person's latest task titles: what the spoken language is guessed from. */
  sample: string[];
  onClose: () => void;
}) {
  const [page, setPage] = useState<Page>(tab === "shortcuts" ? "shortcuts" : "settings");
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [sounds, setSounds] = useState(readSounds);
  const [language, setLanguage] = useState(readLanguageChoice);
  const [signingOut, startSignOut] = useTransition();
  const guessed = languageName(guessLanguage(sample));
  // Opened straight on the shortcuts (?), Back closes; from Settings, it goes back to Settings.
  const back = tab === "shortcuts" && page === "shortcuts" ? null : () => setPage("settings");
  const title = page === "shortcuts" ? "Keyboard shortcuts" : page === "account" ? "Account" : "Settings";

  return (
    <Modal label={title} onClose={onClose} top sheet className="flex max-w-[560px] flex-col">
      <div className="flex h-[60px] flex-none items-center gap-2.5 border-b border-line px-4 md:px-6">
        {page !== "settings" && back && (
          <IconButton label="Back" onClick={back} className="-ml-1.5 shadow-[inset_0_0_0_1px_var(--line-2)]">
            <ArrowLeftIcon size={15} />
          </IconButton>
        )}
        <h2 className="min-w-0 flex-1 truncate text-headline font-semibold">{title}</h2>
        <IconButton label="Close" onClick={onClose} className="-mr-1.5 shadow-[inset_0_0_0_1px_var(--line-2)]">
          <XIcon size={14} />
        </IconButton>
      </div>

      {page === "settings" ? (
        <>
          <div className="pb-2">
            <Band>General</Band>
            <Row title="Appearance">
              <SegmentedControl
                label="Appearance"
                value={theme}
                options={THEMES}
                onChange={(t) => {
                  applyTheme(t);
                  setTheme(t);
                }}
                className="w-[176px]"
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
                className="w-[176px]"
              />
            </Row>
            <Row title="Sounds" hint="A soft chime when the focus timer is up." last>
              <SegmentedControl
                label="Sounds"
                value={sounds ? "on" : "off"}
                options={[
                  { value: "on", label: "On" },
                  { value: "off", label: "Off" },
                ]}
                onChange={(v) => {
                  saveSounds(v === "on");
                  setSounds(v === "on");
                  // Turning them on lets you hear what it is like.
                  if (v === "on") {
                    primeSound();
                    soundTimer();
                  }
                }}
                className="w-[176px]"
              />
            </Row>
            <div className="pointer-coarse:hidden">
              <Go title="Keyboard shortcuts" onClick={() => setPage("shortcuts")} top />
            </div>

            {/* Heard on the server, the language needs no setting: the model hears it, and a mix of them. */}
            {voice && !(transcribe && canRecord()) && canListen() && (
              <>
                <Band>Voice</Band>
                <Row
                  title="Spoken language"
                  hint={language ? "Always listens in this language." : `Worked out from your tasks and your browser: ${guessed} right now.`}
                  last
                >
                  <Pick
                    label="Spoken language"
                    value={language ? languageName(language) : "Automatic"}
                    entries={[
                      {
                        label: "Automatic",
                        checked: !language,
                        onSelect: () => {
                          saveLanguageChoice(null);
                          setLanguage(null);
                        },
                      },
                      { separator: true },
                      ...spokenLanguages().map((l) => ({
                        label: l.name,
                        checked: l.tag === language,
                        onSelect: () => {
                          saveLanguageChoice(l.tag);
                          setLanguage(l.tag);
                        },
                      })),
                    ]}
                  />
                </Row>
              </>
            )}

            <Band>Your data</Band>
            <Row title="Export tasks" hint="Every task, as a CSV file." last>
              <a href="/api/export" download className={`${buttonClass()} no-underline`}>
                <DownloadIcon size={14} />
                Download
              </a>
            </Row>

            <Band>Account</Band>
            <Go
              title={user.name}
              hint={user.email}
              lead={<Avatar name={user.name} image={user.image} size={36} />}
              onClick={() => setPage("account")}
              last
            />
          </div>
          <div className="flex flex-none items-center justify-between gap-3 border-t border-line px-4 py-3 md:px-6">
            <nav aria-label="Help and legal" className="flex gap-3.5 text-caption">
              {[
                ["/privacy", "Privacy"],
                ["/terms", "Terms"],
                ["/support", "Support"],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="tap relative text-ink-3 no-underline hover:text-ink">
                  {label}
                </Link>
              ))}
            </nav>
            <Button onClick={() => startSignOut(() => signOutAction())} disabled={signingOut} className="pl-2.5">
              <SignOutIcon size={14} />
              Sign out
            </Button>
          </div>
        </>
      ) : page === "account" ? (
        <div className="pb-2">
          <div className="h-1.5" />
          <Row title="Name">
            <span className="min-w-0 truncate text-body text-ink-3">{user.name}</span>
          </Row>
          <Row title="Email" last>
            <span className="min-w-0 truncate text-body text-ink-3">{user.email}</span>
          </Row>
          <p className="px-4 pt-1 pb-2 text-caption text-ink-3 md:px-6">Appearance and the first day of the week are saved on this device.</p>
          <Band>Delete account</Band>
          <DeleteAccount />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 px-4 pt-4 pb-6 sm:grid-cols-2 md:px-6">
          {shortcuts(voice).map((g) => (
            <div key={g.title}>
              <div className="mb-1 text-caption-2 font-semibold tracking-[0.06em] text-ink-3 uppercase">{g.title}</div>
              {g.items.map(([keys, what]) => (
                <div key={what} className="flex h-9 items-center justify-between gap-4 border-b border-line text-footnote last:border-0">
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

/** A choice among several: a button with the current one, which opens the list. */
function Pick({ label, value, entries }: { label: string; value: string; entries: MenuEntry[] }) {
  const [menu, setMenu] = useState<{ anchor: DOMRect; trigger: HTMLElement } | null>(null);
  return (
    <>
      <Button
        aria-haspopup="menu"
        aria-expanded={!!menu}
        aria-label={`${label}: ${value}. Change`}
        onClick={(e) => {
          const trigger = e.currentTarget;
          setMenu((m) => (m ? null : { anchor: trigger.getBoundingClientRect(), trigger }));
        }}
        className="min-w-[176px] flex-none justify-between gap-2 pr-2 pl-3"
      >
        <span className="truncate">{value}</span>
        <ChevronDown size={12} className="flex-none text-ink-3" />
      </Button>
      {menu && <Menu anchor={menu.anchor} trigger={menu.trigger} align="end" label={label} className="max-h-[min(60vh,420px)] min-w-[176px] overflow-y-auto" entries={entries} onClose={() => setMenu(null)} />}
    </>
  );
}

/** A section's name: small capitals, no color. */
function Band({ children }: { children: React.ReactNode }) {
  return <div className="px-4 pt-5 pb-1.5 text-caption-2 font-semibold tracking-[0.06em] text-ink-3 uppercase md:px-6">{children}</div>;
}

/** A line that opens a page one level down. */
function Go({ title, hint, lead, onClick, top = false, last = false }: { title: string; hint?: string; lead?: React.ReactNode; onClick: () => void; top?: boolean; last?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center justify-between gap-4 px-4 py-2 text-left transition-colors duration-(--duration-fast) hover:bg-surface-2 md:px-6 ${hint ? "min-h-16" : "min-h-[52px]"} ${top ? "border-t border-line" : ""} ${last ? "" : "border-b border-line"}`}
    >
      <span className="flex min-w-0 items-center gap-3">
        {lead}
        <span className="min-w-0">
          <span className="block truncate text-body font-medium text-ink">{title}</span>
          {hint && <span className="block truncate text-caption text-ink-3">{hint}</span>}
        </span>
      </span>
      <span aria-hidden="true" className="flex size-7 flex-none items-center justify-center rounded-[7px] text-ink-2 shadow-[inset_0_0_0_1px_var(--line-2)] transition-colors group-hover:text-ink">
        <ChevronRight size={14} />
      </span>
    </button>
  );
}

/** One setting: its name (and a hint) on the left, the control on the right. */
function Row({ title, hint, children, last = false }: { title: string; hint?: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 px-4 py-2 md:px-6 ${hint ? "min-h-16" : "min-h-[52px]"} ${last ? "" : "border-b border-line"}`}>
      <div className="min-w-0">
        <div className="text-body font-medium">{title}</div>
        {hint && <div className="mt-0.5 text-caption text-ink-3">{hint}</div>}
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
      <div className="flex flex-col items-start gap-3.5 px-4 pt-1 pb-5 md:px-6">
        <p className="max-w-[440px] text-body text-ink-2">
          This erases every task and the account itself, for good. Nothing can bring them back, so export your tasks first if you might want them.
        </p>
        <Button variant="danger-quiet" onClick={() => setAsking(true)}>
          Delete account…
        </Button>
      </div>
    );
  return (
    <div role="group" aria-labelledby="delete-title" className="mx-4 mt-1 mb-5 animate-[fade_var(--duration-fast)_var(--ease-out)_both] rounded-lg bg-red-soft p-4 md:mx-6">
      <div id="delete-title" className="text-body font-semibold text-red-ink">
        Delete your account?
      </div>
      <p className="mt-1 text-footnote text-ink-2">
        Every task is erased right away, here and in the iPhone app, and you’re signed out. This can’t be undone, so export your tasks
        first if you might want them.
      </p>
      {failed && (
        <p role="alert" className="mt-2 text-footnote font-medium text-red-ink">
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
