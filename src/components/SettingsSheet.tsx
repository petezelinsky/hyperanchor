"use client";

import { useState } from "react";
import { CheckIcon, XIcon } from "./icons";
import { ACCENTS, applyAccent, applyTheme, readAccent, readTheme, type Accent, type Theme } from "./prefs";
import { THEMES } from "./ThemeSwitch";
import { IconButton, Modal, radioKeys, SegmentedControl } from "./ui";

/** Appearance settings; every change applies at once and is remembered on this device. */
export function SettingsSheet({ onClose }: { onClose: () => void }) {
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
          <p className="mt-0.5 text-[13px] text-ink-3">Saved on this device.</p>
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
    </Modal>
  );
}
