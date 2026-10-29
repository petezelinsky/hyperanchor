"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "./icons";
import { applyTheme, readTheme, type Theme } from "./prefs";
import { radioKeys } from "./ui";

export const THEMES: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Light", icon: <SunIcon size={14} /> },
  { value: "dark", label: "Dark", icon: <MoonIcon size={14} /> },
];

/**
 * Compact Light / Dark switch for public pages. They are server-rendered before the theme is known, so the thumb
 * and the icon colors follow html[data-theme] in CSS (set before the first paint): right from the start, no jump.
 */
export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => setTheme(readTheme()), []);
  const pick = (t: Theme) => {
    applyTheme(t);
    setTheme(t);
  };
  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      onKeyDown={(e) =>
        radioKeys(
          e,
          THEMES.map((t) => t.value),
          theme,
          pick,
        )
      }
      className="relative grid w-[72px] grid-cols-2 rounded-[10px] bg-surface-3 p-[3px]"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-[3px] left-[3px] w-[calc((100%-6px)/2)] rounded-[7px] bg-surface shadow-lift transition-transform duration-300 ease-out dark:translate-x-full"
      />
      {THEMES.map((o) => {
        const on = o.value === theme;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.label}
            data-tip={o.label}
            tabIndex={on ? 0 : -1}
            onClick={() => pick(o.value)}
            className={`relative flex h-[26px] items-center justify-center rounded-[7px] transition-colors duration-150 hover:text-ink ${
              o.value === "dark" ? "text-ink-2 dark:text-ink" : "text-ink dark:text-ink-2"
            }`}
          >
            {o.icon}
          </button>
        );
      })}
    </div>
  );
}
