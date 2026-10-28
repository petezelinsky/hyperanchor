"use client";

import { useEffect, useState } from "react";
import { AutoIcon, MoonIcon, SunIcon } from "./icons";
import { applyTheme, readTheme, type Theme } from "./prefs";
import { SegmentedControl } from "./ui";

export const THEMES: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Light", icon: <SunIcon size={14} /> },
  { value: "system", label: "Auto", icon: <AutoIcon size={14} /> },
  { value: "dark", label: "Dark", icon: <MoonIcon size={14} /> },
];

/** Compact Light / Auto / Dark switch for public pages. */
export function ThemeSwitch() {
  // Server-rendered as Auto; the saved choice is read after hydration, and the thumb jumps there rather than sliding.
  const [theme, setTheme] = useState<Theme>("system");
  const [synced, setSynced] = useState(false);
  useEffect(() => {
    setTheme(readTheme());
    const id = requestAnimationFrame(() => setSynced(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <SegmentedControl
      label="Appearance"
      value={theme}
      instant={!synced}
      options={THEMES.map((t) => ({ ...t, iconOnly: true }))}
      onChange={(t) => {
        applyTheme(t);
        setTheme(t);
      }}
      className="w-[108px]"
    />
  );
}
