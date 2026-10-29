"use client";

import { useState, useTransition } from "react";
import { signOutAction } from "@/app/actions";
import type { AppUser } from "@/lib/types";
import { CheckIcon, XIcon } from "./icons";
import { ACCENTS, applyAccent, applyTheme, readAccent, readTheme, type Accent, type Theme } from "./prefs";
import { THEMES } from "./ThemeSwitch";
import { Button, IconButton, Modal, radioKeys, SegmentedControl } from "./ui";

/** Appearance settings (applied at once, remembered on this device) and the account. */
export function SettingsSheet({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [accent, setAccent] = useState<Accent>(readAccent);
  const pickAccent = (a: Accent) => {
    applyAccent(a);
    setAccent(a);
  };

  return (
    <Modal label="Settings" onClose={onClose} className="max-w-[420px] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.015em]">Settings</h2>
          <p className="mt-0.5 text-[13px] text-ink-3">Appearance is saved on this device.</p>
        </div>
        <IconButton label="Close" size="sm" onClick={onClose} className="-mt-1 -mr-1">
          <XIcon size={14} />
        </IconButton>
      </div>

      <h3 className="mt-6 text-[13px] font-semibold">Appearance</h3>
      <SegmentedControl
        label="Appearance"
        size="lg"
        value={theme}
        options={THEMES}
        onChange={(t) => {
          applyTheme(t);
          setTheme(t);
        }}
        className="mt-2"
      />

      <h3 className="mt-6 text-[13px] font-semibold">Accent color</h3>
      <div
        role="radiogroup"
        aria-label="Accent color"
        onKeyDown={(e) =>
          radioKeys(
            e,
            ACCENTS.map((a) => a.value),
            accent,
            pickAccent,
          )
        }
        className="mt-2 grid grid-cols-3 gap-2"
      >
        {ACCENTS.map((a) => {
          const on = accent === a.value;
          return (
            <button
              key={a.value}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => pickAccent(a.value)}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-[10px] px-2 py-3 text-[13px] font-medium transition-[background-color,box-shadow] duration-150 sm:h-11 sm:flex-row sm:justify-start sm:gap-2.5 sm:px-3 sm:py-0 ${
                on ? "bg-surface shadow-[0_0_0_1.5px_var(--ink)]" : "bg-surface-3 hover:bg-line"
              }`}
            >
              <span className="flex size-[18px] flex-none items-center justify-center rounded-full text-white" style={{ background: a.swatch }}>
                {on && <CheckIcon size={9} strokeWidth={2.6} />}
              </span>
              {a.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] text-ink-3">Used for today, progress and finished tasks.</p>

      <AccountSection user={user} />
    </Modal>
  );
}

/** Who is signed in, sign out, and deleting the account with everything in it (after a confirmation). */
function AccountSection({ user }: { user: AppUser }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const deleteAccount = () =>
    startTransition(async () => {
      setError(false);
      const res = await fetch("/api/account", { method: "DELETE" }).catch(() => null);
      if (res?.ok) await signOutAction();
      else setError(true);
    });

  return (
    <>
      <h3 className="mt-6 text-[13px] font-semibold">Account</h3>
      <div className="mt-2 flex items-center gap-3 rounded-[10px] bg-surface-3 py-2 pr-2 pl-3">
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{user.email}</span>
        <Button size="sm" onClick={() => startTransition(() => signOutAction())} disabled={pending}>
          Sign Out
        </Button>
      </div>
      {confirming ? (
        <div role="alert" className="mt-3 rounded-[10px] bg-red-soft p-3">
          <p className="text-[13px] font-medium text-red-ink">Delete your account and all of your tasks?</p>
          <p className="mt-0.5 text-[12px] text-ink-2">This can’t be undone. It applies to the iPhone app too.</p>
          {error && <p className="mt-1.5 text-[12px] font-medium text-red-ink">Couldn’t delete the account. Please try again.</p>}
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" onClick={() => setConfirming(false)} disabled={pending}>
              Cancel
            </Button>
            <Button size="sm" variant="plain" onClick={deleteAccount} disabled={pending} className="bg-red-ink text-white hover:bg-red-ink hover:text-white">
              {pending ? "Deleting…" : "Delete Account"}
            </Button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="mt-2 text-[12.5px] font-medium text-red-ink hover:underline">
          Delete Account…
        </button>
      )}
    </>
  );
}
